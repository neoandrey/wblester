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


from app.generic_models import *


class PageTemplates(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    """
    ---------------------------
    Define templates for pages
    ---------------------------
    """

    template_id = db.IntField(unique=True, index=True)
    name = db.StringField(unique=True, index=True)
    description = db.StringField()
    contents = db.StringField()
    meta = {
        "db_alias": "default",
        "collection": "PageTemplates",
        "indexes": [
            (
                "template_id",
                "name",
                "description",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "Name",
            "idField": "template_id",
            "display_map": {
                "template_id": "Template ID",
                "name": "Name",
                "description": "Description",
                "created_datetime": "Created Datetime",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 0,
            "order": [
                "template_id",
                "name",
                "description",
                "contents",
                "created_datetime",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<PageTemplates {}>".format(self.name)

class Banners(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    """
    ------------------------------------------------------------------
    Defines the contents of the header. It's part of the site settings
    ------------------------------------------------------------------
    """

    banner_id  = db.IntField(unique=True, index=True)
    name       = db.StringField(unique=True, index=True)
    title      = db.StringField()
    page_links = db.ListField()  # this should be a list of dictionaries -  {"class":"", "href": '', "text": ""}
    image      = ReferenceField(Images, reverse_delete_rule=CASCADE)
    is_active  = db.BooleanField(default=False)
    meta = {
        "db_alias": "default",
        "collection": "Banners",
        "indexes": [
            (
                "banner_id",
                "name",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "Banner",
            "idField": "banner_id",
            "display_map": {
                "banner_id": "Banner ID",
                "title": "Title",
                "page_links": "Page Links",
                "image": "Image",
				"is_active":  "Is Active"
            },
            "sc": 0,
            "order": ["banner_id", "title",  "image", "is_active"],
        }

    def __repr__(self):
        return "<Banners {}>".format(self.banner_id)

class Sliders(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    """
    ------------------------------------------------------------------
    Defines the contents of the Sliders.
    ------------------------------------------------------------------
    """

    slider_id = db.IntField(unique=True, index=True)
    name      = db.StringField(unique=True, index=True)
    image     = ReferenceField(Images, reverse_delete_rule=CASCADE)
    line1     = db.StringField()
    line2     = db.StringField()
    is_active = db.BooleanField(default=False)
    meta      = {
                "db_alias": "default",
                "collection": "Sliders",
                "indexes": [
                    (
                        "slider_id",
                        "name",
                        "created_datetime",
                        "last_modified_date",
                        "current_version",
                    )
                ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "name",
            "idField": "slider_id",
            "display_map": {
                "slider_id": "Slider ID",
                "name": "name",
                "image": "Image",
                "line1": "Line 1",
                "line2": "Line 2",
                "is_active": "Is Active",
            },
            "sc": 0,
            "order": [
                "slider_id",
                "name",
                "image",
                "line1",
                "line2",
                "is_active",
            ],
        }

    def __repr__(self):
        return "<Sliders {}>".format(self.name)

class Pages(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    """
    -------------------------
    Pages
    -------------------------
    """

    FREE_FORMAT = 0
    PREFORMATTED = 1
    STATIC= 0
    CAROUSEL = 1

    page_id = db.IntField(unique=True, index=True)
    page_name = db.StringField(unique=True, index=True)
    page_type = db.IntField(choices=[FREE_FORMAT, PREFORMATTED])
    banner_type = db.IntField(choices=[STATIC, CAROUSEL])
    banner = ReferenceField(Banners)
    is_parent = db.BooleanField(default=False)
    is_child = db.BooleanField(default=False)
    is_nav_page = db.BooleanField(default=False)
    comes_after = db.IntField()
    href = db.StringField(unique=True, index=True)
    is_restricted = db.BooleanField(default=False)
    parent_page = ReferenceField("self", reverse_delete_rule=CASCADE)
    contents = db.StringField()
    template = ReferenceField(PageTemplates, reverse_delete_rule=CASCADE)

    meta = {
        "db_alias": "default",
        "collection": "Pages",
        "indexes": [
            (
                "page_id",
                "page_name",
                "page_is_parent",
                "page_is_child",
                "is_restricted",
                "href",
                "template_id",
                "parent_page_id",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "Pages",
            "idField": "page_id",
            "display_map": {
                "page_id": "Page ID",
                "page_name": "Page Name",
                "banner": "Banner",
                "is_parent": "Has Kids",
                "is_child": "Has Parent",
                "is_nav_page": "Is Navigation Page",
                "comes_after": "Comes After",
                "is_restricted": "Is Restricted",
                "href": "URL",
                "parent_page_id": "Parent Page",
                "page_type": "Page  Type",
                "template_id": "Template ID",
                "created_datetime": "Created Datetime",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 0,
            "order": [
                "page_id",
                "page_name",
                "is_parent",
                "is_child",
                "href",
                "created_datetime",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<Pages {}>".format(self.page_name)

class Messages(SearchableMixin, PaginatedAPIMixin, db.DynamicDocument):
    """
    ----------------
    Client Messages
    ----------------
    """

    NEW = 0
    SEEN = 1
    RESPONDED = 2
    IGNORED = 3
    REPLY=4
    DRAFT=5
    message_id = db.IntField(unique=True, index=True)
    client_name = db.StringField(index=True)
    client_email = db.StringField(index=True)
    message_subject = db.StringField(index=True)
    message_status = db.IntField(choices=[NEW, SEEN, RESPONDED, IGNORED, REPLY, DRAFT])
    message_contents = db.StringField()
    message_notes     = db.StringField()
    client_phone     = db.StringField(index=True)
    reply_message = ReferenceField("self", reverse_delete_rule=CASCADE)

    meta = {
        "db_alias": "default",
        "collection": "Messages",
        "indexes": [
            (
                "message_id",
                "client_name",
                "client_email",
                "client_phone",
                 "message_subject",
                "message_status",
                "created_datetime",
                "last_modified_date",
                "current_version",
            )
        ],
    }

    @staticmethod
    def get_schema():
        return {
            "titleField": "message_id",
            "idField": "message_id",
            "display_map": {
                "message_id": "Message ID",
                "client_name": "Client Name",
                "client_email": "Client Email",
                "client_phone": "Client Phone",
                "message_subject": "Message Subject",
                "message_status": "Message Status",
                "created_datetime": "Created Datetime",
                "message_contents": "Message Contents",
                "message_notes": "Message Notes",
                "last_modified_date": "Last Modified Date",
            },
            "sc": 0,
            "order": [
                "message_id",
                "client_name",
                "client_email",
                "client_phone",
                "message_subject",
                "message_status",
                "created_datetime",
                "message_contents",
                "message_notes",
                "last_modified_date",
            ],
        }

    def __repr__(self):
        return "<Messages {}>".format(self.message_id)