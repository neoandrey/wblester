from datetime import timedelta, datetime
import rq, os, traceback, shutil, urllib.request, json, smtplib, ssl, re
from rq import get_current_job
from app.main.serializer import Serializer
from app.gmailbox import GmailHelper
from app.imap import ImapEmailHelper
from app import models
from traceback import format_exc
from app import models
from app.models import (
    Jobs,
    AuditTrail,
    Files,
    GMailAccounts,
    IMAPAccounts,
    Images,
    Events,
    EventTypes,
    Schedules,
    EventTriggers,
    MailTemplates,
    SiteSettings,
  #  Clients,
    Users,
)
from flask import current_app
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from rq import Retry
import html

key_maker = Serializer()


def linuxize_file(file_path):
    return file_path[file_path.index("app") :].replace(
        "\\", "/"
    )  # file_path.replace("C:\\", "/mnt/c/").replace("\\", "/")


def format_data(data):
    """
    Format data from mongo queries
    """
    if str(type(data)) == "datetime.datetime":
        return data.strftime("%Y%m%d_%H%M%S")
    elif str(type(data)) == "bson.objectid.ObjectId":
        return str(data)
    elif type(data) is dict:
        return json.dumps(data)
    elif type(data) is int:
        return int(data)
    elif type(data) is list:
        return data
    else:
        return str(data)


def get_collection_data(data):
    table_data = []
    for row in data:
        temp_data = {}
        for k, v in row.items():
            if k == "records":
                temp_data[k] = get_collection_data(v)
            else:
                temp_data[k] = format_data(v)
        table_data.append(temp_data)
    return table_data


def get_image_attachments(contents):
    """
    Gets image attachment for gmail emails
    """
    contents = html.unescape(contents)
    image_pattern = re.compile(r"(<img[^>]*>)")  # re.compile(r"<img.*>")
    images = image_pattern.findall(contents)
    image_attachments = []

    for image in images:
        image_path = ""
        component_pattern = re.compile(r"[(.*)\S]+")
        components = component_pattern.findall(image)
        for component in components:
            if "src" in component:
                image_path = (
                    "/opt/"
                    + current_app.config["APP_CONFIG"]["SITE_ID"].lower()
                    + os.sep
                    + "app"
                    #  + os.sep
                    + component.split("=")[-1].replace('"', "")
                )
                image_attachments.append(image_path)

                image_name = image_path.split(os.sep)[-1]
                contents = contents.replace(image, f'<img src="cid:{image_name}"/>')
    return [contents, image_attachments]


def get_file_attachments(contents):
    """
    Gets file attachment for gmail emails
    """
    contents = html.unescape(contents)
    empty_anchor_pattern = re.compile(r".*(<a[>]*>[\s]*</a>).*")
    contents = contents.replace(r"<a>\s*</a>", "")
    contents = contents.replace(r"<a><", "</a><")
    file_attachments = []

    empty_anchors = empty_anchor_pattern.findall(contents)
    for empty_anchor in empty_anchors:
        contents = contents.replace(empty_anchor, "")

    anchor_pattern = re.compile(r"(<a[^>]*>.*?</a>)")  # re.compile(r"<a.*a>")
    anchors = anchor_pattern.findall(contents)
    tag_content_pattern = re.compile(r".*>(.*)<.*")
    for anchor in anchors:
        # print("anchor: ", anchor)
        file_path = ""
        tag_contents = tag_content_pattern.findall(anchor)
        tag_contents = tag_contents[0]
        component_pattern = re.compile(r'"(.*)"')  # re.compile(r"\s+(\S+)\s+")
        components = component_pattern.findall(anchor)
        # print("components: ", components)
        for component in components:
            # print("component: ", component)
            file_path = component.replace("\\", "/")
            # print("file_path: ", file_path)
            prefix = (
                "/opt/" + current_app.config["APP_CONFIG"]["SITE_ID"].lower() + os.sep
            )
            if "app" in file_path:
                app_index = file_path.index("app")
                file_path = prefix + file_path[app_index:]
                file_attachments.append(file_path)
                contents = contents.replace(anchor, f"<ul><li>{tag_contents}</li><ul>")
                # file_name = file_path.split(os.sep)[-1]

                # print(f'href="{final_path}"', f'href="cid:{file_name}"')
    # print("file_attachments: ", file_attachments)
    return [contents, file_attachments]


def parse_contents(contents, parameters):
    placeholder_pattern = re.compile(r"\[([^\]]*)\]")
    place_holders = placeholder_pattern.findall(contents)

    for place_holder in place_holders:
        place_holder_replacement = ""
        collection = None
        components = place_holder.split("/")
        collection = components[0]
        field = components[1]
        value = components[2]

        if "@DYNAMIC_PLACEHOLDER" in value.upper():
            table = value.split("_")[-1]
            table_key = table.capitalize()
            for k in models.__dict__.keys():
                if k.lower() == table.lower():
                    table_key = k
                    break
            columns = []
            if table_key:
                collection = models.__dict__[table_key]
                columns = collection.get_schema()["order"]
            schema = [col.lower() for col in columns]

            for param in parameters:
                col_field = param.replace("dynamic_", "")
                if "dynamic_" in param.lower() and col_field in schema:
                    temp = {}
                    temp[col_field] = (
                        int(parameters[param])
                        if col_field.endswith("id")
                        else parameters[param]
                    )

                    place_holder_replacement = collection.objects(__raw__=temp)
                    if len(place_holder_replacement) == 1:
                        place_holder_replacement = place_holder_replacement[0]

                    replacement = str(place_holder_replacement[field.lower()])
                    # print(place_holder, replacement)
                    contents = contents.replace(f"[{place_holder}]", replacement)
    return contents


# def convert_value_to_type(value):
#     value = get_mongo_relation(value)
#     value_type = type(value)
#     new_value = value
#     if value_type is str:
#         if "." in value:
#             try:
#                 new_value = float(value)
#             except:
#                 pass
#         else:
#             try:
#                 new_value = int(value)
#             except:
#                 pass
#     return new_value


def log_event_details(parameters):
    """
    Updates Event information, Job details and Trigger details
    """
    trigger_id = None
    event = None
    job = None
    trigger = None
    event_type = None
    mail_template = None
    schedule = None
    # print(parameters)
    if "start" in parameters and parameters["start"]:
        parameters["start"] = False
        event_id = parameters["event_id"]
        event = Events.get({"event_id": int(event_id)})
    else:
        event = Events.create(parameters)
    job = event.job if None is not event and None is not event.job else None
    if not job:
        redis_job = get_current_job()  # if started_job is None else started_job
        job_name = parameters["job_name"]
        job_id = redis_job.get_id()
        param_string = json.dumps(parameters)
        description = f"{job_name} with parameters: {param_string}"
        job = Jobs(
            job_id=job_id,
            name=job_name,
            parameters=f"{param_string}",
            description=description,
            jobStatus=0,
            info=[f"Job queued in Redis with ID: {redis_job.id}"],
            startTime=datetime.now(),
            last_modified_date=datetime.now(),
        )
        job.save()
    if "trigger_id" in parameters:
        trigger_id = parameters["trigger_id"]
        trigger = EventTriggers.get({"trigger_id": int(trigger_id)})
        event_type = trigger.event_type
        mail_template = event_type.template
        schedule = trigger.schedule
        trigger.trigger_count = int(trigger.trigger_count) + 1
        current_time = datetime.now()
        temp = {}
        temp[current_time.strftime("%Y-%m-%d %H:%M:%S")] = event_id

        if (
            not "trigger_history" in trigger
            or trigger.trigger_history is None
            or trigger.trigger_history == {}
        ):
            trigger.trigger_history = temp
        else:
            trigger.trigger_history.update(temp)
        trigger.save()
    else:
        event_type_id = (
            parameters["event_type_id"] if "event_type_id" in parameters else None
        )
        schedule_id = (
            parameters["event_type_id"] if "event_type_id" in parameters else None
        )
        event_type = EventTypes.get({"type_id": event_type_id})
        mail_template = event_type.mail_template
        schedule = Schedules.get({"schedule_id": int(schedule_id)})

    schedule_name = schedule.name if schedule else ""
    job.schedule = str(schedule_name)
    job.last_modified_date = datetime.now()
    job.current_version = int(job.current_version) + 1
    job.save()

    return {
        "parameters": parameters,
        "job": job,
        "event": event,
        "schedule": schedule,
        "mail_template": mail_template,
    }


def log_job_details(job_function, parameters, schedule_id=0):
    redis_job = get_current_job()
    job_name = f"app.tasks.{job_function}"
    parameters = json.dumps(parameters)
    # running_job = Jobs.get({"name": job_name, "parameters": parameters})
    job_id = redis_job.get_id()
    running_job = Jobs.get({"job_id": job_id})
    description = f"{job_name} with parameters {parameters}"
    if not running_job:
        job = Jobs(
            job_id=job_id,
            name=job_name,
            parameters=parameters,
            description=description,
            user_id=0,
            jobStatus=0,
            schedule=str(schedule_id),
            info=[f"Job queued in Redis with ID: {redis_job.id}"],
        )
        job.save()
        running_job = job
    return running_job


def user_registration_alert_handler(parameters):
    """
    Sends registration alert emails to clients. Some parameters are required for Jobs and Events.
    Handler Parameters:
    client_id  => for tests purposes. A separate function should be created later on for client registration
    sender_name
    subject
    """

    task_parameters = log_event_details(parameters)
    client_id = task_parameters["parameters"]["dynamic_client_id"]
    client = Clients.get({"client_id": int(client_id)})
    recipient = client.email_address
    mail_template = task_parameters["mail_template"]
    event = task_parameters["event"]
    job = task_parameters["job"]
    schedule = task_parameters["schedule"]
    site_settings = SiteSettings.get({"settings_id": 1})

    try:

        job_name = task_parameters["parameters"]["job_name"]
        queue = rq.Queue(
            current_app.config["REDIS_QUEUE_NAME"], connection=current_app.redis
        )
        mailing_details = (
            site_settings.default_mailing_account
            if "default_mailing_account" in site_settings
            else "imap,1"
            # else "gmail,1"
        )
        mail_type = mailing_details.split(",")[0]
        account_id = mailing_details.split(",")[1]
        if mail_type == "gmail":

            gmail_account = GMailAccounts.get({"account_id": account_id})
            gmail_server = gmail_account.servers
            email_address = gmail_account.email_address
            credential_file = linuxize_file(gmail_account.credential_file)
            token_file = linuxize_file(gmail_account.token_file)
            # print(gmail_server, email_address, credential_file, token_file)
            gmail_helper = GmailHelper(
                gmail_server,
                email_address,
                credential_file,
                token_file,
            )
            service = gmail_helper.gmail_authenticate("gmail")

            event.notification_status = Events.PENDING
            event.current_version = int(event.current_version) + 1
            event.last_modified_date = datetime.now()
            event.save()

            body = """<html>
            <body><style>
            font-size:12px;
            font-family: "Times New Roman", Arial, Helvetica, Times, serif;
            body {
                font-size: 16px !important;
            }
            table, th, td {
                border: 1px solid black;
                border-collapse: collapse;
            }
            th, td {
                padding: 10px;
                text-align: left;
            }
            table{
                    width: 80%;    
            }
            </style>
            """
            mail_draft = parse_contents(
                mail_template.contents, task_parameters["parameters"]
            )
            mail_draft, image_attachments = get_image_attachments(mail_draft)
            mail_draft, file_attachments = get_file_attachments(mail_draft)
            body += mail_draft
            destination = recipient  # task_parameters["parameters"]["recipients"]
            sbj = task_parameters["parameters"]["subject"]
            body += "<br />"
            body += "Best regards,"
            body += "<br />"
            body += task_parameters["parameters"]["sender_name"]
            body += "</body></html>"
            # print("attachments: ", image_attachments)
            # print("file_attachments: ", file_attachments)
            file_attachments = file_attachments + (image_attachments)
            gmail_helper.send_message(service, destination, sbj, body, file_attachments)
            event.notification_status = Events.SENT
            event.current_version = int(event.current_version) + 1
            event.last_modified_date = datetime.now()
            event.save()
        else:
            imap_account = IMAPAccounts.get({"account_id": account_id})
            event.notification_status = Events.PENDING
            event.current_version = int(event.current_version) + 1
            event.last_modified_date = datetime.now()
            event.save()

            body = """<html>
            <body><style>
            font-size:12px;
            font-family: "Times New Roman", Arial, Helvetica, Times, serif;
            body {
            font-size: 16px !important;
            }
            table, th, td {
            border: 1px solid black;
            border-collapse: collapse;
            }
            th, td {
            padding: 10px;
            text-align: left;
            }
            table{
            width: 80%;    
            }
            </style>
            """
            mail_draft = parse_contents(
                mail_template.contents, task_parameters["parameters"]
            )
            mail_draft, image_attachments = get_image_attachments(mail_draft)
            mail_draft, file_attachments = get_file_attachments(mail_draft)
            body += mail_draft
            destination = recipient  # task_parameters["parameters"]["recipients"]
            sbj = task_parameters["parameters"]["subject"]
            body += "<br />"
            body += "Best regards,"
            body += "<br />"
            body += task_parameters["parameters"]["sender_name"]
            body += "</body></html>"
            file_attachments = file_attachments + (image_attachments)
            plain_message = MIMEText(mail_template.contents, "plain")
            html_message = MIMEText(body, "html")

            message = MIMEMultipart("alternative")
            # message = MIMEMultipart()
            message["Subject"] = task_parameters["parameters"]["subject"]
            message["From"] = task_parameters["parameters"][
                "sender_name"
            ]  # imap_account.imap_username
            message["To"] = destination
            message.attach(plain_message)
            message.attach(html_message)

            for attachment in file_attachments:
                message.attach(ImapEmailHelper.add_attachment(attachment))

            with smtplib.SMTP(
                imap_account.imap_server_address, imap_account.imap_port
            ) as server:
                server.starttls()
                server.login(
                    imap_account.imap_username,
                    key_maker.multiDemystify(
                        imap_account.imap_password,
                        current_app.config["CIPHER_COUNT"],
                    ),
                    initial_response_ok=True,
                )
                server.sendmail(
                    imap_account.imap_username,
                    recipient,  # task_parameters["parameters"]["recipients"],
                    message.as_string(),
                )
                event.notification_status = Events.SENT
                event.save()
        job.complete = True
        job.endTime = datetime.now()
        job.info = job.info + [f"Job complete successfully at {job.endTime}."]
        job.jobStatus = Jobs.SUCCEEDED
        job.progress = 100.0
        job.current_version = int(job.current_version + 1)
        job.last_modified_date = datetime.now()
        job.save()
        interval = schedule.get_interval()
        if interval:
            queue.enqueue_in(
                timedelta(seconds=interval),
                job_name,
                args=[task_parameters["parameters"]],
                job_timeout=current_app.config["SYNC_INTERVAL"],
                retry=Retry(max=3, interval=[10, 30, 60]),
            )
    except:
        job.complete = False
        job.endTime = datetime.now()
        job.info = job.info + [f"Job failed at {job.endTime}."]
        job.errors = job.errors + [str(format_exc())]
        job.jobStatus = Jobs.FAILED
        job.progress = 100.0
        job.current_version = int(job.current_version + 1)
        job.last_modified_date = datetime.now()
        job.save()
        traceback.print_exc()

    interval = schedule.get_interval()
    if interval:

        queue.enqueue_in(
            timedelta(seconds=interval),
            f"app.tasks.{job_name}",
            args=[task_parameters["parameters"]],
            job_timeout=current_app.config["SYNC_INTERVAL"],
            retry=Retry(max=3, interval=[10, 30, 60]),
        )


def upload_file_to_gdrive_handler(file_id, file_type="image", subfolder="default"):
    """
    Task to upload image files to google for persistence.
    'Handler' is added as a suffix to indicate that it is an
    event handler
    """
    job = log_job_details(
        "upload_file_to_gdrive",
        {"file_id": file_id, "file_type": file_type},
        schedule_id=0,
    )

    if file_type == "image":
        image = Images.get({"image_id": file_id})
        if image:
            gmail_account = GMailAccounts.get({"account_id": 1})
            try:
                gmail_helper = GmailHelper(
                    gmail_account.servers,
                    gmail_account.email_address,
                    linuxize_file(gmail_account.credential_file),
                    linuxize_file(gmail_account.token_file),
                )
                image_mime = {
                    "title": image.file_name,
                    "name": image.file_name,
                    "file_size": image.file_size,
                    "image_format": image.image_format,
                    "created_datetime": image.created_datetime.strftime(
                        "%Y%m%d_%H%M%S"
                    ),
                }

                current_directory = os.path.abspath(os.path.dirname(__file__))
                image_file_path = image.file_path
                index_of_static = image_file_path.replace("\\", "/").find("/static/")
                if index_of_static > -1:
                    image_file_path = (
                        current_directory
                        + os.sep
                        + image_file_path[index_of_static + 1 :].replace("\\", "/")
                    )
                image_type = "image/{}".format(image.image_format)
                upload_info = gmail_helper.upload_to_google(
                    image_file_path, image_mime, image_type, file_type, subfolder
                )

                old_image = image
                if upload_info:
                    image.google_id = upload_info["google_id"]
                    image.google_url = upload_info["google_url"]
                    image.save()
                    AuditTrail.log_to_trail(
                        {
                            "old_object": old_image,
                            "new_object": image,
                            "description": "Image uploaded to Google Drive",
                            "change_type": "UPDATE",
                            "object_type": "Image",
                            "user_id": str(0),
                            "username": "System",
                        }
                    )
                job.complete = True
                job.endTime = datetime.now()
                job.info = job.info + [
                    f"Job complete successfully at {job.endTime}. The file has been successfully uploaded with ID: {upload_info['google_id']} and URL:{upload_info['google_url']} "
                ]
                job.jobStatus = Jobs.SUCCEEDED
                job.progress = 100.0
                job.save()
            except Exception as e:
                traceback.print_exc()
                if job:
                    job = Jobs.get({"job_id": job.job_id})
                    job.complete = False
                    job.info = job.info + ["An error occured while upload card image "]
                    job.errors = job.errors.append(
                        datetime.now().strftime("%Y%m%d_%H%M%S") + ": " + str(e)
                    )
                    job.jobStatus = Jobs.FAILED
                    job.save()
    elif file_type == "file":
        file = Files.get({"file_id": file_id})
        if file:
            gmail_account = GMailAccounts.get({"account_id": 1})
            try:
                gmail_helper = GmailHelper(
                    gmail_account.servers,
                    gmail_account.email_address,
                    linuxize_file(gmail_account.credential_file),
                    linuxize_file(gmail_account.token_file),
                )
                file_mime = {
                    "title": file.file_name,
                    "name": file.file_name,
                    "file_size": file.file_size,
                    "file_format": file.file_format,
                    "created_datetime": file.created_datetime.strftime("%Y%m%d_%H%M%S"),
                }

                current_directory = os.path.abspath(os.path.dirname(__file__))
                file_path = file.file_path
                index_of_static = file_path.replace("\\", "/").find("/static/")
                if index_of_static > -1:
                    file_path = (
                        current_directory
                        + os.sep
                        + file_path[index_of_static + 1 :].replace("\\", "/")
                    )
                subfolder = Files.ATTACHMENTS
                file_type = ""
                upload_info = gmail_helper.upload_to_google(
                    file_path, file_mime, file.file_format, file_type, subfolder
                )

                old_file = file
                if upload_info:
                    file.google_id = upload_info["google_id"]
                    file.google_url = upload_info["google_url"]
                    file.save()
                    AuditTrail.log_to_trail(
                        {
                            "old_object": old_file,
                            "new_object": file,
                            "description": "File uploaded to Google Drive",
                            "change_type": "UPDATE",
                            "object_type": "File",
                            "user_id": str(0),
                            "username": "System",
                        }
                    )
                job.complete = True
                job.endTime = datetime.now()
                job.info = job.info + [
                    f"Job complete successfully at {job.endTime}. The file has been successfully uploaded with ID: {upload_info['google_id']} and URL:{upload_info['google_url']} "
                ]
                job.jobStatus = Jobs.SUCCEEDED
                job.progress = 100.0
                job.save()
            except Exception as e:
                traceback.print_exc()
                if job:
                    job = Jobs.get({"job_id": job.job_id})
                    job.complete = False
                    job.info = job.info + ["An error occured while upload card image "]
                    job.errors = job.errors.append(
                        datetime.now().strftime("%Y%m%d_%H%M%S") + ": " + str(e)
                    )
                    job.jobStatus = Jobs.FAILED
                    job.save()


def save_preformatted_page_handler(page_name, page_contents):
    """
    Save page contents.
    'Handler' is added as a suffix to indicate that it is an
    event handler
    """
    if page_name and page_contents:
        job = log_job_details(
            "upload_file_to_gdrive",
            {"page_name": page_name, "page_contents": page_contents},
            schedule_id=0,
        )

        current_directory = os.path.abspath(os.path.dirname(__file__))
        file_path = (
            current_directory
            + os.sep
            + "templates"
            + os.sep
            + "pages"
            + os.sep
            + "pre-formatted"
            + os.sep
            + f"{page_name}.html"
        )
        try:
            with open(file_path, "w") as file:
                file.write(page_contents)
            if job:
                job.complete = True
                job.endTime = datetime.now()
                job.info = job.info + [
                    f"Job complete successfully at {job.endTime}. The file has been successfully uploaded with ID: {upload_info['google_id']} and URL:{upload_info['google_url']} "
                ]
                job.jobStatus = Jobs.SUCCEEDED
                job.progress = 100.0
                job.save()
        except Exception as e:
            traceback.print_exc()
            if job:
                job = Jobs.get({"job_id": job.job_id})
                job.complete = False
                job.info = job.info + ["An error occured while upload card image "]
                job.errors = job.errors.append(
                    datetime.now().strftime("%Y%m%d_%H%M%S") + ": " + str(e)
                )
                job.jobStatus = Jobs.FAILED
                job.save()
