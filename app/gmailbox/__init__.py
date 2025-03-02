import os, traceback
from google.oauth2.credentials import Credentials

# Gmail API utils
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

# for encoding/decoding messages in base64
from base64 import urlsafe_b64decode, urlsafe_b64encode

# for dealing with attachement MIME types
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.audio import MIMEAudio
from email.mime.base import MIMEBase
from mimetypes import guess_type as guess_mime_type
from datetime import datetime
import json
from flask import current_app

# import traceback


class GmailHelper:
    """Google Service helper class"""

    drive_scope = "https://www.googleapis.com/auth/drive"

    def __init__(self, mail_servers, email_address, credentials_file, token_file):
        self.service_scopes = []
        self.service_scopes.append(mail_servers)
        self.service_scopes.append(self.drive_scope)
        self.email_address = email_address
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.report_email = {}

    def get_relative_path(self, file_path):
        current_directory = os.path.abspath(os.path.dirname(__file__))

        parent_directory = os.path.abspath(os.path.join(current_directory, os.pardir))
        file_name = str(file_path).rsplit("/", maxsplit=1)[-1]
        full_file_path = os.path.join(
            parent_directory,
            "static" + os.sep + "uploads" + os.sep + "keystore" + os.sep + file_name,
        )
        return file_path if os.path.exists(file_path) else full_file_path

    def gmail_authenticate(self, service_type="gmail"):
        """
        Handle authentication for different types of google services

        """
        creds = None
        service = None
        creds_file = self.get_relative_path(self.credentials_file)
        token_file_path = self.get_relative_path(self.token_file)

        if os.path.exists(token_file_path):
            creds = Credentials.from_authorized_user_file(
                token_file_path, self.service_scopes
            )

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    creds_file, self.service_scopes
                )
                redirect_port = current_app.config["GCP_REDIRECT_PORT"]
                creds = flow.run_local_server(port=redirect_port)
                redirect_url = current_app.config["GCP_REDIRECT_URL"]
                flow.redirect_uri = redirect_url.format(port=redirect_port)
            token_file_path = creds_file + ".token.pickle"
            with open(token_file_path, "w", encoding="utf-8") as token:
                token.write(creds.to_json())
        if service_type == "drive":
            print("Connecting to Google Drive Service")
            service = build("drive", "v3", credentials=creds)
        elif service_type == "gmail":
            print("Connecting to Google Mail Service")
            service = build("gmail", "v1", credentials=creds)
        return service

    def token_authenticate(self):
        creds = None
        if os.path.exists(self.token_file):
            token_file_path = self.get_relative_path(self.token_file)
            creds = Credentials.from_authorized_user_file(
                token_file_path, self.service_scopes
            )
        if creds and creds.valid:
            creds_file = self.get_relative_path(self.credentials_file)
            flow = InstalledAppFlow.from_client_secrets_file(
                creds_file, self.service_scopes
            )
            redirect_port = current_app.config["GCP_REDIRECT_PORT"]
            creds = flow.run_local_server(port=redirect_port)
            redirect_url = current_app.config["GCP_REDIRECT_URL"]
            flow.redirect_uri = redirect_url.format(port=redirect_port)
            with open(self.token_file, "w", encoding="utf-8") as token:
                token.write(creds.to_json())
        return build("gmail", "v1", credentials=creds)

    def add_attachment(self, message, filename):
        content_type, encoding = guess_mime_type(filename)
        if content_type is None or encoding is not None:
            content_type = "application/octet-stream"
        main_type, sub_type = content_type.split("/", 1)
        if main_type == "text":
            fp = open(filename, "rb")
            msg = MIMEText(fp.read().decode(), _subtype=sub_type)
            fp.close()
        elif main_type == "image":
            image_name = filename.split(os.sep)[-1]
            fp = open(filename, "rb")
            msg = MIMEImage(fp.read(), _subtype=sub_type)
            fp.close()
            msg.add_header("Content-ID", f"<{image_name}>")
        elif main_type == "audio":
            fp = open(filename, "rb")
            msg = MIMEAudio(fp.read(), _subtype=sub_type)
            fp.close()
        else:
            fp = open(filename, "rb")
            msg = MIMEBase(main_type, sub_type)
            msg.set_payload(fp.read())
            fp.close()
        filename = os.path.basename(filename)
        msg.add_header("Content-Disposition", "attachment", filename=filename)

        message.attach(msg)

    def build_message(self, destination, sbj, body, attachments=[]):
        print(attachments)
        if not attachments:  # no attachments given
            message = MIMEText(body, "html")
            message["MIME-Version"] = "1.0\n"
            message["Content-Type"] = 'text/html; charset="UTF-8"\n'
            message["to"] = destination
            message["from"] = self.email_address
            message["subject"] = sbj
        else:
            message = MIMEMultipart()
            message["to"] = destination
            message["from"] = self.email_address
            message["subject"] = sbj
            message.attach(MIMEText(body, "html"))
            message["Content-Type"] = 'text/html; charset="UTF-8"\n'
            for filename in attachments:
                self.add_attachment(message, filename)
        # return {'raw': urlsafe_b64encode(message.as_bytes()).decode()}
        return {
            "raw": urlsafe_b64encode((message.as_string()).encode("utf-8")).decode(
                "utf-8"
            )
        }

    def send_message(self, service, destination, sbj, body, attachments=[]):
        return (
            service.users()
            .messages()
            .send(
                userId="me",
                body=self.build_message(destination, sbj, body, attachments),
            )
            .execute()
        )

    def search_messages(self, service, query):
        result = service.users().messages().list(userId="me", q=query).execute()
        messages = []
        if "messages" in result:
            messages.extend(result["messages"])
        while "nextPageToken" in result:
            page_token = result["nextPageToken"]
            result = (
                service.users()
                .messages()
                .list(userId="me", q=query, pageToken=page_token)
                .execute()
            )
            if "messages" in result:
                messages.extend(result["messages"])
        return messages

    def get_size_format(self, b, factor=1024, suffix="B"):
        """
        Scale bytes to its proper byte format
        e.g:
            1253656 => '1.20MB'
            1253656678 => '1.17GB'
        """
        for unit in ["", "K", "M", "G", "T", "P", "E", "Z"]:
            if b < factor:
                return f"{b:.2f}{unit}{suffix}"
            b /= factor
        return f"{b:.2f}Y{suffix}"

    def clean(self, text):
        new_text = "".join(c if c.isalnum() else "_" for c in text)
        ext = new_text.split("_")[-1]
        ext_len = -1 * (len(ext) + 1)
        new_text = new_text[0:ext_len] + "." + ext
        return new_text

    def parse_parts(self, service, parts, folder_name, message):
        if parts:
            for part in parts:
                filename = part.get("filename")
                mimeType = part.get("mimeType")
                body = part.get("body")
                data = body.get("data")
                file_size = body.get("size")
                part_headers = part.get("headers")
                if part.get("parts"):
                    self.parse_parts(service, part.get("parts"), folder_name, message)
                if mimeType == "text/plain":
                    if data:
                        text = urlsafe_b64decode(data).decode()
                        print(text)
                elif mimeType == "text/html":
                    if not filename:
                        filename = "index.html"
                    filepath = os.path.join(folder_name, filename)
                    print("Saving HTML to", filepath)
                    with open(filepath, "wb") as f:
                        f.write(urlsafe_b64decode(data))
                else:
                    for part_header in part_headers:
                        part_header_name = part_header.get("name")
                        part_header_value = part_header.get("value")
                        if part_header_name == "Content-Disposition":
                            if "attachment" in part_header_value:
                                print(
                                    "Saving the file:",
                                    filename,
                                    "size:",
                                    self.get_size_format(file_size),
                                )
                                attachment_id = body.get("attachmentId")
                                attachment = (
                                    service.users()
                                    .messages()
                                    .attachments()
                                    .get(
                                        id=attachment_id,
                                        userId="me",
                                        messageId=message["id"],
                                    )
                                    .execute()
                                )
                                data = attachment.get("data")
                                filepath = os.path.join(folder_name, filename)
                                if data:
                                    with open(filepath, "wb") as f:
                                        f.write(urlsafe_b64decode(data))

    def read_message(self, service, message, mail_folder):
        msg = (
            service.users()
            .messages()
            .get(userId="me", id=message["id"], format="full")
            .execute()
        )
        payload = msg["payload"]
        headers = payload.get("headers")
        parts = payload.get("parts")
        folder_name = mail_folder
        has_subject = False
        if headers:
            for header in headers:
                name = header.get("name")
                value = header.get("value")
                if name.lower() == "from":
                    print("From:", value)
                if name.lower() == "to":
                    print("To:", value)
                if name.lower() == "subject":
                    has_subject = True
                    folder_name = self.clean(value)
                    folder_counter = 0
                    while os.path.isdir(folder_name):
                        folder_counter += 1
                        if folder_name[-1].isdigit() and folder_name[-2] == "_":
                            folder_name = f"{folder_name[:-2]}_{folder_counter}"
                        elif folder_name[-2:].isdigit() and folder_name[-3] == "_":
                            folder_name = f"{folder_name[:-3]}_{folder_counter}"
                        else:
                            folder_name = f"{folder_name}_{folder_counter}"
                    folder_name = mail_folder + os.sep + folder_name
                    if not os.path.exists(folder_name):
                        os.mkdir(folder_name)
                    print("Subject:", value)
                if name.lower() == "date":
                    print("Date:", value)
        if not has_subject:
            folder_name = mail_folder + os.sep + folder_name
            if not os.path.isdir(folder_name):
                os.mkdir(folder_name)

        self.parse_parts(service, parts, folder_name, message)
        print("=" * 50)

    def mark_as_read(self, service, query):
        messages_to_mark = self.search_messages(service, query)
        print(f"Matched emails: {len(messages_to_mark)}")
        return (
            service.users()
            .messages()
            .batchModify(
                userId="me",
                body={
                    "ids": [msg["id"] for msg in messages_to_mark],
                    "removeLabelIds": ["UNREAD"],
                },
            )
            .execute()
        )

    def get_google_folders(self, parent_folder_id=None):
        """List folders and files in Google Drive."""
        items = None
        try:
            service = self.gmail_authenticate(service_type="drive")
            if service:
                results = (
                    service.files()
                    .list(
                        q=(
                            f"'{parent_folder_id}' in parents and trashed=false"
                            if parent_folder_id
                            else None
                        ),
                        pageSize=1000,
                        fields="nextPageToken, files(id, name, mimeType)",
                    )
                    .execute()
                )
            items = results.get("files", [])
            if not items:
                print("No folders or files found")
        except HttpError as error:
            traceback.format_exc()
            print(f"An error occurred: {error}")
        return items

    def init_google_folder(self, folder_name, parent_folder_id=None):
        """Create a folder in Google Drive and return its ID."""

        google_folders = self.get_google_folders()
        folder_id = [
            folder["id"] for folder in google_folders if folder["name"] == folder_name
        ]
        if folder_id and len(folder_id) > 0:
            folder_id = folder_id[0]
        else:
            folder_metadata = {
                "name": folder_name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [parent_folder_id] if parent_folder_id else [],
            }
            try:
                service = self.gmail_authenticate(service_type="drive")
                if service:
                    created_folder = (
                        service.files()
                        .create(body=folder_metadata, fields="id")
                        .execute()
                    )
                print(f'Created Folder ID: {created_folder["id"]}')
                folder_id = created_folder["id"]
            except HttpError as error:
                traceback.format_exc()
                print(f"An error occurred: {error}")
        return folder_id

    def upload_to_google(
        self,
        file_path,
        file_meta_data,
        file_mime="image/png",
        file_type="image",
        subfolder="default",
    ):
        """
        upload a file  to Google Drive
        """
        google_file = file_meta_data if not file_meta_data else {}
        try:
            # create drive api client
            service = self.gmail_authenticate(service_type="drive")
            if service:
                google_app_folder = current_app.config["SITE_ID"]
                google_app_folder_id = self.init_google_folder(google_app_folder)
                type_folder_id = None
                if file_type == "image":
                    type_folder_id = self.init_google_folder(
                        "images", google_app_folder_id
                    )
                elif file_type == "file":
                    type_folder_id = self.init_google_folder(
                        "files", google_app_folder_id
                    )
                parent_folder_name = (
                    file_path.split(os.sep)[-2]
                    if len(file_path.split(os.sep)) > 1
                    else None
                )

                subfolder_id = type_folder_id
                if subfolder:
                    subfolder_id = self.init_google_folder(subfolder, type_folder_id)
                file_parent_folder_id = subfolder_id
                if parent_folder_name:
                    file_parent_folder_id = self.init_google_folder(
                        parent_folder_name, type_folder_id
                    )

                file_meta_data["parents"] = [
                    file_parent_folder_id  # {"id": file_parent_folder_id, "kind": "drive#childList"}
                ]
                print(file_meta_data)
                media = MediaFileUpload(file_path, mimetype=file_mime, resumable=True)
                print(f"uploading file  {file_path} to Google Drive")

                google_file = (
                    service.files()
                    .create(
                        body=file_meta_data, media_body=media, fields="id, webViewLink"
                    )
                    .execute()
                )
                new_permission = {
                    "type": "anyone",
                    "role": "reader",
                }
                service.permissions().create(
                    fileId=google_file.get("id"),
                    body=new_permission,
                    transferOwnership=False,
                ).execute()
                image_info = {
                    "google_id": google_file.get("id"),
                    "google_url": google_file.get("webViewLink"),
                }
                print(google_file.get("id"))
                print(google_file.get("webViewLink"))
                return image_info
            else:
                print("Unable to connect to Google Drive")
        except HttpError as error:
            traceback.format_exc()
            print(f"An error occurred: {error}")
            google_file = None
        return google_file.get("webViewLink")
