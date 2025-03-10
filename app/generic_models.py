from argparse import SUPPRESS
import base64
from datetime import datetime, timedelta
from email.policy import default
from hashlib import md5
import json, os, jwt, redis, rq
from rq import Retry
from time import time
from flask import current_app, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from app import db  # ,  login, get_debug_template
import json
from uuid import uuid4
from flask_login import UserMixin
import sqlalchemy as sa, sqlalchemy.orm as so
from mongoengine import ReferenceField, CASCADE  # connect, Document,

class SearchableMixin(object):

    last_modified_date = db.DateTimeField(default=datetime.now())
    created_datetime = db.DateTimeField(default=datetime.now())
    current_version = db.IntField(default=0)
    meta = {"allow_inheritance": True}

    @classmethod
    def search(cls, expression, page, per_page):
        ids, total = cls.query_index(cls.__tablename__, expression, page, per_page)
        if total == 0:
            return cls.objects(id=0), 0
        when = []
        for i in range(len(ids)):
            when.append((ids[i], i))
        return (
            cls.query.filter(cls.id.in_(ids)).order_by(db.case(when, value=cls.id)),
            total,
        )

    @classmethod
    def before_commit(cls, session):
        session._changes = {
            "add": list(session.new),
            "update": list(session.dirty),
            "delete": list(session.deleted),
        }

    @classmethod
    def after_commit(cls, session):
        for obj in session._changes["add"]:
            if isinstance(obj, SearchableMixin):
                cls.add_to_index(obj.__tablename__, obj)
        for obj in session._changes["update"]:
            if isinstance(obj, SearchableMixin):
                cls.add_to_index(obj.__tablename__, obj)
        for obj in session._changes["delete"]:
            if isinstance(obj, SearchableMixin):
                cls.remove_from_index(obj.__tablename__, obj)
        session._changes = None

    @classmethod
    def reindex(cls):
        for obj in cls.query:
            cls.add_to_index(cls.__tablename__, obj)

    @classmethod
    def get_json(self):
        return current_app.json_enconder(self, exclude_none=True)

    @classmethod
    def find(cls, find_params=None, attempts=0):
        data = None
        try:
            find_params = {} if find_params == None else find_params
            data = cls.objects(**find_params)
        except Exception as e:
            print(e)
            if attempts < 3:
                db.init_app(current_app)
                attempts += 1
                time.sleep(1)
                cls.find(find_params, attempts)
        return data

    @classmethod
    def get(cls, find_params=None, attempts=0):
        data = None
        try:
            find_params = {} if find_params == None else find_params
            data = cls.objects(**find_params).first()
        except Exception as e:
            print(e)
            if attempts < 3:
                db.init_app(current_app)
                attempts += 1
                time.sleep(1)
                cls.get(find_params, attempts)
        return data

    @classmethod
    def get_record_count(cls, attempts=0):
        count = None
        try:
            count = cls.objects().all().count()
        except:
            if attempts < 3:
                db.init_app(current_app)
                attempts += 1
                time.sleep(1)
                cls.get_record_count(attempts)
        return count

    @classmethod
    def format_data(cls, data):
        if type(data) == datetime:
            return data.strftime("%Y%m%d_%H%M%S")
        elif str(type(data)) == "bson.objectid.ObjectId":
            return str(data)
        elif type(data) is dict:
            return json.dumps(data)
        elif type(data) is int:
            return int(data)
        else:
            return str(data)

    @classmethod
    def get_row_data(cls, data):
        temp_data = {}
        for k, v in data.items():
            temp_data[k] = cls.format_data(v)
        return temp_data

    @classmethod
    def get_collection_data(cls, data):
        table_data = []
        for row in data:
            temp_data = {}
            for k, v in row.items():
                if k == "records":
                    temp_data[k] = cls.get_collection_data(v)
                else:
                    temp_data[k] = cls.format_data(v)
            table_data.append(temp_data)
        return table_data

    @classmethod
    def get_next(cls, id_field, attempts=0):
        next_id = None
        try:
            next_id = 1
            results = cls.objects({}).aggregate(
                [
                    {"$project": {"ids": "$" + id_field}},
                    {"$group": {"_id": "max_id", "max_id": {"$max": "$ids"}}},
                ]
            )
            results = list(results)
            results = results[0] if len(results) > 0 else results
            if "max_id" in results and results["max_id"]:
                next_id = int(results["max_id"]) + 1
        except:
            if attempts < 3:
                db.init_app(current_app)
                attempts += 1
                time.sleep(1)
                cls.get_next(id_field, attempts)
        return next_id

class PaginatedAPIMixin(object):

    @staticmethod
    def to_collection_dict(query, page, per_page, endpoint, **kwargs):
        resources = query.paginate(page, per_page, False)
        data = {
            "items": [item.to_dict() for item in resources.items],
            "_meta": {
                "page": page,
                "per_page": per_page,
                "total_pages": resources.pages,
                "total_items": resources.total,
            },
            "_links": {
                "self": url_for(endpoint, page=page, per_page=per_page, **kwargs),
                "next": (
                    url_for(endpoint, page=page + 1, per_page=per_page, **kwargs)
                    if resources.has_next
                    else None
                ),
                "prev": (
                    url_for(endpoint, page=page - 1, per_page=per_page, **kwargs)
                    if resources.has_prev
                    else None
                ),
            },
        }
        return data

class AuditTrail(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    trail_id = db.IntField(indexed=True, unique=True)
    description = db.StringField()
    oldData = db.DictField()
    newData = db.DictField()
    changeTime = db.DateTimeField(default=datetime.now())
    changeType = db.StringField(indexed=True)
    affectedTable = db.StringField(indexed=True)
    username = db.StringField(indexed=True)
    user_id = db.IntField(indexed=True)
    meta = {
        "db_alias": "default",
        "collection": "AuditTrail",
        "indexes": [
            (
                "trail_id",
                "description",
                "oldData",
                "newData",
                "changeTime",
                "changeType",
                "affectedTable",
                "username",
                "user_id",
                "created_datetime",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "idField": "trail_id",
            "display_map": {
                "trail_id": "Trail ID",
                "description": "Description",
                "oldData": "Old Data",
                "newData": "New Data",
                "changeTime": "Change Time",
                "changeType": "Change Type",
                "userName": "UserName",
                "userID": "userID",
                "created_datetime": "Created Datetime",
                "current_version": "Current Version",
            },
            "sc": 0,
            "order": [
                "trail_id",
                "description",
                "oldData",
                "newData",
                "changeTime",
                "changeType",
                "affectedTable",
                "userName",
                "userID",
                "created_datetime",
            ],
        }

    @classmethod
    def log_to_trail(cls, trail_info):
        """
        trail_info.keys()   = old_object, new_object, description, change_type, object_type,user_id=0,username='system'
        trail_info_template = {'old_object': '', 'new_object':'', 'description':'', change_type':'', object_type':'','user_id':'0','username':'system'}
        """
        trail_id = cls.get_record_count() + 1
        old_object = None
        new_object = None
        if trail_info["old_object"]:
            old_object = (
                cls.get_row_data(trail_info["old_object"])
                if type(trail_info["old_object"]) is dict
                else cls.get_row_data(json.loads(trail_info["old_object"].to_json()))
            )
        else:
            old_object = {}
        if trail_info["new_object"]:
            new_object = (
                cls.get_row_data(trail_info["new_object"])
                if type(trail_info["new_object"]) is dict
                else cls.get_row_data(json.loads(trail_info["new_object"].to_json()))
            )
        else:
            new_object = {}

        changeTime = datetime.now()
        username = trail_info["username"]
        user_id = trail_info["user_id"]
        trail = cls(
            trail_id=trail_id,
            description=trail_info["description"],
            oldData=old_object,
            newData=new_object,
            changeTime=changeTime,
            changeType=trail_info["change_type"],
            affectedTable=trail_info["object_type"],
            username=username,
            user_id=user_id,
            created_datetime=datetime.now(),
            current_version=0,
        )
        trail.save()

    def __repr__(self):
        return "<AuditTrail {}>".format(self.trail_id)

class Users(UserMixin, SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    """
    --------------------
    Group Administrators
    --------------------

    """

    ADMIN = 0
    USER = 1
    GROUP_ADMIN = 2
    DISABLED = 0
    ACTIVE = 1
    id = db.IntField(primary_key=True)
    user_id = db.IntField(unique=True, index=True)
    username = db.StringField(max_length=(64), index=True, unique=True)
    passwordHash = db.StringField()
    creationDate = db.DateTimeField(index=True, default=datetime.now)
    locked = db.BooleanField(default=False)
    role_id = db.IntField(default=0)  # Admins, Users, GROUP_ADMIN
    connectionStatus = db.BooleanField(default=False)
    active = db.BooleanField(default=False)
    loginCount = db.IntField(default=0)
    lastModifiedDate = db.DateTimeField(index=True, default=datetime.now)
    login_attempts = db.IntField(default=0)
    token = db.StringField()
    token_expiration = db.DateTimeField()
    email = db.StringField()
    meta = {
        "db_alias": "default",
        "collection": "Users",
        "indexes": [
            (
                "id",
                "user_id",
                "username",
                "passwordHash",
                "email",
                "locked",
                "connectStatus",
                "active",
                "login_attempts",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "idField": "user_id",
            "display_map": {
                "user_id": "user_id",
                "username": "Username",
                "locked": "Locked",
                "role_id": "Role ID",
                "connectionStatus": "Connection Status",
                "active": "active",
                "loginCount": "Login Count",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 3,
            "order": [
                "user_id",
                "username",
                "email",
                "locked",
                "role_id",
                "connectionStatus",
                "active",
                "loginCount",
                "login_attempts",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<User {}>".format(self.username)

    def set_password(self, password):
        self.passwordHash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.passwordHash, password)

    def avatar(self, size):
        digest = md5(self.email.lower().encode("utf-8")).hexdigest()
        return "https://www.gravatar.com/avatar/{}?d=identicon&s={}".format(
            digest, size
        )

    def get_reset_password_token(self, expires_in=600):
        return jwt.encode(
            {"reset_password": self.id, "exp": time() + expires_in},
            current_app.config["SECRET_KEY"],
            algorithm="HS256",
        ).decode("utf-8")

    @staticmethod
    def get_serial_index():
        return 3

    @staticmethod
    def verify_reset_password_token(token):
        try:
            id = jwt.decode(
                token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
            )["reset_password"]
        except:
            return
        return Users.objects(id=id).first()

    def to_dict(self, include_email=False):
        data = {}
        if include_email:
            data["email"] = self.email
        return data

    def from_dict(self, data, new_user=False):
        for field in ["username", "email", "about_me"]:
            if field in data:
                setattr(self, field, data[field])
        if new_user and "password" in data:
            self.set_password(data["password"])

    def get_token(self, expires_in=3600):
        now = datetime.now()
        if self.token and self.token_expiration > now + timedelta(seconds=60):
            return self.token
        self.token = base64.b64encode(os.urandom(24)).decode("utf-8")
        self.token_expiration = now + timedelta(seconds=expires_in)
        db.session.add(self)
        return self.token

    def revoke_token(self):
        self.token_expiration = datetime.now() - timedelta(seconds=1)

    @staticmethod
    def check_token(token):
        user = Users.objects(token=token).first()
        if user is None or user.token_expiration < datetime.now():
            return None
        return user

    # def is_authenticated(self):
    #    return self.connectionStatus

class Images(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):

    image_id = db.IntField(unique=True)
    image_name = db.StringField(unique=True, index=True)
    file_name = db.StringField(index=True)
    file_path = db.StringField(index=True, unique=True)
    image_type = db.StringField(index=True)
    file_size = db.StringField()
    image_dimensions = db.StringField()
    image_format = db.StringField()
    file_type = db.StringField()
    image_url = db.StringField(index=True, unique=True)
    webkit_relative_path = db.StringField()
    google_file_id = db.StringField(index=True)
    google_url = db.StringField(index=True)
    image_last_modified = db.StringField()
    transparent_background = db.BooleanField(default=False)

    meta = {
        "db_alias": "default",
        "collection": "Images",
        "indexes": [
            (
                "image_id",
                "image_name",
                "file_name",
                "file_path",
                "image_type",
                "image_url",
                "google_url",
                "google_id",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "file_name",
            "idField": "image_id",
            "display_map": {
                "image_id": "Image ID",
                "image_name": "Image Name",
                "image_type": "Image Type",
                "file_name": "File Name",
                "file_path": "File Path",
                "file_size": "File Size",
                "image_dimensions": "Dimensions",
                "image_format": "Image Format",
                "image_url": "Image URL",
                "transparent_background": "Transparent Background",
                "last_modified_date": "Last Modified Date",
                "created_datetime": "Created Datetime",
            },
            "sc": 0,
            "order": [
                "image_id",
                "image_name",
                "image_type",
                "file_name",
                "file_path",
                "file_size",
                "image_dimensions",
                "image_format",
                "image_url",
                "transparent_background",
                "last_modified_date",
                "created_datetime",
            ],
        }

class Jobs(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    """
    ----------------------------
    Stores all Redis job details
    ----------------------------
    """

    QUEUED = 0
    RUNNING = 1
    SUCCEEDED = 2
    FAILED = 3

    job_id = db.StringField(unique=True)
    name = db.StringField()
    parameters = db.StringField()
    description = db.StringField()
    complete = db.BooleanField(default=False)
    startTime = db.DateTimeField(default=datetime.now())
    endTime = db.DateTimeField()
    progress = db.IntField()
    jobStatus = db.IntField(choices=[QUEUED, RUNNING, SUCCEEDED, FAILED])
    info = db.ListField()
    schedule = db.StringField()
    errors = db.ListField()
    last_modified_date = db.DateTimeField(default=datetime.now())

    meta = {
        "db_alias": "default",
        "collection": "Jobs",
        "indexes": [
            (
                "job_id",
                "name",
                "parameters",
                "report_id",
                "startTime",
                "endTime",
                "jobStatus",
                "info",
                "schedule",
                "last_modified_date",
                "current_version",
            )
        ],
    }

class SiteSettings(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    """
    Site Settings
    """

    ONLINE = 0
    LOCAL = 1
    settings_id = db.IntField(unique=True, index=True)
    site_name = db.StringField()
    site_id = db.StringField()
    site_title = db.StringField()
    site_description = db.StringField()
    site_logo = db.StringField()
    site_icon = db.StringField()
    login_image = db.StringField()
    site_keywords = db.StringField()
    startup_message = db.StringField()
    secret_key = db.StringField()
    address = db.StringField()
    email = db.StringField()
    phone_number = db.StringField()
    contact_us_message = db.StringField()
    google_map = db.StringField()
    social_media = db.DictField()
    sync_mode = db.IntField(choices=[ONLINE, LOCAL])
    time_out_minutes = db.IntField()
    overrides = db.DictField()
    default_mailing_account = db.StringField()
    home_page_id = db.IntField()

    meta = {
        "db_alias": "default",
        "collection": "SiteSettings",
        "indexes": [
            ("settings_id", "created_datetime", "last_modified_date", "home_page_id", "current_version")
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "faq_id",
            "idField": "faq_id",
            "display_map": {
                "settings_id": "Settings ID",
                "site_name": "Site Name",
                "site_id": "Site ID",
                "site_title": "Site Title",
                "site_description": "Site Description",
                "site_logo": "Site Logo",
                "site_icon": "Site Icon",
                "home_page_id": "Home Page",
                "login_image": "Login Image",
                "site_keywords": "Site Keywords",
                "startup_message": "Startup Message",
                "secret_key": "Secret key",
                "address": "Address",
                "email": "Email",
                "phone_number": "Phone Number",
                "google_map": "Google Map",
                "social_media": "Social media",
                "time_out_minutes": " Time Out Minutes",
                "overrides": "Overrides",
                "default_mailing_account": "Default Mailing Account",
                "created_datetime": "Created Datetime",
                "last_modified_date": "Last Modified Date",
                "current_version": "Current Version",
            },
            "sc": 0,
            "order": [
                "settings_id",
                "site_name",
                "site_id",
                "site_title",
                "site_description",
                "site_logo",
                "site_icon",
                "login_image",
                "home_page_id",
                "site_keywords",
                "startup_message",
                "secret_key",
                "address",
                "email",
                "phone_number",
                #"google_map",
                #"social_media",
                "time_out_minutes",
                #"overrides",
                "default_mailing_account",
                "created_datetime",
                "last_modified_date",
                "current_version",
            ],
        }

    def __repr__(self):
        return "<SiteSettings {}>".format(self.settings_id)

class Files(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):

    ATTACHMENTS = "attachments"
    file_id = db.IntField(unique=True)
    file_name = db.StringField(index=True)
    file_path = db.StringField(index=True, unique=True)
    file_size = db.StringField()
    file_type = db.StringField()
    actual_file_name = db.StringField(index=True, unique=True)
    file_format = db.StringField()
    file_url = db.StringField(index=True, unique=True)
    google_id = db.StringField(index=True)
    google_url = db.StringField(index=True)
    file_last_modified = db.StringField()
    meta = {
        "db_alias": "default",
        "collection": "Files",
        "indexes": [
            (
                "file_id",
                "file_name",
                "file_path",
                "actual_file_name",
                "file_url",
                "google_url",
                "google_id",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "file_name",
            "idField": "image_id",
            "display_map": {
                "image_id": "Image ID",
                "file_name": "File Name",
                "file_path": "File Path",
                "file_size": "File Size",
                "file_type": "File Type",
                "file_format": "File Format",
                "google_url": "File URL",
                "last_modified_date": "Last Modified Date",
                "created_datetime": "Created Datetime",
            },
            "sc": 0,
            "order": [
                "file_id",
                "file_name",
                "file_path",
                "file_size",
                "file_type",
                "file_format",
                "google_url",
                "last_modified_date",
                "created_datetime",
            ],
        }

class Roles(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):

    role_id = db.IntField(unique=True, index=True)
    role_name = db.StringField(unique=True, index=True)
    description = db.StringField()

    meta = {
        "db_alias": "default",
        "collection": "Roles",
        "indexes": [
            (
                "role_id",
                "role_name",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "Role Name",
            "idField": "role_id",
            "display_map": {
                "role_id": "Role ID",
                "role_name": "Role Name",
                "created_datetime": "Created Datetime",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 0,
            "order": [
                "role_id",
                "role_name",
                "description",
                "created_datetime",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<Roles {}>".format(self.role_name)

class Permissions(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    """
    Determine permissions assigned to Roles
    """

    permission_id = db.IntField(unique=True, index=True)
    permission_name = db.StringField(unique=True, index=True)
    description = db.StringField()

    meta = {
        "db_alias": "default",
        "collection": "Permissions",
        "indexes": [
            (
                "permission_id",
                "permission_name",
                "created_datetime",
                "last_modified_date",
            )
        ],
    }

    @staticmethod
    def get_schema():
        schema_data = {
            "titleField": "Permission Name",
            "idField": "permission_id",
            "permission": {
                "permission_id": "Permission ID",
                "permission_name": "Permission Name",
                "create_datetime": "Create Datetime",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 0,
            "order": [
                "permission_id",
                "permission_name",
                "description",
                "create_datetime",
                "last_modified_date",
            ],
        }
        return schema_data

    def __repr__(self):
        return "<Permissions {}>".format(self.permission_name)

class GMailAccounts(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    account_id = db.IntField(unique=True, index=True)
    account_name = db.StringField(unique=True, index=True)
    email_address = db.StringField(index=True)
    api_key = db.StringField()
    servers = db.StringField(index=True)
    credential_file = db.StringField()
    token_file = db.StringField()
    meta = {
        "db_alias": "default",
        "collection": "GmailAccounts",
        "indexes": [
            (
                "account_id",
                "account_name",
                "email_address",
                "api_key",
                "servers",
                "created_datetime",
                "last_modified_date",
            )
        ],
    }

    @staticmethod
    def get(find_params=None):
        find_params = {} if find_params == None else find_params

        data = GMailAccounts.objects(**find_params).first()
        return data

    @staticmethod
    def find(find_params=None):
        find_params = {} if find_params == None else find_params

        data = GMailAccounts.objects(**find_params)
        return data

    @staticmethod
    def get_schema():
        return {
            "titleField": "account_name",
            "idField": "account_id",
            "display_map": {
                "account_id": "Account ID",
                "account_name": "Account Name",
                "servers": "Servers",
                "credential_file": "Credentials File",
                "token_file": "Token File",
                "last_modified_date": "Last Modified Date",
                "created_datetime": "Created Datetime",
            },
            "sc": 0,
            "order": [
                "account_id",
                "account_name",
                "email_address",
                "api_key",
                "servers",
                "credential_file",
                "token_file",
                "created_datetime",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<GMailAccount {}>".format(self.account_name)

class IMAPAccounts(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    account_id = db.IntField(unique=True)
    account_name = db.StringField(unique=True, index=True)
    imap_server_address = db.StringField(unique=True)
    imap_username = db.StringField()
    imap_password = db.StringField()
    imap_security = db.StringField()
    imap_port = db.IntField()
    created_datetime = db.DateTimeField(default=datetime.now())
    last_modified_date = db.DateTimeField(default=datetime.now())
    current_version = db.IntField(default=0)
    meta = {
        "db_alias": "default",
        "collection": "IMAPAccounts",
        "indexes": [
            (
                "account_id",
                "account_name",
                "imap_server_address",
                "imap_username",
                "imap_port",
                "imap_security",
                "created_datetime",
                "last_modified_date",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "imap_server_address",
            "idField": "account_id",
            "display_map": {
                "account_id": "Account ID",
                "account_name": "Account Name",
                "servers": "Servers",
                "credential_file": "Credentials File",
                "token_file": "Token File",
                "last_modified_date": "Last Modified Date",
                "created_datetime": "Created Datetime",
            },
            "sc": 0,
            "order": [
                "account_id",
                "account_name",
                "imap_server_address",
                "imap_username",
                "imap_password",
                "imap_port",
                "imap_security",
                "created_datetime",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<IMAPAccount {}>".format(self.imap_server_address)

class MailTemplates(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):

    template_id = db.IntField(unique=True, index=True)
    template_name = db.StringField(unique=True, index=True)
    description = db.StringField()
    contents = db.StringField()
    last_modified_date = db.DateTimeField(default=datetime.now())
    created_datetime = db.DateTimeField(default=datetime.now())
    current_version = db.IntField(default=0)
    meta = {
        "db_alias": "default",
        "collection": "MailTemplates",
        "indexes": [
            (
                "template_id",
                "template_name",
                "created_datetime",
                "last_modified_date",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "Template Name",
            "idField": "template_id",
            "display_map": {
                "template_id": "Template ID",
                "template_name": "Template Name",
                "created_datetime": "Created Datetime",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 0,
            "order": [
                "template_id",
                "template_name",
                "description",
                "created_datetime",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<MailTemplates {}>".format(self.template_name)

class EventTypes(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):

    type_id = db.IntField(unique=True, index=True)
    type_name = db.StringField(unique=True, index=True)
    description = db.StringField()
    handler = db.StringField()
    template = ReferenceField(MailTemplates, reverse_delete_rule=CASCADE)
    meta = {
        "db_alias": "default",
        "collection": "EventTypes",
        "indexes": [
            (
                "type_id",
                "type_name",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "Type Name",
            "idField": "type_id",
            "display_map": {
                "type_id": "Type ID",
                "type_name": "Type Name",
                "handler": "Event Handler",
                "template": "Mail Template",
                "description": "Description",
                "created_datetime": "Created Datetime",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 0,
            "order": [
                "type_id",
                "type_name",
                "handler",
                "template",
                "description",
                "created_datetime",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<EventTypes {}>".format(self.type_name)

class Events(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):

    PENDING = 0
    SENT = 1
    ERR0R = 2

    OPEN = "OPEN"
    CLOSED = "CLOSED"
    MUTED = "MUTED"

    event_id = db.IntField(index=True, unique=True)
    event_name = db.StringField(index=True, unique=True)
    description = db.StringField()
    event_type = ReferenceField(EventTypes, reverse_delete_rule=CASCADE)
    parameters = db.DictField()
    event_status = db.StringField(indexed=True, default=OPEN)
    mail_template = ReferenceField(MailTemplates, reverse_delete_rule=CASCADE)
    notification_status = db.IntField()
    job = ReferenceField(Jobs, reverse_delete_rule=CASCADE)
    job_history =  db.ListField()

    meta = {
        "db_alias": "default",
        "collection": "Events",
        "indexes": [
            (
                "event_id",
                "event_name",
                "event_status",
                "event_type",
                "notification_status",
                "created_datetime",
                "last_modified_date",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "event_id",
            "idField": "id",
            "display_map": {
                "event_id": "Event ID",
                "event_name": "Event Name",
                "event_status": "Event Status",
                "Description": "Description",
                "mail_template": "Mail Template",
                "event_type": "Event Type",
                "notification_status": "Notification Status",
                "job": "Job",
                "description": "Description",
                "parameters": "parameters",
                "created_datetime": "Created Datetime",
                "last_modified_date": "Last Modified Datetime",
                "job_history": "Job History",
            },
            "sc": 0,
            "order": [
                "event_id",
                "event_name",
                "event_type",
                "event_status",
                "parameters",
                "mail_template",
                "notification_status",
                "job",
                "job_history",
                  "created_datetime",
                "last_modified_date",
            ],
        }

    def log_job_details(self, redis_job, job_name, parameters, schedule_id=0):

        parameters = json.dumps(parameters)
        # running_job = Jobs.get({"name": job_name, "parameters": parameters})
        job_id = redis_job.id
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

    def start(self):
        """
        Initiates an events. Event parameters should be passed as objects for simplicity.
        """
        handler = self.event_type.handler
        parameters = self.parameters
        job_name = f"app.tasks.{handler}"
        job = current_app.task_queue.enqueue(
            job_name,
            args=[parameters],
            job_timeout=int(current_app.config["SYNC_INTERVAL"]),
            retry=Retry(max=3, interval=[10, 30, 60]),
        )

        running_job = self.log_job_details(job, job_name, parameters)
        name = self.event_name
        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"Event: {name} started successfully  at {current_date} ")
        return running_job

    @staticmethod
    def create(parameters):
        """ "
        parameters should containe job_paramaters, trigger_id or (event_type_id and schedule_id, event_name, description) and
        other details that can be used to start an event.

        NB:  If start is False, the Event should be saved when returned.

        The start parameters should be disabled by the job to avoid starting afresh when new events are created.
        """

        event_type = None
        mail_template = None
        trigger = None
        event = None

        if "trigger_id" in parameters:
            trigger = EventTriggers.get({"trigger_id": int(parameters["trigger_id"])})
            event_type = trigger.event_type
            mail_template = event_type.template
        else:
            event_type_id = (
                parameters["event_type_id"] if "event_type_id" in parameters else None
            )
            event_type = EventTypes.get({"type_id": int(event_type_id)})
            mail_template = event_type.mail_template

        event_id = Events.get_next("event_id")
        event_name = ""
        description = ""
        if trigger:

            current_time = datetime.now()
            temp = {}
            temp[current_time] = event_id
            trigger_count = int(trigger.trigger_count) + 1
            name_suffix = f"_0{trigger_count}"
            event_name = event_type.type_name + name_suffix
            temp_event = Events.get({"event_name": event_name})
            if temp_event:
                trigger_count+=1
                name_suffix = f"_0{trigger_count}"
                event_name = event_type.type_name + name_suffix
            description = f"A new  run of the {event_type.type_name} event"
        else:
            event_name = parameters["event_name"]
            description = parameters["description"]

        parameters["event_id"] = event_id
        handler = event_type.handler
        parameters["job_name"] = f"app.tasks.{handler}"

        event = Events(
            event_id=int(event_id),
            event_name=event_name,
            description=description,
            event_type=event_type,
            parameters=parameters,
            event_status=Events.OPEN,
            mail_template=mail_template,
            notification_status=Events.PENDING,
        )

        if "start" in parameters and parameters["start"]:
            # print("Saving event")
            # print(event_id)
            # print(event_name)
            event.save()
            event.job = event.start()
            event.save()     

        return event

    def __repr__(self):
        return "<Event {self.event_name}>"

class Schedules(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    schedule_id = db.IntField(index=True, unique=True)
    name = db.StringField(index=True, unique=True)
    start_time = db.DateTimeField(default=datetime.now())
    end_time = db.DateTimeField(default=datetime.now())
    description = db.StringField()
    repeat = db.IntField()
    months = db.IntField(default=0)
    weeks = db.IntField(default=0)
    days = db.IntField(default=0)
    hours = db.IntField(default=0)
    minutes = db.IntField(default=0)
    seconds = db.IntField(default=0)
    schedule_status = db.IntField(default=0)
    DISABLED = 0
    ACTIVE = 1
    meta = {
        "db_alias": "default",
        "collection": "Schedules",
        "indexes": [
            (
                "id",
                "schedule_id",
                "name",
                "startTime",
                "scheduleStatus",
                "created_datetime",
                "last_modified_date",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "db_alias": "default",
            "collection": "scheduless",
            "titleField": "id",
            "idField": "schedule_id",
            "display_map": {
                "_id": "_id",
                "id": "ID",
                "name": "Name",
                "createdtime": "Created Time",
                "start_time": "Start Time",
                "description": "Description",
                "repeat": "Repeat",
                "months": "Months",
                "weeks": "Weeks",
                "days": "Days",
                "hours": "Hours",
                "minutes": "Minutes",
                "seconds": "Seconds",
                "schedule_status": "Schedule Status",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 0,
            "order": [
                "id",
                "name",
                "created_datetime",
                "start_time",
                "description",
                "repeat",
                "months",
                "weeks",
                "days",
                "hours",
                "minutes",
                "seconds",
                "schedule_status",
                "last_modified_date",
            ],
        }

    def get_interval(self):
        if self.scheduleStatus == self.DISABLED:
            return None
        elif self.startTime >= datetime.utcnow():
            time_remaining = (self.startTime - datetime.utcnow()).seconds
            self.repeat = self.repeat if self.repeat else 0
            return self.repeat + time_remaining
        elif self.repeat != 9999999999:
            return self.repeat
        else:
            return (
                int(self.months)
                + int(self.weeks)
                + int(self.days)
                + int(self.hours)
                + int(self.minutes)
                + int(self.seconds)
            )

    def __repr__(self):
        return "<Schedule {}>".format(self.schedule_id)

class EventTriggers(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):

    trigger_id = db.IntField(unique=True, index=True)
    trigger_name = db.StringField(unique=True, index=True)
    description = db.StringField()
    event_type = ReferenceField(EventTypes, reverse_delete_rule=CASCADE)
    schedule = ReferenceField(Schedules)
    parameters = db.DictField()
    trigger_count = db.IntField()
    trigger_history = db.DictField()  # {"event_id":"event_date"}
    meta = {
        "db_alias": "default",
        "collection": "EventTriggers",
        "indexes": [
            (
                "trigger_id",
                "trigger_name",
                "event_type",
                "trigger_count",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "Type Name",
            "idField": "type_id",
            "display_map": {
                "trigger_id": "Trigger ID",
                "trigger_name": "Trigger Name",
                "description": "Description",
                "event_type": "Event Type",
                "parameters": "parameters",
                "schedule": "Schedule",
                "trigger_count": "Trigger Count",
                "trigger_history": "Trigger History",
                "created_datetime": "Created Datetime",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 0,
            "order": [
                "trigger_id",
                "trigger_name",
                "description",
                "event_type",
                "parameters",
                "schedule",
                "trigger_count",
                "trigger_history",
                "created_datetime",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<EventTriggers {}>".format(self.trigger_name)
