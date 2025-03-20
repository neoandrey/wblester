from flask import (
    render_template,
    flash,
    redirect,
    request,
    url_for,
    g,
    jsonify,
    current_app,
    abort,
    send_from_directory,
    session,
)
from werkzeug.utils import secure_filename
from app.models import (
    AuditTrail,
    Users,
    SiteSettings,
    Images,
    Roles,
    PageTemplates,
    Pages,
    Banners,
    Sliders,
    Files,
    MailTemplates,
    Messages,
    IMAPAccounts,
    GMailAccounts,
    # Sections,
    # TeamMembers,
    # Clients,
    #
    Events,
    EventTypes,
    Schedules,
    EventTriggers,
    Jobs,
)

import traceback, json, time, re, json, rq, os, re, random, inspect, stat

from flask_login import current_user, login_required, logout_user
from flask_babel import _  # , get_locale
from datetime import datetime, timedelta
from redis import Redis
import app.models as models
from app.gmailbox import GmailHelper

# from guess_language import guess_language
from app import db, settings, get_debug_template, csrf, cache, tasks  # ,socketio
from flask_mongoengine import BaseQuerySet

# from app.translate import translate
from app.cpanel import bp

from app.main.serializer import Serializer
from rq.job import Job
from PIL import Image, ImageFilter
from uuid import uuid4


def get_client_info(request):
    request_elements = {}
    request_elements["REMOTE_ADDR"] = request.environ.get("REMOTE_ADDR")
    request_elements["HTTP_SEC_CH_UA"] = request.environ.get("HTTP_SEC_CH_UA")
    request_elements["HTTP_SEC_CH_UA_MOBILE"] = request.environ.get(
        "HTTP_SEC_CH_UA_MOBILE"
    )
    request_elements["HTTP_SEC_CH_UA_PLATFORM"] = request.environ.get(
        "HTTP_SEC_CH_UA_PLATFORM"
    )
    return request_elements


def should_have_access(key_check):
    is_valid = True

    if "current_user" not in session:
        is_valid = False
    else:
        if "acky" not in session["current_user"]:
            is_valid = False  # return redirect(url_for("auth.admin_login"))
        elif session["current_user"]["acky"] != key_check:
            is_valid = False
    return is_valid


def convert_to_bool(value):
    return (
        value is not None
        and (str(value).strip != "" and str(value).lower() == "true")
        or (str(value).strip() == "1")
    )


def convert_to_type(image_path, image_type):
    """
    Convert uploaded images into profile images
    """
    with Image.open(image_path) as img:
        width = current_app.config["APP_CONFIG"][f"{image_type}_IMAGE_DIMENSIONS"][
            "width"
        ]
        height = current_app.config["APP_CONFIG"][f"{image_type}_IMAGE_DIMENSIONS"][
            "height"
        ]
        profile_image = img.resize((width, height))
        profile_image = profile_image.filter(ImageFilter.SHARPEN)
        profile_image = profile_image.filter(ImageFilter.EDGE_ENHANCE)
        profile_image = profile_image.filter(ImageFilter.SMOOTH)
        profile_image.save(image_path, quality=100, optimize=True)
        return profile_image.size


def format_data(data):
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


def get_aggregate_data(data, join_header):
    temp_data = {}
    for k, v in data.items():
        # print("k: ", k)
        if "password" in k:
            temp_data[k] = "*" * 12
        elif "date" in k or "time" in k:
            temp_data[k] = v.strftime("%Y-%m-%d %H:%M:%S")
        elif k in ["_id", "client", "profile_image"]:  # and isinstance(v, dict):
            temp_data[k] = str(v)  # str(v["$oid"]) if "$oid" in v else v
        elif k == join_header and isinstance(v, list) and len(v) > 0:
            temp_data[k] = get_aggregate_data(v[0], join_header)
        else:
            temp_data[k] = v
    return temp_data


def resize_image(image_path, dimensions, is_transparent=False):
    """
    Resize image to the dimensions specified
    """
    with Image.open(image_path) as img:
        width = int(str(dimensions["width"]).replace("px", ""))
        height = int(str(dimensions["height"]).replace("px", ""))
        new_image = img.resize((width, height))
        try:
            new_image = new_image.filter(ImageFilter.SHARPEN)
            new_image = new_image.filter(ImageFilter.EDGE_ENHANCE)
            new_image = new_image.filter(ImageFilter.SMOOTH)
            if is_transparent:
                img = new_image.convert("RGBA")
                datas = img.getdata()
                new_data = []
                for item in datas:
                    if item[0] == 255 and item[1] == 255 and item[2] == 255:
                        new_data.append((255, 255, 255, 0))
                    else:
                        new_data.append(item)
                new_image.putdata(new_data)
            new_image.save(image_path, quality=100, optimize=True)
        except:
            print("Image optimization failed")
        return new_image.size


def is_json(myjson):
    try:
        json.loads(myjson)
    except ValueError as e:
        return False
    return True


@bp.before_request
def make_session_permanent():
    session.permanent = True
    bp.permanent_session_lifetime = timedelta(
        minutes=current_app.config["SESSION_DURATION_MINS"]
    )


def format_data(data):
    if str(type(data)) == "datetime.datetime":
        return data.strftime("%Y%m%d_%H%M%S")
    elif str(type(data)) == "bson.objectid.ObjectId":
        return str(data)
    elif type(data) is dict:
        return json.dumps(data)
    elif type(data) is int:
        return int(data)
    else:
        return str(data)


def get_row_data(data):
    temp_data = {}
    for k, v in data.items():
        temp_data[k] = format_data(v)
    return temp_data


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


def get_found_records(data):
    """
    gets data after a 'collection.find' function has been run
    """
    results = []
    data = data.to_json()
    if len(data) > 0:
        for row in json.loads(data):
            temp_data = {}
            for k, v in row.items():
                #print(k,v)
                if "password" in k or "key" in  k:
                    temp_data[k] = "*" * 12
                elif "date" in k or ("time" in k and k != "time_out_minutes"):
                    temp_data[k] = (
                        (datetime.fromtimestamp(v["$date"] / 1000.0)).strftime(
                            "%Y-%m-%d %H:%M:%S"
                        )
                        if "$date" in v
                        else v
                    )
                elif k == "_id" and isinstance(v, dict):
                    temp_data[k] = str(v["$oid"]) if "$oid" in v else v
                else:
                    temp_data[k] = v
            results.append(temp_data)
    return results


@csrf.exempt
@bp.route("/cpanel/data/<table>", methods=["GET"])
# @cache.cached()
# @login_required
def cpanel_get_data(table):
    """
    Fetches Table Data
    """
    tables = []
    results = {}
    key = request.args.get("acky")
    if not should_have_access(key):
        expected_key = (
            session["current_user"]["acky"] if "current_user" in session else None
        )
        print(f"Invalid session key:{key}. Expected key: { expected_key}")
        return jsonify({"message": "Invalid Session Information"})
    # if "client_info" in session:
    #     client_info = get_client_info(request)
    #     if (
    #         (client_info["REMOTE_ADDR"] != session["client_info"]["REMOTE_ADDR"])
    #     ):
    #         return jsonify({"message": "Invalid Session Information"})
    if "+" in table:
        tables = table.split("+")
    else:
        tables.append(table)

    if "handlers" in tables:
        results["handlers"] = [
            handler for handler in dir(tasks) if "handler" in handler
        ]
        tables = [table for table in tables if table != "handlers"]
    for tab in tables:
        # print("fetching data for table: ",  tab)

        results[tab.lower()] = []
        table_key = tab.capitalize()
        for k in models.__dict__.keys():
            if k.lower() == tab.lower():
                table_key = k
                break
        collection = models.__dict__[table_key]
        query = request.args.get(tab.lower())

        # print("raw query: ", query.replace('"',''))
        # print("query is none: ", str(query).lower() == "none")

        if query == "{}":
            query = {}
        elif None is query or str(query).lower() == "none":
            query = {}
        elif str(query).lower() != "none":
            query = json.loads(query)
        elif type(query) == dict:
            for k, v in query.items():
                if "date" in k and type(v) == dict:
                    for x, y in v.items():
                        query[k][x] = datetime.strptime(
                            y, "%Y-%m-%d"
                        )  # f"ISODate('{y}')"

        # print("executing query: ", query)
        # print("query:",isinstance(query, dict))

        if query == "none":
            continue

        if isinstance(query, dict) and "lookup" not in query:
            data = collection.objects(__raw__=query)

            if data and len(data) > 0 and getattr(data, "to_json") is not None:
                data = data.to_json() if data else None
                data = json.loads(data)

            for row in data:
                temp_data = {}
                for k, v in row.items():
                    # print(k,v)
                    if "password" in k:
                        temp_data[k] = "*" * 12
                    elif "date" in k or "time" in k:
                        temp_data[k] = (
                            (datetime.fromtimestamp(v["$date"] / 1000.0)).strftime(
                                "%Y-%m-%d %H:%M:%S"
                            )
                            if isinstance(v, str) and "$date" in v
                            else v
                        )
                    elif k == "_id" and isinstance(v, dict):
                        temp_data[k] = str(v["$oid"]) if "$oid" in v else v
                    else:
                        temp_data[k] = v
                results[tab.lower()].append(temp_data)
        else:
            agg_filter = {}
            lookup = {}
            agg_filter[query["filterType"]] = query["filterExpression"]
            lookup = {
                "$lookup": {
                    "from": query["foreign"],
                    "localField": query["localField"],
                    "foreignField": query["foreignField"],
                    "as": query["header"],
                }
            }
            if tab in ["clientpersonalinformation", "clienttravelinformation"]:
                collection = models.__dict__["Clients"]
            pipeline = [agg_filter, lookup]
            data = collection.objects().aggregate(pipeline)
            data = list(data)
            data = data[-1] if len(data) > 1 else data[0]
            if data:
                temp_data = get_aggregate_data(data, query["header"])
                results[tab.lower()].append(temp_data)
    return jsonify(results)


@csrf.exempt
@bp.route("/cpanel/oldsync/<table>", methods=["GET"])
@bp.route("/cpanel/oldsync/<table>/<max_id>", methods=["GET"])
# @cache.cached()
# @login_required
def get_table_data(table, max_id=None):
    data = []
    results = []
    collection = (
        models.__dict__[table] if table in list(models.__dict__.keys()) else None
    )
    if collection:
        sync_info = [
            info
            for info in current_app.config["COMPONENT_CONFIG"]["syncInfo"]["cpanel"]
            if info["collectionName"] == table
        ]
        if len(sync_info) > 0:
            selector = sync_info[0]["selector"]
            if len(selector.keys()) > 0:
                data = collection.find(selector)
            else:
                if max_id:
                    temp_data = {}
                    id_field = sync_info[0]["idField"]
                    max_id = int(max_id)
                    id_field = f"{id_field}__gt"
                    temp_data[id_field] = max_id
                    data = collection.find(temp_data)
                    data = [entry.to_json() for entry in data]

                else:
                    data = collection.find()
                    if len(data) > 0:
                        data = [entry.to_json() for entry in data]
                for entry in data:
                    temp_data = {}
                    data_info = json.loads(entry)  # if  type(entry) is str else entry
                    for k, v in data_info.items():
                        if k == "_id":
                            temp_data[k] = str(v["$oid"]) if "$oid" in v else v
                        elif "date" in k or "time" in k:
                            temp_data[k] = (
                                (datetime.fromtimestamp(v["$date"] / 1000.0)).strftime(
                                    "%Y-%m-%d %H:%M:%S"
                                )
                                if "$date" in v
                                else v
                            )
                        else:
                            temp_data[k] = v
                    results.append(temp_data)
        else:
            results = []
    else:
        results = []
    return jsonify(results)


@csrf.exempt
@bp.route("/cpanel/add/<data_type>", methods=["POST"])
# @login_required
def add_record(data_type):
    """
    Manage record storage
    """
    # for item in request.form:
    #    print(item + ": " + request.form.get(item))
    check_key = request.form.get("acky")
    # print(f"key: {check_key}")
    # access_check = should_have_access(check_key)
    # print(f"access_check: {access_check}")
    if should_have_access(check_key) is False:
        # expected_key = session["current_user"]["acky"]
        # print(f"Invalid session key: {check_key} , Expected key: { expected_key}")
        return jsonify({"message": "Invalid Session Information"})
    # if "client_info" in session:
    #     client_info =  get_client_info(request)
    #     if( 
    #     (client_info['REMOTE_ADDR'] != session['client_info']['REMOTE_ADDR']) ):
    #         return jsonify({"message": "Invalid Session Information"})
    count = current_app.config["CIPHER_COUNT"]
    mode = request.form.get("mode")
    key_maker = Serializer()
    error_message = None
    # try:
    if mode == "new":
        if data_type == "users":
            username = request.form.get("username")
            password = None
            locked = request.form.get("locked")
            locked = convert_to_bool(locked)
            active = request.form.get("active")
            active = convert_to_bool(active)
            role_id = request.form.get("role")
            password = request.form.get("password")
            existing_user = Users.get({"username": username})
            email = request.form.get("email")

            if not existing_user:
                user_id = Users.get_next("user_id")
                if user_id == 1:
                    role_id = 1  # sysadmin

                user = Users(
                    id=user_id,
                    user_id=user_id,
                    username=username.lower().strip(),
                    creationDate=datetime.now(),
                    locked=locked,
                    role_id=int(role_id),
                    email=email,
                    connectionStatus=False,
                    active=active,
                    lastModifiedDate=datetime.now(),
                    loginCount=0,
                )
                user.set_password(password)
                user.save()
                user.passwordHash = "***********************"
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": user,
                        "description": "New record added to Users",
                        "change_type": "INSERT",
                        "object_type": "Users",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                return jsonify({"message": "User account created successfully"})
            else:
                error_message = "User account already exists."
                return jsonify(
                    {
                        "message": "Account could not be created",
                        "error": error_message,
                    }
                )
        elif data_type == "roles":
            role_name = request.form.get("role_name")
            role_description = request.form.get("description")
            status = request.form.get("status")
            role = Roles.get({"role_name": role_name})
            is_existing_role = True if role else False
            if not is_existing_role:
                role_id = Roles.get_next("role_id")
                role = Roles(
                    role_id=role_id,
                    role_name=role_name.strip(),
                    description=role_description.strip(),
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                role.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": role,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Role",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Role created successfully"})
            return jsonify({"message": "Role already exists"})
        elif data_type == "images":
            image_name = request.form.get("image_name")
            image_updated = request.form.get("image_updated")
            image_file = request.files.get("image_file") if image_updated else None
            file_name = image_file.filename.split(os.sep)[-1] if image_file else None
            image_format = file_name.split(".")[-1]
            image_size = request.form.get("size")
            image_type = request.form.get("image_type")
            file_type = request.form.get("type")
            transparent_background = convert_to_bool(
                request.form.get("transparent_background")
            )
            image_last_modified = request.form.get("lastModified")
            image_webkit_relative_path = request.form.get("webkitRelativePath")
            image_dimensions = request.form.get("image_dimensions")
            filename = secure_filename(image_file.filename)
            image_file_name = image_file.filename.split(os.sep)[-1]
            filename = filename.split(os.sep)[-1]
            if filename != "":
                # print(filename)
                file_ext = os.path.splitext(filename)[1].replace(".", "")
                if file_ext not in current_app.config["IMAGE_FORMATS"]:
                    print("File extension is not valid: " + file_ext)
                    abort(400)
            image_path = os.path.join(
                current_app.config["IMAGE_UPLOAD_DIRECTORY"]
                + os.sep
                + image_type.upper()
                + os.sep
                + datetime.now().strftime("%Y%m%d")
            )
            try:
                if not os.path.exists(image_path):
                    os.makedirs(image_path)
                    os.chmod(image_path, stat.S_IWRITE)
            except Exception as _:
                traceback.print_exc()
            upload_directory = image_path  # .replace("\\","\\\\"))
            filepath = os.path.join(upload_directory, image_file_name)
            existing_image = Images.get({"file_path": filepath})
            folders = filepath.split(os.sep)
            index_of_static = folders.index("static")
            url_folders = folders[index_of_static:]
            image_url = "/" + "/".join(url_folders)

            image_check = True if existing_image else False
            if not image_check:
                image_id = Images.get_next("image_id")
                image = Images(
                    image_id=image_id,
                    image_name=image_name,
                    file_name=image_file_name,
                    image_format=image_format,
                    file_path=filepath,
                    file_size=image_size,
                    image_type=image_type,
                    file_type=file_type,
                    image_last_modified=image_last_modified,
                    image_dimensions=image_dimensions,
                    image_url=image_url,
                    transparent_background=transparent_background,
                    webkit_relative_path=image_webkit_relative_path,
                    google_file_id=str(image_id),
                    google_url=image_url,
                    created_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )

                image_file.save(image.file_path)
                image.save()
                resize_image(
                    image.file_path,
                    json.loads(image_dimensions),
                    transparent_background,
                )
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "System"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": image,
                        "description": "New record added to Images",
                        "change_type": "INSERT",
                        "object_type": "Image",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                queue = rq.Queue(
                    current_app.config["REDIS_QUEUE_NAME"], connection=current_app.redis
                )
                queue.enqueue(
                    "app.tasks.upload_file_to_gdrive",
                    args=[image.image_id, "image", image.image_name],
                    timeout=current_app.config["SYNC_INTERVAL"],
                )
                return jsonify({"message": "Image created successfully"})
            else:
                return jsonify(
                    {"message": "Image Creation Failed", "error": error_message}
                )
        elif data_type == "files":

            file_name = request.form.get("file_name")
            file_updated = request.form.get("file_updated")
            uploaded_file = request.files.get("uploaded_file") if file_updated else None
            actual_file_name = (
                uploaded_file.filename.split(os.sep)[-1] if uploaded_file else None
            )
            file_format = file_name.split(".")[-1]
            file_size = request.form.get("size")
            file_type = request.form.get("type")
            file_last_modified = request.form.get("lastModified")
            file_webkit_relative_path = request.form.get("webkitRelativePath")
            filename = secure_filename(uploaded_file.filename)
            filename = filename.split(os.sep)[-1]

            if filename != "":
                file_ext = os.path.splitext(filename)[1].replace(".", "")
                valid_formats = (
                    current_app.config["FILE_FORMATS"]
                    + current_app.config["IMAGE_FORMATS"]
                )
                valid_formats = [file_format.lower() for file_format in valid_formats]
                if file_ext.lower() not in valid_formats:
                    print("File extension is not valid: " + file_ext)
                    abort(400)
            file_path = os.path.join(
                current_app.config["FILE_UPLOAD_DIRECTORY"]
                + os.sep
                + file_type.upper()
                + os.sep
                + datetime.now().strftime("%Y%m%d")
            )
            try:
                if not os.path.exists(file_path):
                    os.makedirs(file_path)
                    os.chmod(file_path, stat.S_IWRITE)
            except Exception as _:
                traceback.print_exc()
            upload_directory = file_path  # .replace("\\","\\\\"))
            filepath = os.path.join(upload_directory, actual_file_name)
            existing_file = Files.get({"file_path": filepath})
            folders = filepath.split(os.sep)
            index_of_static = folders.index("static")
            url_folders = folders[index_of_static:]
            file_url = "/" + "/".join(url_folders)

            file_check = True if existing_file else False
            if not file_check:
                file_id = Files.get_next("file_id")
                file = Files(
                    file_id=file_id,
                    file_name=file_name,
                    actual_file_name=actual_file_name,
                    file_format=file_format,
                    file_path=filepath,
                    file_size=file_size,
                    file_type=file_type,
                    file_last_modified=file_last_modified,
                    file_url=file_url,
                    webkit_relative_path=file_webkit_relative_path,
                    google_file_id=str(file_id),
                    google_url=file_url,
                    created_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )

                uploaded_file.save(file.file_path)
                file.save()

                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "System"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": file,
                        "description": "New record added to Files",
                        "change_type": "INSERT",
                        "object_type": "Creator",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                queue = rq.Queue(
                    current_app.config["REDIS_QUEUE_NAME"], connection=current_app.redis
                )
                queue.enqueue(
                    "app.tasks.upload_file_to_gdrive",
                    args=[file.file_id, "file", file.file_name],
                    job_timeout=current_app.config["SYNC_INTERVAL"],
                )
                return jsonify({"message": "Image created successfully"})
            else:
                return jsonify(
                    {"message": "Image Creation Failed", "error": error_message}
                )
        elif data_type == "pagetemplates":
            name = request.form.get("name")
            # print(name)
            description = request.form.get("description")
            contents = request.form.get("contents")
            template = PageTemplates.get({"name": name})
            is_existing_template = True if template else False
            if not is_existing_template:
                template_id = PageTemplates.get_next("template_id")
                template = PageTemplates(
                    template_id=template_id,
                    name=name.strip(),
                    description=description.strip(),
                    contents=contents.strip(),
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                template.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": template,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Template",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Template created successfully"})
            return jsonify({"message": "Template already exists"})
        elif data_type == "mailtemplates":
            name = request.form.get("name")
            # print(name)
            description = request.form.get("description")
            contents = request.form.get("contents")
            template = MailTemplates.get({"name": name})
            is_existing_template = True if template else False
            if not is_existing_template:
                template_id = MailTemplates.get_next("template_id")
                template = MailTemplates(
                    template_id=template_id,
                    name=name.strip(),
                    description=description.strip(),
                    contents=contents.strip(),
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                template.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": template,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "MailTemplate",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "MailTemplate created successfully"})
            return jsonify({"message": "MailTemplate already exists"})
        elif data_type == "pages":
            page_name = request.form.get("page_name")
            is_child = convert_to_bool(request.form.get("is_child"))
            is_nav_page = convert_to_bool(request.form.get("is_nav_page"))
            comes_after = request.form.get("comes_after")
            href = request.form.get("href")
            is_home_page = convert_to_bool(request.form.get("is_home_page"))
            parent_page_id = request.form.get("parent_page_id")
            page_type = request.form.get("page_type")
            banner_type =  request.form.get("banner_type")
            contents = request.form.get("contents")
            banner_id = request.form.get("banner_id")
            template_name = request.form.get("template_name")
            # is_restricted = convert_to_bool(request.form.get("is_restricted"))
            existing_page = Pages.get({"page_name": page_name})
            parent_page = None
            banner = None
            template = None

            if parent_page_id:
                parent_page = Pages.get({"page_id": parent_page_id})
                if parent_page:
                    parent_page.is_parent = True
                    parent_page.save()
            template = None
            if banner_id and int(banner_id) !=0:
                banner = Banners.get({"banner_id": int(banner_id)})
            if template_name and template_name != "None":
                template = PageTemplates.get({"name": template_name})
            page_check = True if existing_page else False
            if not page_check:
                page_id = Pages.get_next("page_id")
                page = Pages(
                    page_id=page_id,
                    page_name=page_name,
                    is_child=is_child,
                    is_nav_page=is_nav_page,
                    banner_type = banner_type,
                    comes_after=comes_after,
                    href=href,
                    is_home_page=is_home_page,
                    parent_page=parent_page,
                    page_type=page_type,
                    contents=contents,
                    banner=banner,
                    template = template,
                    created_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )

                page.save()

                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "System"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": page,
                        "description": "New record added to Pages",
                        "change_type": "INSERT",
                        "object_type": "Creator",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Page created successfully"})

            return jsonify(
                {"message": "Page Creation Failed", "error": error_message}
            )
        elif data_type == "sections":
            name = request.form.get("name")
            description = request.form.get("description")
            pages = request.form.get("pages")
            if pages:
                pages = json.loads(pages)
                pages = [Pages.get({"page_id": p}) for p in pages]
            section = Sections.get({"section_name": name})

            is_existing_section = True if section else False
            if not is_existing_section:
                section_id = Sections.get_next("section_id")
                section = Sections(
                    section_id=section_id,
                    name=name.strip(),
                    description=description.strip(),
                    pages=pages,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                section.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": section,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Section",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Section created successfully"})
            return jsonify({"message": "Section already exists"})
        elif data_type == "teammembers":
            # member_id = request.form.get("member_id")
            name = request.form.get("name")
            role = request.form.get("role")
            description = request.form.get("description")
            social_media = request.form.get("social_media")
            if social_media and len(social_media) > 0:
                social_media = json.loads(social_media)
            else:
                social_media = None
            image_google_url = request.form.get("image")
            image = Images.get({"google_url": image_google_url})
            teammember = TeamMembers.get({"name": name})
            is_existing_teammember = True if teammember else False
            if not is_existing_teammember:
                member_id = TeamMembers.get_next("teammember_id")
                teammember = TeamMembers(
                    member_id=member_id,
                    name=str(name).strip(),
                    role=role.strip(),
                    description=description.strip(),
                    social_media=social_media,
                    image=image,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                teammember.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": teammember,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "TeamMember",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "TeamMember created successfully"})
            return jsonify({"message": "TeamMember already exists"})
        elif data_type == "clients":
            first_name = request.form.get("first_name")
            last_name = request.form.get("last_name")
            email_address = request.form.get("email_address")
            address = request.form.get("address")
            date_of_birth = request.form.get("date_of_birth")
            phone_number = request.form.get("phone_number")
            status = request.form.get("status")
            profile_image = request.form.get("profile_image")
            password = request.form.get("password")
            profile_image = Images.get({"google_url": profile_image})
            client = Clients.get({"email_address": email_address})
            is_existing_client = True if client else False
            if not is_existing_client:
                client_id = Clients.get_next("client_id")
                client = Clients(
                    client_id=client_id,
                    user_id=client_id,
                    first_name=str(first_name).strip(),
                    last_name=str(last_name).strip(),
                    email_address=email_address.strip(),
                    address=address,
                    date_of_birth=date_of_birth,
                    phone_number=phone_number,
                    status=int(status),
                    profile_image=profile_image,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                client.set_password(password)
                client.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": client,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Client",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Client created successfully"})
            return jsonify({"message": "Client already exists"})
        elif data_type == "imap":
            imap_server_address = request.form.get("imap_server_address")
            account_name = request.form.get("account_name")
            imap_username = request.form.get("imap_username")
            imap_password = request.form.get("imap_password")
            imap_security = request.form.get("imap_security")
            imap_port = request.form.get("imap_port")
            imap_account_check = IMAPAccounts.get(
                {"imap_server_address": imap_server_address}
            )

            is_existing_account = True if imap_account_check else False
            if not is_existing_account:
                account_id = IMAPAccounts.get_record_count() + 1
                imap_account = IMAPAccounts(
                    account_id=account_id,
                    account_name=account_name,
                    imap_server_address=imap_server_address,
                    imap_username=imap_username,
                    imap_password=key_maker.multiCrypt(imap_password, count),
                    imap_security=imap_security,
                    imap_port=imap_port,
                    created_datetime=datetime.now(),
                )
                imap_account.save()
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": imap_account,
                        "description": f"New {data_type} record added",
                        "change_type": "INSERT",
                        "object_type": "IMAP Account",
                        "user_id": str(current_user.id),
                        "username": current_user.username,
                    }
                )
                return jsonify({"message": "Email Account successfully added."})
            else:
                return jsonify({"message": "Email Account already exists"})
        elif data_type == "gmail":
            credentials_file = request.files.get("crendentials")
            email_address = request.form.get("gmail_email_address")
            gmail_servers = request.form.get("gmail_server_address")
            api_key = request.form.get("gmail_api_key")
            account_name = request.form.get("gmail_account_name")
            filename = secure_filename(credentials_file.filename)
            if filename != "":
                keystore_path = current_app.config["KEY_PATH"]
                try:
                    if not os.path.exists(keystore_path):
                        os.makedirs(keystore_path)
                        os.chmod(keystore_path, stat.S_IWRITE)
                except Exception as _:
                    traceback.print_exc()
                cred_path = os.path.join(keystore_path, filename)
                tok_path = cred_path + ".token.pickle"
                account_check = GMailAccounts.get({"credential_file": cred_path})
                account_check = True if account_check else False

                if not account_check:
                    credentials_file.save(cred_path)
                    gmailHelper = GmailHelper(
                        gmail_servers, email_address, cred_path, tok_path
                    )
                    gmailHelper.gmail_authenticate()
                    id = GMailAccounts.get_record_count() + 1
                    gmailAccount = GMailAccounts(
                        account_id=id,
                        account_name=account_name,
                        email_address=email_address,
                        api_key=key_maker.multiCrypt(api_key, count),
                        servers=gmail_servers,
                        credential_file=cred_path,
                        token_file=tok_path,
                        created_datetime=datetime.utcnow(),
                    )
                    gmailAccount.save()
                    AuditTrail.log_to_trail(
                        {
                            "old_object": None,
                            "new_object": gmailAccount,
                            "description": f"New {data_type} record added",
                            "change_type": "INSERT",
                            "object_type": "Gmail Account",
                            "user_id": str(current_user.id),
                            "username": current_user.username,
                        }
                    )
                    return jsonify({"message": "GMail account successfully added."})
                else:
                    return jsonify({"message": "GMail account already exists."})
        elif data_type == "banners":
            name        = request.form.get("name")
            title       = request.form.get("title")
            image_url   = request.form.get("image_url")
            is_active   = request.form.get("is_active")
            is_active   = convert_to_bool(is_active)
            page_links  = request.form.get("page_links")
            if page_links and len(page_links) > 0:
                page_links = json.loads(page_links)
            else:
                page_links = None
            # if is_active:
            #     for bnr in Banners.objects():
            #         bnr.is_active = False

            banner = Banners.get({"name": name})
            is_existing_banner = True if banner else False

            image = None
            if image_url:
                image = Images.get({"google_url": image_url})
            if not is_existing_banner:

                banner_id = Banners.get_next("banner_id")
                banner = Banners(
                    banner_id=banner_id,
                    name=name.strip(),
                    title=title.strip(),
                    image=image,
                    is_active=is_active,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    page_links=page_links,
                    current_version=0,
                )

                banner.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": banner,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Banner",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Banner created successfully"})
            return jsonify({"message": "Banner already exists"})
        elif data_type == "sliders":
            name             = request.form.get("name")
            line1            = request.form.get("line1")
            line2            = request.form.get("line2")
            image_url        = request.form.get("image_url")
            is_active        = request.form.get("is_active")
            is_active        = convert_to_bool(is_active)
            slider = Sliders.get({"name": name})
            is_existing_slider = True if slider else False

            image = None
            if image_url:
                image = Images.get({"google_url": image_url})
            if not is_existing_slider:

                slider_id = Sliders.get_next("slider_id")

                slider = Sliders(
                    slider_id=slider_id,
                    name=name.strip(),
                    line1=line1.strip(),
                    line2 = line2.strip(),
                    image=image,
                    is_active=is_active,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0
                )

                slider.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": slider,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Slider",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Slider created successfully"})
            return jsonify({"message": "Slider already exists"})
        elif data_type == "eventtypes":
            type_name = request.form.get("type_name")
            description = request.form.get("description")
            handler = request.form.get("handler")
            template_id = request.form.get("template_id")
            event_type = EventTypes.get({"type_name": type_name})
            is_existing_type = True if event_type else False
            template = None
            if template_id and int(template_id) != -1:
                template = MailTemplates.get({"template_id": int(template_id)})
            if not is_existing_type:

                type_id = EventTypes.get_next("type_id")
                event_type = EventTypes(
                    type_id=type_id,
                    type_name=type_name.strip(),
                    description=description.strip(),
                    handler=handler.strip(),
                    template=template,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                event_type.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": event_type,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "EventTypes",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "EventType created successfully"})
            return jsonify({"message": "EventType already exists"})
        elif data_type == "schedules":

            name = request.form.get("schedule_name")
            description = request.form.get("schedule_description")
            start_time = request.form.get("start_time")
            status = request.form.get("schedule_status")
            repeat = request.form.get("schedule_repeat")
            months = request.form.get("months")
            weeks = request.form.get("weeks")
            hours = request.form.get("hours")
            minutes = request.form.get("minutes")
            seconds = request.form.get("seconds")
            repeat = 0 if repeat.lower() == "none" else repeat
            # print("Variables initialized")
            status = (
                Schedules.ACTIVE
                if str(status).lower() == "active"
                else Schedules.DISABLED
            )
            if str(repeat).lower() == "yearly":
                repeat = 3600 * 24 * 30 * 12
            elif str(repeat).lower() == "quarterly":
                repeat = 3600 * 24 * 30 * 3
            elif str(repeat).lower() == "monthly":
                repeat = 3600 * 24 * 30
            elif str(repeat).lower() == "weekly":
                repeat = 3600 * 24 * 7
            elif str(repeat).lower() == "bi-weekly":
                repeat = 3600 * 24 * 7 * 2
            elif str(repeat).lower() == "daily":
                repeat = 3600 * 24
            elif str(repeat).lower() == "hourly":
                repeat = 3600
            elif str(repeat).lower() == "none":
                repeat = 9999999999
            schedule_check = Schedules.get({"name": name})
            is_existing_account = True if schedule_check else False
            if not is_existing_account:
                id = Schedules.get_record_count() + 1
                schedule = Schedules(
                    schedule_id=id,
                    name=name,
                    description=description,
                    start_time=start_time,
                    schedule_status=status,
                    repeat=repeat,
                    months=months,
                    weeks=weeks,
                    hours=hours,
                    minutes=minutes,
                    seconds=seconds,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                schedule.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": schedule,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Schedules",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify(
                    {"message": "A new Schedule has been created successfully"}
                )
            return jsonify(
                {
                    "message": "A new Schedule could not be created with the given parameters"
                }
            )
        elif data_type == "eventtriggers":
            trigger_name = request.form.get("trigger_name")
            description = request.form.get("description")
            event_type_id = request.form.get("event_type")
            schedule_id = request.form.get("schedule")
            parameters = request.form.get("parameters")
            event_type = None
            schedule = None
            trigger = EventTriggers.get({"trigger_name": trigger_name})
            if event_type_id:
                event_type = EventTypes.get({"type_id": int(event_type_id)})
            if schedule_id:
                schedule = Schedules.get({"schedule_id": int(schedule_id)})
            if parameters:
                parameters = json.loads(parameters)

            is_existing_trigger = True if trigger else False

            for data in request.form:
                print(data)
                print(request.form.get(data))

            if not is_existing_trigger:
                trigger_id = EventTriggers.get_next("trigger_id")
                trigger = EventTriggers(
                    trigger_id=trigger_id,
                    trigger_name=trigger_name.strip(),
                    description=description.strip(),
                    event_type=event_type,
                    parameters=parameters,
                    schedule=schedule,
                    trigger_count=0,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                trigger.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": trigger,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "EventTrigger",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                parameters["trigger_id"] = trigger_id
                parameters["start"] = True
                Events.create(parameters)
                return jsonify({"message": "Event Trigger created successfully"})
            return jsonify({"message": "Event Trigger already exists"})

    elif mode == "edit":
        if data_type == "sitesettings":
            settings_id = 1
            site_name = request.form.get("site_name")
            site_id = request.form.get("site_id")
            site_title = request.form.get("site_title")
            site_description = request.form.get("site_description")
            site_keywords = request.form.get("site_keywords")
            site_logo = request.form.get("site_logo")
            site_icon = request.form.get("site_icon")
            login_image = request.form.get("login_image")
            startup_message = request.form.get("startup_message")
            secret_key = request.form.get("secret_key")
            address = request.form.get("address")
            email = request.form.get("email")
            phone_number = request.form.get("phone_number")
            google_map = request.form.get("google_map")
            social_media = request.form.get("social_media")
            contact_us_message = request.form.get("contact_us_message")
            default_mailing_account = request.form.get("default_mailing_account")
            if social_media and len(social_media) > 0:
                social_media = json.loads(social_media)
            else:
                social_media = None
            sync_mode = request.form.get("sync_mode")
            if sync_mode and len(sync_mode) > 0:
                sync_mode = int(sync_mode)
            time_out_minutes = request.form.get("time_out_minutes")
            if time_out_minutes and len(time_out_minutes) > 0:
                time_out_minutes = int(time_out_minutes)
            overrides = request.form.get("overrides")
            if overrides and len(overrides) > 0:
                overrides = json.loads(overrides)
            else:
                overrides = None
            site_settings = SiteSettings.get({"settings_id": settings_id})

            if not site_settings:
                site_settings = SiteSettings(
                    settings_id=settings_id,
                    site_name=site_name,
                    site_id=site_id,
                    site_title=site_title,
                    site_icon=site_icon,
                    site_logo=site_logo,
                    site_description=site_description,
                    login_image=login_image,
                    site_keywords=site_keywords,
                    startup_message=startup_message,
                    secret_key=secret_key,
                    address=address,
                    email=email,
                    phone_number=phone_number,
                    google_map=google_map,
                    social_media=social_media,
                    sync_mode=sync_mode,
                    time_out_minutes=time_out_minutes,
                    overrides=overrides,
                    default_mailing_account=default_mailing_account,
                    contact_us_message=contact_us_message,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )

            else:
                site_settings.site_name = site_name
                site_settings.site_id = site_id
                site_settings.site_title = site_title
                site_settings.site_description = site_description
                site_settings.site_keywords = site_keywords
                site_settings.startup_message = startup_message
                site_settings.secret_key = secret_key
                site_settings.address = address
                site_settings.email = email
                site_settings.site_icon = site_icon
                site_settings.site_logo = site_logo
                site_settings.login_image = login_image
                site_settings.phone_number = phone_number
                site_settings.google_map = google_map
                site_settings.social_media = social_media
                site_settings.sync_mode = sync_mode
                site_settings.time_out_minutes = time_out_minutes
                site_settings.overrides = overrides
                site_settings.contact_us_message = contact_us_message
                site_settings.default_mailing_account = default_mailing_account
                for k, v in overrides.items():
                    if k.lower() in site_settings:
                        site_settings[k.lower()] = json.loads(v) if is_json(v) else v
                site_settings.last_modified_date = datetime.now()
                site_settings.current_version = site_settings.current_version + 1

            site_settings.save()
            user_id = (
                session["current_user"].user_id
                if "current_user" in session.keys() and session["current_user"].user_id
                else 0
            )
            user_name = (
                current_user.username
                if "current_user" in session.keys() and current_user.username
                else "system"
            )
            AuditTrail.log_to_trail(
                {
                    "old_object": None,
                    "new_object": site_settings,
                    "description": "SiteSettings record created",
                    "change_type": "INSERT",
                    "object_type": "SiteSettings",
                    "user_id": str(user_id),
                    "username": user_name,
                }
            )
            return jsonify({"message": "Settings have been updated successfully"})
        elif data_type == "users":
            username = request.form.get("username")
            password = None
            user_id = request.form.get("user_id")
            locked = request.form.get("locked")
            active = request.form.get("active")
            role_id = request.form.get("role")
            email = request.form.get("email")
            locked = convert_to_bool(locked)
            active = convert_to_bool(active)
            password_changed = request.form.get("passwordChanged")
            if str(password_changed) == "true":
                password = request.form.get("password")
            existing_user = Users.get({"user_id": user_id})
            old_user = existing_user
            if (existing_user.locked and not locked) or (
                not existing_user.active and active
            ):
                existing_user.login_attempts = 0
            if existing_user:
                existing_user.locked = locked
                existing_user.role_id = int(role_id)
                existing_user.active = active
                if email and email != "":
                    existing_user.email = email
                existing_user.lastModifiedDate = datetime.now
                if str(password_changed) == "true":
                    existing_user.set_password(password)
                existing_user.current_version = int(existing_user.current_version) + 1
                existing_user.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "System"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": old_user,
                        "new_object": existing_user,
                        "description": f"Record with ID: {user_id} updated.",
                        "change_type": "UPDATE",
                        "object_type": "Users",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                return jsonify({"message": "User account updated successfully"})
            else:
                return jsonify({"message": "User account could not be updated."})
        elif data_type == "roles":
            role_id = request.form.get("role_id")
            role_name = request.form.get("role_name")
            role_description = request.form.get("description")
            status = request.form.get("status")
            role = Roles.get({"role_id": role_id})
            is_existing_role = True if role else False
            if is_existing_role:

                role.role_name = role_name.strip()
                role.description = role_description.strip()
                role.last_modified_date = datetime.now()
                role.current_version = int(role.current_version) + 1

                role.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": role,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Role",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Role updated successfully"})
            return jsonify({"message": "Role could not be updated"})
        elif data_type == "banners":
            banner_id = request.form.get("banner_id")
            name = request.form.get("name")
            title = request.form.get("title")
            image_url = request.form.get("image_url")
            is_active = request.form.get("is_active")
            page_links = request.form.get("page_links")
            is_active = convert_to_bool(is_active)
            if page_links and len(page_links) > 0:
                page_links = json.loads(page_links)
            else:
                page_links = None
            image = None
            if image_url:
                image = Images.get({"google_url": image_url})
            banner = Banners.get({"banner_id": banner_id})
            is_existing_banner = True if banner else False
            if is_existing_banner:
                banner.name = name.strip()
                banner.title = title.strip()
                banner.image = image
                banner.page_links =  page_links
                banner.is_active = is_active
                banner.last_modified_date = datetime.now()
                banner.current_version = int(banner.current_version) + 1

                banner.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": banner,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Banner",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Banner updated successfully"})
            return jsonify({"message": "Banner could not be updated"})
        elif data_type == "sliders":
            slider_id  = request.form.get("slider_id")
            name       = request.form.get("name")
            line1      = request.form.get("line1")
            line2      = request.form.get("line2")     
            image_url  = request.form.get("image_url")
            is_active  = request.form.get("is_active")
            is_active  = convert_to_bool(is_active)
            image      = None
            if image_url:
                image = Images.get({"google_url": image_url})
            slider = Sliders.get({"slider_id": slider_id})
            is_existing_slider = True if slider else False
            if is_existing_slider:
                slider.name = name.strip()
                slider.title = title.strip()
                slider.line1 = line1.strip()
                slider.line2 = line2.strip()
                slider.image = image
                slider.is_active = is_active
                slider.last_modified_date = datetime.now()
                slider.current_version = int(slider.current_version) + 1
                slider.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": slider,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Slider",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Slider updated successfully"})
            return jsonify({"message": "Slider could not be updated"})
        elif data_type == "images":

            image_updated = request.form.get("image_updated")
            image_id = request.form.get("image_id")
            image_name = request.form.get("image_name")
            image_file = request.files.get("image_file") if image_updated else None
            file_name = image_file.filename.split(os.sep)[-1] if image_file else None
            image_format = file_name.split(".")[-1] if file_name else None
            image_size = request.form.get("size")
            image_type = request.form.get("image_type")
            file_type = request.form.get("type")
            image_last_modified = request.form.get("lastModified")
            image_webkit_relative_path = request.form.get("webkitRelativePath")
            image_dimensions = request.form.get("image_dimensions")
            transparent_background = convert_to_bool(
                request.form.get("transparent_background")
            )
            image = None
            image = Images.get({"image_id": image_id})
            image_file_name = None
            if image_file:
                filename = secure_filename(image_file.filename)
                image_file_name = image_file.filename.split(os.sep)[-1]
                filename = filename.split(os.sep)[-1]
                if filename != "":
                    file_ext = os.path.splitext(filename)[1].replace(".", "")
                    if file_ext not in current_app.config["IMAGE_FORMATS"]:
                        print("File extension is not valid: " + file_ext)
                        abort(400)
                image_path = os.path.join(
                    current_app.config["IMAGE_UPLOAD_DIRECTORY"]
                    + os.sep
                    + image_type.upper()
                    + os.sep
                    + datetime.now().strftime("%Y%m%d")
                )
                try:
                    if not os.path.exists(image_path):
                        os.makedirs(image_path)
                        os.chmod(image_path, stat.S_IWRITE)
                except Exception as _:
                    traceback.print_exc()

                upload_directory = image_path  # .replace("\\","\\\\"))
                filepath = os.path.join(upload_directory, image_file_name)
                folders = filepath.split(os.sep)
                index_of_static = folders.index("static")
                url_folders = folders[index_of_static:]
                image_url = "/" + "/".join(url_folders)

            image_check = True if image else False
            if image_check:

                # image.image_name = image_name
                if str(image_updated).lower() == "true":
                    image.file_name = (
                        image_file_name if image_file_name else image.file_name
                    )
                    image.image_format = (
                        image_format if image_format else image.image_format
                    )
                    image.file_path = filepath if filepath else image.file_path
                    image.file_size = image_size if image_size else image.file_size
                    image.image_type = image_type if image_type else image.image_type
                    image.file_type = file_type if file_type else image.file_type
                    image.image_last_modified = (
                        image_last_modified
                        if image_last_modified
                        else image.image_last_modified
                    )
                    image.image_url = image_url if image_url else image.image_url
                    image.google_url = image_url
                    image.webkit_relative_path = (
                        image_webkit_relative_path
                        if image_webkit_relative_path
                        else image.webkit_relative_path
                    )
                    image.transparent_background = transparent_background
                    image_file.save(image.file_path)
                    image_dimensions = image_dimensions.replace("'", '"')
                    resize_image(
                        filepath, json.loads(image_dimensions), transparent_background
                    )
                image.image_dimensions = (
                    image_dimensions if image_dimensions else image.image_dimensions
                )
                image.last_modified_date = datetime.now()
                image.save()

                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "System"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": image,
                        "description": "Image Record updated",
                        "change_type": "UPDATE",
                        "object_type": "Images",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                queue = rq.Queue(
                    current_app.config["REDIS_QUEUE_NAME"], connection=current_app.redis
                )
                queue.enqueue(
                    "app.tasks.upload_file_to_gdrive",
                    args=[image.image_id, "image", image.image_name],
                    job_timeout=current_app.config["SYNC_INTERVAL"],
                )
                return jsonify({"message": "Image Updated successfully"})
            else:
                return jsonify({"message": "Image could not be updated"})
        elif data_type == "files":

            file_name = request.form.get("file_name")
            file_updated = request.form.get("file_updated")
            uploaded_file = request.files.get("uploaded_file") if file_updated else None
            file_name = (
                uploaded_file.filename.split(os.sep)[-1] if uploaded_file else None
            )
            file_format = file_name.split(".")[-1]
            file_size = request.form.get("size")
            file_type = request.form.get("type")
            file_last_modified = request.form.get("lastModified")
            file_webkit_relative_path = request.form.get("webkitRelativePath")
            filename = secure_filename(uploaded_file.filename)
            uploaded_file_name = uploaded_file.filename.split(os.sep)[-1]
            filename = filename.split(os.sep)[-1]

            if filename != "":
                # print(filename)
                file_ext = os.path.splitext(filename)[1].replace(".", "")
                valid_formats = (
                    current_app.config["FILE_FORMATS"]
                    + current_app.config["IMAGE_FORMATS"]
                )
                valid_formats = [file_format.lower() for file_format in valid_formats]
                if file_ext.lower() not in valid_formats:
                    print("File extension is not valid: " + file_ext)
                    abort(400)
            file_path = os.path.join(
                current_app.config["FILE_UPLOAD_DIRECTORY"]
                + os.sep
                + file_type.upper()
                + os.sep
                + datetime.now().strftime("%Y%m%d")
            )
            try:
                if not os.path.exists(file_path):
                    os.makedirs(file_path)
                    os.chmod(file_path, stat.S_IWRITE)
            except Exception as _:
                traceback.print_exc()
            upload_directory = file_path  # .replace("\\","\\\\"))
            filepath = os.path.join(upload_directory, uploaded_file_name)
            existing_file = Files.get({"file_path": filepath})
            folders = filepath.split(os.sep)
            index_of_static = folders.index("static")
            url_folders = folders[index_of_static:]
            file_url = "/" + "/".join(url_folders)

            file_check = True if existing_file else False
            if not file_check:
                file_id = Files.get_next("file_id")
                file = Files(
                    file_id=file_id,
                    file_name=file_name,
                    actual_file_name=uploaded_file_name,
                    file_format=file_format,
                    file_path=filepath,
                    file_size=file_size,
                    file_type=file_type,
                    file_last_modified=file_last_modified,
                    file_url=file_url,
                    webkit_relative_path=file_webkit_relative_path,
                    google_file_id=str(file_id),
                    google_url=file_url,
                    created_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )

                uploaded_file.save(file.file_path)
                file.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "System"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": file,
                        "description": "New record added to Files",
                        "change_type": "INSERT",
                        "object_type": "Creator",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                queue = rq.Queue(
                    current_app.config["REDIS_QUEUE_NAME"], connection=current_app.redis
                )
                queue.enqueue(
                    "app.tasks.upload_file_to_gdrive",
                    args=[file.file_id, "file", file.file_name],
                    job_timeout=current_app.config["SYNC_INTERVAL"],
                )
                return jsonify({"message": "File updated successfully"})
            else:
                return jsonify({"message": "File could not be updated"})
        elif data_type == "pagetemplates":
            template_id = request.form.get("template_id")
            name = request.form.get("name")
            description = request.form.get("description")
            contents = request.form.get("contents")
            template = PageTemplates.get({"template_id": template_id})
            is_existing_template = True if template else False
            if is_existing_template:
                template.name = name.strip()
                template.description = description.strip()
                template.contents = contents.strip()
                template.last_modified_date = datetime.now()
                template.current_version = int(template.current_version) + 1
                template.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": template,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Template",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Template updated successfully"})
            return jsonify({"message": "Template could not be updated"})
        elif data_type == "mailtemplates":
            template_id = request.form.get("template_id")
            name = request.form.get("name")
            description = request.form.get("description")
            contents = request.form.get("contents")
            template = MailTemplates.get({"template_id": template_id})
            is_existing_template = True if template else False
            if is_existing_template:
                template.name = name.strip()
                template.description = description.strip()
                template.contents = contents.strip()
                template.last_modified_date = datetime.now()
                template.current_version = int(template.current_version) + 1
                template.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": template,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "MailTemplate",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "MailTemplate updated successfully"})
            return jsonify({"message": "MailTemplate could not be updated"})
        elif data_type == "pages":
            page_id = request.form.get("page_id")
            page_name = request.form.get("page_name")
            is_child = convert_to_bool(request.form.get("is_child"))
            is_nav_page = convert_to_bool(request.form.get("is_nav_page"))
            comes_after = request.form.get("comes_after")
            href = request.form.get("href")
            is_home_page = convert_to_bool(request.form.get("is_home_page"))
            parent_page_id = request.form.get("parent_page_id")
            page_type = int(request.form.get("page_type"))
            contents = request.form.get("contents")
            banner_id     = request.form.get("banner_id")
            page          = Pages.get({"page_id": page_id})
            page_check    = True if page else False
            banner_type   =  request.form.get("banner_type")
            template_name = request.form.get("template_name")
            banner = None
            template = None

            # is_restricted = convert_to_bool(request.form.get("is_restricted"))
            parent_page = None
            if parent_page_id:
                original_parent_page = page.parent_page if page.parent_page else None
                if original_parent_page:
                    child_pages = Pages.get({"parent_page": original_parent_page})
                    if len(child_pages) == 0:
                        original_parent_page.is_parent_page = False
                        original_parent_page.save()

                parent_page = Pages.get({"page_id": parent_page_id})
                if parent_page:
                    parent_page.is_parent = True
                    parent_page.save()

            if banner_id and int(banner_id) != 0:
                banner = Banners.get({"banner_id": int(banner_id)})
            if template_name and template_name != "None":
                template = PageTemplates.get({"name": template_name})

            if page_check:
                is_parent = Pages.get({"parent_page": page})
                if is_parent:
                    is_parent = True
                else:
                    is_parent = False
                page.page_name = page_name
                page.is_child = is_child
                page.is_nav_page = is_nav_page
                if page.comes_after and page.comes_after !=0:
                    page.comes_after = comes_after

                page.href = href
                page.page_type = page_type
                page.contents = contents

                if page.template:
                    page.template = template

                page.banner_type = int(banner_type)

                if page.banner:
                    page.banner = banner
                page.is_parent = is_parent

                # page.is_restricted = is_restricted
                page.last_modified_date = datetime.now()
                page.current_version = int(page.current_version) + 1
                child_pages = Pages.get({"parent_page": page})

                if child_pages is not None:
                    page.is_parent = False
                if page.is_child:
                    page.parent_page = parent_page
                else:
                    page.parent_page = None

                page.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "System"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": page,
                        "description": f"Page with ID {page.page_id} saved successfully",
                        "change_type": "UPDATE",
                        "object_type": "Pages",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify(
                    {"message": f"Page with ID {page.page_id} updated successfully"}
                )
            else:
                return jsonify({"message": "Page could not be updated"})
        elif data_type == "sections":
            section_id = request.form.get("section_id")
            name = request.form.get("name")
            section_description = request.form.get("description")
            pages = request.form.get("pages")
            if pages:
                pages = json.loads(pages)
                pages = [Pages.get({"page_id": p}) for p in pages]
            section = Sections.get({"section_name": name})
            section = Sections.get({"section_id": section_id})
            is_existing_section = True if section else False
            if is_existing_section:
                old_object = section
                section.name = name.strip()
                section.description = section_description.strip()
                section.pages = pages
                section.last_modified_date = datetime.now()
                section.current_version = int(section.current_version) + 1
                section.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": old_object,
                        "new_object": section,
                        "description": f"{data_type} record with ID {section.id} updated successfully",
                        "change_type": "UPDATE",
                        "object_type": "Section",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Section updated successfully"})
            return jsonify({"message": "Section could not be updated"})
        elif data_type == "imap":
            imap_server_address = request.form.get("imap_server_address")
            account_name = request.form.get("account_name")
            imap_username = request.form.get("imap_username")
            imap_password = request.form.get("imap_password")
            imap_security = request.form.get("imap_security")
            imap_port = request.form.get("imap_port")
            account_id = request.form.get("account_id")
            imap_account = IMAPAccounts.get({"account_id": account_id})
            old_data = imap_account
            imap_account.account_name = account_name
            imap_account.imap_server_address = imap_server_address
            imap_account.imap_username = imap_username
            if imap_password:
                imap_account.imap_password = key_maker.multiCrypt(imap_password, count)
            imap_account.imap_security = imap_security
            imap_account.imap_port = imap_port
            imap_account.last_modified_date = datetime.now()
            imap_account_check = IMAPAccounts.get(
                {"imap_server_address": imap_server_address}
            )
            is_editable = (
                True
                if not imap_account_check
                or imap_account_check.account_id == imap_account.account_id
                else False
            )

            if is_editable:
                try:
                    imap_account.save()
                    AuditTrail.log_to_trail(
                        {
                            "old_object": old_data,
                            "new_object": imap_account,
                            "description": f"{data_type} record updated",
                            "change_type": "UPDATE",
                            "object_type": "IMAP Account",
                            "user_id": str(current_user.id),
                            "username": current_user.username,
                        }
                    )
                    queue = rq.Queue(
                        current_app.config["REDIS_QUEUE_NAME"],
                        connection=current_app.redis,
                    )
                    return jsonify({"message": "Account updated successfully."})
                except:
                    traceback.print_exc()
                    return jsonify({"message": "Account could not be updated."})
        elif data_type == "gmail":
            credentials_file = request.files.get("crendentials")
            email_address = request.form.get("gmail_email_address")
            gmail_servers = request.form.get("gmail_server_address")
            api_key = request.form.get("gmail_api_key")
            account_name = request.form.get("gmail_account_name")
            account_id = request.form.get("account_id")
            # print(f"account_id: {account_id}")
            gmail_account = None
            filename = (
                secure_filename(credentials_file.filename) if credentials_file else None
            )
            if filename:
                cred_path = os.path.join(current_app.config["KEY_PATH"], filename)
                tok_path = cred_path + ".token.pickle"
                account_check = GMailAccounts.get({"credential_file": cred_path})
                gmail_account = GMailAccounts.get({"account_id": account_id})
                old_data = gmail_account
                is_editable = (
                    True
                    if not account_check
                    or account_check.account_id == account_check.account_id
                    else False
                )

                if is_editable:
                    if filename:
                        credentials_file.save(cred_path)
                    else:
                        cred_path = gmail_account.credential_file
                        tok_path = gmail_account.token_file
                    gmailHelper = GmailHelper(
                        gmail_servers, email_address, cred_path, tok_path
                    )
                    gmailHelper.gmail_authenticate()
                    gmail_account.account_name = account_name
                    gmail_account.email_address = email_address
                    if api_key:
                        gmail_account.api_key = key_maker.multiCrypt(api_key, count)
                    gmail_account.servers = gmail_servers
                    gmail_account.credential_file = cred_path
                    gmail_account.token_file = tok_path
                    gmail_account.last_modified_date = datetime.utcnow()
                    gmail_account.save()
                    AuditTrail.log_to_trail(
                        {
                            "old_object": old_data,
                            "new_object": gmail_account,
                            "description": f"{data_type} record updated",
                            "change_type": "UPDATE",
                            "object_type": "Gmail Account",
                            "user_id": str(0),
                            "username": "System",
                        }
                    )
                    return jsonify({"message": "Gmail Account updated successfully."})
            else:
                return jsonify({"message": "Gmail Account could not be updated."})
        elif data_type == "eventtypes":
            type_id = request.form.get("type_id")
            type_name = request.form.get("type_name")
            description = request.form.get("description")
            handler = request.form.get("handler")
            template_id = request.form.get("template_id")
            event_type = EventTypes.get({"type_id": type_id})
            is_existing_type = True if event_type else False
            template = None
            if template_id and int(template_id) != -1:
                template = MailTemplates.get({"template_id": int(template_id)})
            if is_existing_type:

                event_type.type_name = type_name.strip()
                event_type.description = description.strip()
                event_type.handler = handler.strip()
                event_type.template = template
                event_type.last_modified_date = datetime.now()
                event_type.current_version = int(event_type.current_version) + 1
                event_type.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": event_type,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "EventTypes",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Event Type updated successfully"})
            return jsonify({"message": "Event Type could not be updated"})
        elif data_type == "schedules":
            name = request.form.get("schedule_name")
            description = request.form.get("schedule_description")
            start_time = request.form.get("start_time")
            status = request.form.get("schedule_status")
            repeat = request.form.get("schedule_repeat")
            months = request.form.get("months")
            weeks = request.form.get("weeks")
            hours = request.form.get("hours")
            minutes = request.form.get("minutes")
            seconds = request.form.get("seconds")
            schedule_id = request.form.get("schedule_id")
            repeat = 0 if repeat.lower() == "none" else repeat

            status = (
                Schedules.ACTIVE
                if str(status).lower() == "active"
                else Schedules.DISABLED
            )
            if str(repeat).lower() == "yearly":
                repeat = 3600 * 24 * 30 * 12
            elif str(repeat).lower() == "quarterly":
                repeat = 3600 * 24 * 30 * 3
            elif str(repeat).lower() == "monthly":
                repeat = 3600 * 24 * 30
            elif str(repeat).lower() == "weekly":
                repeat = 3600 * 24 * 7
            elif str(repeat).lower() == "bi-weekly":
                repeat = 3600 * 24 * 7 * 2
            elif str(repeat).lower() == "daily":
                repeat = 3600 * 24
            elif str(repeat).lower() == "hourly":
                repeat = 3600
            elif str(repeat).lower() == "none":
                repeat = 9999999999

            schedule_check = Schedules.get({"name": name})
            schedule = Schedules.get({"schedule_id": schedule_id})
            old_data = schedule
            is_editable = (
                True
                if not schedule_check
                or schedule_check.schedule_id == schedule.schedule_id
                else False
            )
            # print(is_editable)
            if is_editable:
                schedule.name = name
                schedule.description = description
                schedule.start_time = start_time
                schedule.schedule_status = status
                schedule.repeat = repeat
                schedule.months = months
                schedule.weeks = weeks
                schedule.hours = hours
                schedule.minutes = minutes
                schedule.seconds = seconds
                schedule.last_modified_date = datetime.now()
                schedule.current_version = int(schedule.current_version) + 1
                schedule.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": old_data,
                        "new_object": schedule,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Schedules",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Schedule has been updated successfully"})
            return jsonify(
                {"message": "Schedule could not be updated with the given parameters"}
            )
        elif data_type == "eventtriggers":
            trigger_id = request.form.get("trigger_id")
            trigger_name = request.form.get("trigger_name")
            event_type_id = request.form.get("event_type")
            description = request.form.get("description")
            schedule_id = request.form.get("schedule")
            parameters = request.form.get("parameters")
            event_type = None
            schedule = None
            trigger = EventTriggers.get({"trigger_name": trigger_name})
            if event_type_id:
                event_type = EventTypes.get({"type_id": int(event_type_id)})
            if schedule_id:
                schedule = Schedules.get({"schedule_id": int(schedule_id)})
            if parameters:
                parameters = json.loads(parameters)

            is_existing_trigger = True if trigger else False
            if is_existing_trigger:
                trigger.trigger_name = trigger_name.strip()
                trigger.description = description.strip()
                trigger.event_type = event_type
                trigger.parameters = parameters
                trigger.schedule = schedule
                trigger.last_modified_date = datetime.now()
                trigger.current_version = int(trigger.current_version) + 1

                trigger.save()

                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": trigger,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "EventTrigger",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                parameters["trigger_id"] = trigger_id
                parameters["start"] = True
                Events.create(parameters)
                return jsonify({"message": "Event Trigger updated successfully"})
            return jsonify({"message": "Event Trigger update failed"})
        elif data_type == "events":
            event_id = request.form.get("event_id")
            event_status = request.form.get("event_status")
            # print(event_id)
            # print(event_status)
            event = Events.get({"event_id": int(event_id)})
            old_data = event
            is_existing = True if event else False
            if is_existing:
                event.event_status = event_status
                event.last_modified_date = datetime.now()
                event.current_version = int(event.current_version) + 1
                event.save()
                user_id = (
                    session["current_user"].user_id
                    if "current_user" in session.keys()
                    and session["current_user"].user_id
                    else 0
                )
                user_name = (
                    current_user.username
                    if "current_user" in session.keys() and current_user.username
                    else "system"
                )

                AuditTrail.log_to_trail(
                    {
                        "old_object": old_data,
                        "new_object": event,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Event",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                return jsonify({"message": "Event successfully updated and scheduled."})
        # elif data_type == "gmail":
        #     credentials_file = request.files.get("crendentials")
        #     email_address = request.form.get("gmail_email_address")
        #     gmail_servers = request.form.get("gmail_server_address")
        #     api_key = request.form.get("gmail_api_key")
        #     account_name = request.form.get("gmail_account_name")
        #     account_id = request.form.get("account_id")
        #     print(f"account_id: {account_id}")
        #     gmail_account = None
        #     filename = (
        #         secure_filename(credentials_file.filename) if credentials_file else None
        #     )
        #     if filename:
        #         cred_path = os.path.join(current_app.config["KEY_PATH"], filename)
        #         tok_path = cred_path + ".token.pickle"
        #         account_check = GMailAccounts.get({"credential_file": cred_path})
        #         gmail_account = GMailAccounts.get({"account_id": account_id})
        #         old_data = gmail_account
        #         is_editable = (
        #             True
        #             if not account_check
        #             or account_check.account_id == account_check.account_id
        #             else False
        #         )

        #         if is_editable:
        #             if filename:
        #                 credentials_file.save(cred_path)
        #             else:
        #                 cred_path = gmail_account.credential_file
        #                 tok_path = gmail_account.token_file
        #             gmailHelper = GmailHelper(
        #                 gmail_servers, email_address, cred_path, tok_path
        #             )
        #             gmailHelper.gmail_authenticate()
        #             gmail_account.account_name = account_name
        #             gmail_account.email_address = email_address
        #             if api_key:
        #                 gmail_account.api_key = key_maker.multiCrypt(api_key, count)
        #             gmail_account.servers = gmail_servers
        #             gmail_account.credential_file = cred_path
        #             gmail_account.token_file = tok_path
        #             gmail_account.last_modified_date = datetime.utcnow()
        #             gmail_account.save()
        #             AuditTrail.log_to_trail(
        #                 {
        #                     "old_object": old_data,
        #                     "new_object": gmail_account,
        #                     "description": f"{data_type} record updated",
        #                     "change_type": "UPDATE",
        #                     "object_type": "Gmail Account",
        #                     "user_id": str(0),
        #                     "username": "System",
        #                 }
        #             )
        #             return jsonify({"message": "Gmail Account updated successfully."})
        #     else:
        #         return jsonify({"message": "Gmail Account could not be updated."})
    else:
        return jsonify({"message": "Invalid request."})


@csrf.exempt
@bp.route("/cpanel/columns/<table>", methods=["GET"])
@login_required
def get_column_order(table):
    """
    Remove Record from database
    """
    key = request.args.get("acky")
    display_map = {}
    if not should_have_access(key):
        expected_key = session["current_user"]["acky"]
        print(f"Invalid session key:{key}. Expected key: { expected_key}")
        return jsonify({"message": "Invalid session information"})

    # if "client_info" in session:
    #     client_info = get_client_info(request)
    #     if (
    #         (client_info["REMOTE_ADDR"] != session["client_info"]["REMOTE_ADDR"])
    #     ):
    #         return jsonify({"message": "Invalid Session Information"})

    table_key = table.capitalize()
    for k in models.__dict__.keys():
        if k.lower() == table.lower():
            table_key = k
            break
    column_order = None
    if table_key:
        collection = models.__dict__[table_key]
        collection_schema = collection.get_schema()
        column_order = collection_schema["order"]
        display_map = collection_schema["display_map"]
        if int(session['current_user'].role_id)==int(1):
            column_order.append("Actions")
    return jsonify({"columnOrder": column_order, "displayOrder": display_map})


# except Exception as error:
#     traceback.format_exc()
#     print(error)
#     return jsonify({"message": "Failed to communicate with server"})
@csrf.exempt
@bp.route("/cpanel/delete/<table>", methods=["POST"])
@login_required
def remove_record(table):
    """
    Remove Record from database
    """
    key = request.args.get("acky")
    if not should_have_access(key):
        expected_key = session["current_user"]["acky"]
        print(f"Invalid session key:{key}. Expected key: { expected_key}")
        return jsonify({"message": "Invalid session information"})
    # if "client_info" in session:
    #     client_info = get_client_info(request)
    #     if (
    #         (client_info["REMOTE_ADDR"] != session["client_info"]["REMOTE_ADDR"])
    #     ):
    #         return jsonify({"message": "Invalid Session Information"})
    table_key = table.capitalize()
    for k in models.__dict__.keys():
        if k.lower() == table.lower():
            table_key = k
            break
    collection = models.__dict__[table_key]
    id_field = collection.get_schema()["idField"]
    # print("collection: ", collection)
    # print("id_field: ", id_field)
    id_value = request.form.get("id")
    temp_data = {}
    temp_data[id_field] = id_value
    entry_pending_removal = collection.find(temp_data)
    try:
        entry_pending_removal.delete()
        user_id = (
            session["current_user"].user_id
            if "current_user" in session.keys() and session["current_user"].user_id
            else 0
        )
        AuditTrail.log_to_trail(
            {
                "old_object": entry_pending_removal,
                "new_object": None,
                "description": f"{table} record deleted",
                "change_type": "DELETE",
                "object_type": table,
                "user_id": str(user_id),
                "username": current_user.username,
            }
        )
        return jsonify(
            {"message": "Record with ID: " + id_value + "  deleted successfully."}
        )
    except:
        traceback.print_exc()
        return jsonify(
            {"message": "Record with ID: " + id_value + " could not be deleted."}
        )


@csrf.exempt
@bp.route("/cpanel/sync/<sync_type>/<sync_collection>", methods=["GET"])
# @cache.cached()
# @login_required
def get_sync_table_version_data(sync_type, sync_collection=None):
    """
    Gets version information for tables that are to be synced
    """
    version_data = {}
    key = request.args.get("acky")
    if not should_have_access(key):
        expected_key = (
            session["current_user"]["acky"] if "current_user" in session else None
        )
        print(f"Invalid session key:{key}. Expected key: { expected_key}")
        return jsonify({"message": "Invalid Session Information"})
    
    # if "client_info" in session:
    #     client_info = get_client_info(request)
    #     if (
    #         (client_info["REMOTE_ADDR"] != session["client_info"]["REMOTE_ADDR"])
    #     ):
    #         return jsonify({"message": "Invalid Session Information"})
    sync_info = (
        current_app.config["COMPONENT_CONFIG"]["syncInfo"][sync_type]
        if sync_collection is None
        else [
            info
            for info in current_app.config["COMPONENT_CONFIG"]["syncInfo"][sync_type]
            if info["collectionName"].lower() == sync_collection.lower()
        ]
    )
    for info in sync_info:
        version_data[info["collectionName"]] = []

        table_key = info["collectionName"]
        for k in models.__dict__.keys():
            if k.lower() == info["collectionName"].lower():
                table_key = k
                break
        collection = models.__dict__[table_key]

        # collection = collection = models.__dict__[info["collectionName"]]
        id_field = info["idField"]
        watched_fields = info["watchedFields"]
        records = collection.objects()

        for record in records:
            temp_record = {}
            temp_record[id_field] = record[id_field]
            for field in watched_fields:
                temp_record[field] = record[field]
            version_data[info["collectionName"]].append(temp_record)
    return jsonify(version_data)


@csrf.exempt
@bp.route("/cpanel/sync/<sync_type>", methods=["GET"])
# @cache.cached()
# @login_required
def get_table_version_data(sync_type):
    """
    Gets version information for tables that are to be synced
    """
    version_data = {}
    key = request.args.get("acky")
    if not should_have_access(key):
        expected_key = (
            session["current_user"]["acky"] if "current_user" in session else None
        )
        print(f"Invalid session key:{key}. Expected key: { expected_key}")
        return jsonify({"message": "Invalid Session Information"})

    # if "client_info" in session:
    #     client_info = get_client_info(request)
    #     if (
    #         (client_info["REMOTE_ADDR"] != session["client_info"]["REMOTE_ADDR"])
    #     ):
    #         return jsonify({"message": "Invalid Session Information"})
    for info in current_app.config["COMPONENT_CONFIG"]["syncInfo"][sync_type]:
        version_data[info["collectionName"]] = []
        collection = collection = models.__dict__[
            info["collectionName"]
        ]  # get_collection_from_name(info["collectionName"])
        id_field = info["idField"]
        watched_fields = info["watchedFields"]
        records = collection.objects()
        # print(info["collectionName"])
        # print(records)
        for record in records:
            temp_record = {}
            temp_record[id_field] = record[id_field]
            for field in watched_fields:
                temp_record[field] = record[field]
            version_data[info["collectionName"]].append(temp_record)

        """
        version_agg = {}
        agg_project = {}
        agg_project[f"{id_field}"] = f"${id_field}"
        for field in watchedFields:
            agg_project[f"{field}"] = f"${field}"
        version_agg["$project"] = agg_project
        
        version_info = collection.objects().aggregate(
            {
                "$project": {
                    f"{id_field}": f"${id_field}",
                    "current_version": "$current_version",
                    "last_modified_date": "$last_modified_date",
                }
            }
        )
        
        version_info = collection.objects().aggregate(version_agg)
        version_info = list(version_info)
        version_data[info["collectionName"]] = (
            get_collection_data(version_info) if len(version_info) > 0 else []
        )
        """
    return jsonify(version_data)


@csrf.exempt
@bp.route("/cpanel/sync/update/<sync_type>", methods=["GET"])
def get_table_update_data(sync_type):
    """
    gets update data for local table
    """
    key = request.args.get("acky")
    if not should_have_access(key):
        expected_key = (
            session["current_user"]["acky"] if "current_user" in session else None
        )
        print(f"Invalid session key:{key}. Expected key: { expected_key}")
        return jsonify({"message": "Invalid Session Information"})
    # if "client_info" in session:
    #     client_info = get_client_info(request)
    #     if (
    #         (client_info["REMOTE_ADDR"] != session["client_info"]["REMOTE_ADDR"])
    #     ):
    #         return jsonify({"message": "Invalid Session Information"})
    table_update_data = {}
    sync_info = current_app.config["COMPONENT_CONFIG"]["syncInfo"][sync_type]

    table_info = json.loads(request.args.get("q"))
    for col, ids in table_info.items():
        collection = collection = models.__dict__[col]
        id_field = [
            cltn["idField"]
            for cltn in sync_info
            if cltn["collectionName"].lower() == col.lower()
        ][
            0
        ]  # sync_info[col]["idField"]
        query = {}
        update_data = {}
        if len(ids) > 0:
            query[id_field] = {"$in": ids}
            update_data = collection.objects(__raw__=query)
            table_update_data[col] = (
                get_found_records(update_data) if len(update_data) > 0 else []
            )
        else:
            table_update_data[col] = []
        # print(table_update_data[col])

    return jsonify(table_update_data)


@bp.route("/cpanel/index", methods=["GET", "POST"])
@bp.route("/cpanel", methods=["GET", "POST"])
@login_required
def admin_panel():
    """
    This function handles the /cpanel or /cpanel/index route
    """
    opts = {}
    opts["logo"] = "/static/logo_mini.png"
    opts["startTime"] = datetime.now()
    opts["timeOut"] = None
    opts["siteName"] = settings["SITE_ID"]
    opts["userName"] = None
    opts["previousDest"] = None

    if "current_user" not in session:
        redirect(url_for("auth.admin_login"))

    opts["currentTime"] = datetime.now()
    opts["siteTitle"] = settings["SITE_NAME"]
    tdelta = timedelta(days=1, seconds=0, microseconds=0)
    end_date = (
        datetime.now() + tdelta
        if current_app.config["CPANEL"]["contentHeader"]["contentWrapper"][
            "dashboardReportRange"
        ]["reportEnd"]
        == ""
        else current_app.config["CPANEL"]["contentHeader"]["contentWrapper"][
            "dashboardReportRange"
        ]["reportEnd"]
    )
    if (
        current_app.config["CPANEL"]["contentHeader"]["contentWrapper"][
            "dashboardReportRange"
        ]["reportEnd"]
        == ""
    ):
        current_app.config["CPANEL"]["contentHeader"]["contentWrapper"][
            "dashboardReportRange"
        ]["reportEnd"] = end_date.strftime("%Y-%m-%d %H:%M:%S")
    tdelta = timedelta(days=365, seconds=0, microseconds=0)
    start_date = (
        current_app.config["CPANEL"]["contentHeader"]["contentWrapper"][
            "dashboardReportRange"
        ]["reportStart"]
        if current_app.config["CPANEL"]["contentHeader"]["contentWrapper"][
            "dashboardReportRange"
        ]["reportStart"]
        else "2012-01-01 00:00:00"
    )

    start_date = datetime.strptime(start_date, "%Y-%m-%d %H:%M:%S")  # end_date -tdelta
    dashboard_data = []  # get_stats_info(start_date, end_date)
    current_app.config["CPANEL"]["dashboardData"] = dashboard_data
    acky = None

    if "acky" in session["current_user"]:
        acky = session["current_user"]["acky"]
    else:
        acky = str(uuid4())
        session["client_info"] = get_client_info(request)
    cpanel_user = {
        "userID": session["current_user"].user_id,
        "username": session["current_user"].username,
        "roleID": session["current_user"].role_id,
        "connectionStatus": session["current_user"].connectionStatus,
        "locked": session["current_user"].locked,
        "active": session["current_user"].active,
        "loginAttempts": session["current_user"].login_attempts,
        "acky": acky,
    }

    opts["currentUser"] = cpanel_user
    current_app.config["CPANEL"]["currentUser"] = cpanel_user
    data_config = json.dumps(current_app.config["COMPONENT_CONFIG"])
    # print(data_config)
    # app_config = json.dumps(current_app.config["APP_CONFIG"])
    # print(app_config)
    default_properties = json.dumps(current_app.config["CPANEL"])
    # print(default_properties)
    version = round(time.time() * 1000)
    opts["siteSettings"] = {}
    site_settings = SiteSettings.get({"settings_id": 1})
    if site_settings:

        if len(site_settings.overrides.keys()) > 0:
            for k, v in site_settings.overrides.items():
                try:
                    site_settings[k.lower()] = (
                        v if "{" not in v and "}" not in v else json.loads(v)
                    )
                except:
                    traceback.format_exc()
        for k, v in current_app.config["APP_CONFIG"].items():
            if k.lower() not in site_settings:
                site_settings[k.lower()] = v
                site_settings.save()
    else:
        site_settings = SiteSettings()
        site_settings.settings_id = 1

        for k, v in current_app.config["APP_CONFIG"].items():
            if k == "SYNC_MODE":
                site_settings[k.lower()] = (
                    SiteSettings.LOCAL if k == "LOCAL" else SiteSettings.ONLINE
                )
            else:
                site_settings[k.lower()] = v
        site_settings.site_icon = "/static/favicon.ico"
        site_settings.overrides = {}
        site_settings.current_version = 0
        site_settings.created_datetime = datetime.now()
        site_settings.last_modified_date = datetime.now()
        site_settings.save()

    opts["siteSettings"] = site_settings
    opts["logo"] = site_settings.site_logo
    # print(opts["logo"])
    return render_template(
        "main/cpanel.html",
        title="Dashboard",
        pageID="dashboard",
        options=opts,
        dataConfig=data_config,
        appConfig=site_settings.to_json(),  # app_config,
        defaultComponents=default_properties,
        version=version,
    )


@bp.route("/cpanel/logout", methods=["GET", "POST"])
@bp.route("/cpanel/logoff", methods=["GET", "POST"])
def logout():
    """
    End current session for user
    """
    try:
        if session and "current_user" in session:

            user = Users.get({"user_id": session["current_user"].user_id})
            if user:
                session.clear()
                user.connectionStatus = False
                user.lastModifiedDate = datetime.now
                user.current_version = int(user.current_version) + 1
                user.save()
                logout_user()
                # print("User udpated. Logging off...")
                # return jsonify({"error": False, "message": "Logout Successful!"})
                return redirect(url_for("auth.admin_login"))
            else:
                logout_user()
                return redirect(url_for("auth.admin_login"))
    except Exception as _:
        pass
        # return jsonify({"error": True, "message": str(e)})
    return redirect(url_for("auth.admin_login"))


@csrf.exempt
@bp.route("/cpanel/messages/update", methods=["POST"])
# @login_required
def update_message():
    """
    Update Message Status
    """
    check_key = request.form.get("acky")
    if should_have_access(check_key) is False:
        return jsonify({"message": "Invalid Session Information"})
    # if "client_info" in session:
    #     client_info =  get_client_info(request)
    #     if( 
    #     (client_info['REMOTE_ADDR'] != session['client_info']['REMOTE_ADDR']) ):
    #         return jsonify({"message": "Invalid Session Information"})
    message_id = request.form.get("message_id")
    message_status =  request.form.get("message_status")
    message_notes = request.form.get("message_notes")

    message =  Messages.get({"message_id": int(message_id)})
    old_message= message
    if message:
        message.message_status = int(message_status)
        message.current_version = int(message.current_version)+1
        if message_notes:
            message.message_notes =  message_notes
        message.last_modified_date = datetime.now()
        message.save()
        user_id = (
            session["current_user"].user_id
            if "current_user" in session.keys()
            and session["current_user"].user_id
            else 0
        )
        user_name = (
            current_user.username
            if "current_user" in session.keys() and current_user.username
            else "system"
        )
        AuditTrail.log_to_trail(
            {
                "old_object":  old_message,
                "new_object":  message,
                "description": "Message record updated",
                "change_type": "UPDATE",
                "object_type": "Event",
                "user_id": str(user_id),
                "username": user_name,
            }
        )
        return jsonify({"message": "Event successfully updated and scheduled."})
    return jsonify({"message": "Message could not be found."})


@csrf.exempt
@bp.route("/cpanel/events", methods=["POST"])
# @login_required
def rerun_events():
    """
    Update Message Status
    """
    check_key = request.form.get("acky")
    if should_have_access(check_key) is False:
        return jsonify({"message": "Invalid Session Information"})
    # if "client_info" in session:
    #     client_info = get_client_info(request)
    #     if client_info["REMOTE_ADDR"] != session["client_info"]["REMOTE_ADDR"]:
    #         return jsonify({"message": "Invalid Session Information"})
    event_id = request.form.get("event_id")
    event_status = request.form.get("event_status")

    event = Events.get({"event_id": int(event_id)})
    old_event= event
    if event and event.event_status == event_status and (event.job.jobStatus !=Jobs.SUCCEEDED or event.job.jobStatus !=Jobs.RUNNING):
        event.current_version = int(event.current_version) + 1
        event.last_modified_date = datetime.now()
        event.job_history.append(event.job)
        event.job= event.start()
        event.save()
        user_id = (
            session["current_user"].user_id
            if "current_user" in session.keys() and session["current_user"].user_id
            else 0
        )
        user_name = (
            current_user.username
            if "current_user" in session.keys() and current_user.username
            else "system"
        )
        AuditTrail.log_to_trail(
            {
                "old_object": old_event,
                "new_object": event,
                "description": "Event record updated",
                "change_type": "UPDATE",
                "object_type": "Event",
                "user_id": str(user_id),
                "username": user_name,
            }
        )
        return jsonify({"message": "Event successfully updated and scheduled."})
    return jsonify({"message": "Event could not be found."})
