import inspect
import json
import logging
import os
from datetime import datetime, timedelta
from logging.handlers import RotatingFileHandler, SMTPHandler
import bson, rq, rq_dashboard
from flask import Flask, request, has_request_context  # , current_app
from flask_babel import Babel
from flask_babel import lazy_gettext as _l
from flask_bootstrap import Bootstrap5
from flask_caching import Cache
from flask_login import LoginManager
from flask_mail import Mail
from flask_moment import Moment

# from json import JSONEncoder
from flask_mongoengine import MongoEngine
from flask_session import Session
from flask_wtf import CSRFProtect
from redis.commands.search.field import TextField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis import Redis
from redis.retry import Retry
from redis.exceptions import TimeoutError, ConnectionError
from redis.backoff import ExponentialBackoff
from rq_scheduler import Scheduler
from config import Config
from flask.logging import default_handler

from flask import has_request_context, request
from flask.logging import default_handler

import socket

class RequestFormatter(logging.Formatter):
    def format(self, record):
        if has_request_context():
            record.url = request.url
            record.remote_addr = request.remote_addr
        else:
            record.url = None
            record.remote_addr = None

        return super().format(record)


def get_debug_template():
    from inspect import currentframe, getframeinfo

    return (
        "\nFile \"{}\",\nline {}\nFunction (Method): '{}'\nMessage: {}\n",
        getframeinfo,
        currentframe,
    )


template = get_debug_template()[0]


def log(message, method_name, file_name, line_no):
    print(
        template.format(
            file_name,
            int(line_no),
            method_name,
            message,
        )
    )


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.datetime, datetime.date, datetime.time)):
            return obj.isoformat()
        elif isinstance(obj, datetime.timedelta):
            return (datetime.datetime.min + obj).time().isoformat()
        elif isinstance(obj, bson.objectid.ObjectId):
            return str(bson.objectid.ObjectId(obj))

        return super(DateTimeEncoder, self).default(obj)


def check_redis(app):
    try:
        app.redis.ping()
        print("Successfully connected to redis!")
        return True
    except app.redis.exceptions.ConnectionError as e:
        print(e)
        return False


def get_redis_connection(app, redis_host, redis_port, redis_user, redis_pass):
    redis = None
    if hasattr(app, "redis") and check_redis(app):
        redis = app.redis
    else:
        try:
            redis = Redis(
                host=redis_host,
                port=redis_port,
                username=redis_user,
                password=redis_pass,
                socket_connect_timeout=(10),
                socket_timeout=(10),
                retry=Retry(ExponentialBackoff(cap=10, base=1), 25),
                retry_on_error=[ConnectionError, TimeoutError, ConnectionResetError],
                health_check_interval=(60),
                socket_keepalive=1000,
                retry_on_timeout=True,
            )
        except:
            if hasattr(app, "redis"):
                print("Closing redis connection due to error...")
                app.redis.close()
                print("Done.\nReinitiating Redis Connection...")
            redis = Redis(
                host=redis_host,
                port=redis_port,
                username=redis_user,
                password=redis_pass,
                socket_connect_timeout=(10),
                socket_timeout=(10),
                retry=Retry(ExponentialBackoff(cap=10, base=1), 25),
                retry_on_error=[ConnectionError, TimeoutError, ConnectionResetError],
                health_check_interval=(60),
                socket_keepalive=1000,
                retry_on_timeout=True,
            )
        return redis


login = LoginManager()
login.login_view = "auth.admin_login"
login.login_message = _l("Please log in.")
mail = Mail()
bootstrap = Bootstrap5()
moment = Moment()
babel = Babel()
db = MongoEngine()
session = Session()
session.permanent = True
settings = None
is_running = False
context = None
csrf = CSRFProtect()
cache = Cache(config={"CACHE_TYPE": Config.CACHE_TYPE})


def create_app(config_class=Config, is_redis=False):
    app = Flask(__name__)
    app.config.from_object(config_class)
    global settings
    settings = app.config
    app.permanent_session_lifetime = timedelta(
        minutes=app.config["SESSION_DURATION_MINS"]
    )
    app.session_type = app.config["SESSION_TYPE"]
    app.secret_key = app.config["SECRET_KEY"]
    app.json_encoder = DateTimeEncoder
    db.init_app(app)
    session.init_app(app)
    login.init_app(app)
    mail.init_app(app)
    bootstrap.init_app(app)
    moment.init_app(app)
    babel.init_app(app)
    csrf.init_app(app)
    cache.init_app(app)

    if (
        not is_redis
        and app.config["REDIS_URL"] is not None
        and app.config["REDIS_URL"] != ""
    ):
        rq_dashboard.web.setup_rq_connection(app)
        if len(app.config["REDIS_URL"].split("@")) < 2:
            app.redis = Redis.from_url(app.config["REDIS_URL"])
        else:
            redis_url = app.config["REDIS_URL"]
            redis_url = redis_url.replace("redis://", "")
            redis_url = redis_url.replace("rediss://", "")
            credential_portion = redis_url.split("@")[0]
            host_portion = redis_url.split("@")[1]
            redis_user = credential_portion.split(":")[0]
            redis_pass = credential_portion.split(":")[1]
            redis_host = host_portion.split(":")[0]
            redis_port = host_portion.split(":")[1]
            app.redis = get_redis_connection(
                app, redis_host, redis_port, redis_user, redis_pass
            )
        ## The queue name is case sensitive. if the wrong case of is used for the name, the workers would not start jobs.
        app.task_queue = rq.Queue(app.config["REDIS_QUEUE_NAME"], connection=app.redis)
        app.scheduler = Scheduler(queue=app.task_queue, connection=app.redis)
        # job_id = TextField("$.job_id")
        # app.redis.ft().create_index([job_id])

        # from app.errors import bp as errors_bp
        # from app.tasklist import bp as tasklist_bp

        # from app.auth import bp as auth_bp

        from app.main import bp as main_bp
        from app.api import bp as api_bp
        from app.cpanel import bp as cpanel_bp
        from app.auth import bp as auth_bp

        app.register_blueprint(main_bp)
        app.register_blueprint(api_bp)
        app.register_blueprint(cpanel_bp)
        app.register_blueprint(auth_bp)
        app.register_blueprint(rq_dashboard.blueprint, url_prefix="/redis")

        # app.register_blueprint(errors_bp, url_prefix='/errors')
        #
        app.permanent_session_lifetime = timedelta(
            minutes=int(app.config["SESSION_DURATION_MINS"])
        )
        # app.register_blueprint(tasklist_bp, url_prefix='/tasks')

        # if not app.debug and not app.testing:  # and not is_running:
        #

        formatter = RequestFormatter(
            "[%(asctime)s] %(remote_addr)s requested %(url)s\n"
            "%(levelname)s in %(module)s: %(message)s [in %(pathname)s:%(lineno)d]"
        )

        if (
            "MAIL_SERVER" in app.config
            and app.config["MAIL_SERVER"] is not None
            and app.config["MAIL_SERVER"] != ""
            
        ):
            auth = None
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(2)
            mail_server_reachable = False
            try:
                s.connect(
                    (app.config["MAIL_SERVER"], app.config["MAIL_PORT"])
                )  # Port ,Here 22 is port
            except:
                pass

            if ( mail_server_reachable):
                if app.config["MAIL_USERNAME"] or app.config["MAIL_PASSWORD"]:
                    auth = (app.config["MAIL_USERNAME"], app.config["MAIL_PASSWORD"])
                secure = None
                if app.config["MAIL_USE_TLS"]:
                    secure = ()
                mail_handler = SMTPHandler(
                    mailhost=(app.config["MAIL_SERVER"], app.config["MAIL_PORT"]),
                    fromaddr="no-reply@" + str(app.config["MAIL_SERVER"]),
                    toaddrs=app.config["ADMINS"],
                    subject="{} Server Error".format(app.config["SITE_ID"]),
                    credentials=auth,
                    secure=secure,
                )
                mail_handler.setLevel(logging.ERROR)
                mail_handler.setFormatter(formatter)
                app.logger.addHandler(mail_handler)

        if app.config["LOG_TO_STDOUT"]:
            stream_handler = logging.StreamHandler()
            stream_handler.setLevel(logging.INFO)
            app.logger.addHandler(stream_handler)

        if app.config["LOG_TO_FILE"]:
            basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
            logs_path = os.path.join(basedir, "logs")
            if not os.path.exists(logs_path):
                os.mkdir(f"{logs_path}")
            site_prefix = app.config["SITE_ID"]
            date_suffix = datetime.now().strftime(
                datetime.now().strftime("%Y%m%d")
                # datetime.now().strftime("%Y%m%d_%H%M00")
                # datetime.now().strftime("%Y%m%d_%H%M%S")
            )
            logfile_name_format = f"{site_prefix}-{date_suffix}"
            file_handler = RotatingFileHandler(
                "{}/{}.log".format(logs_path, logfile_name_format),
                backupCount=10,
                maxBytes=1000000,
            )
            file_handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s %(levelname)s: %(message)s "
                    "[in %(pathname)s:%(lineno)d]"
                )
            )
            file_handler.setLevel(logging.INFO)
            file_handler.setFormatter(formatter)
            app.logger.addHandler(file_handler)

    app.logger.setLevel(logging.INFO)
    # global logger
    # logger = app.logger
    app.logger.info(
        "#########################################################################################################################"
    )
    app.logger.info(app.config["STARTUP_MESSAGE"])
    return app


# @babel.localeselector
# def get_locale():
#    return request.accept_languages.best_match(current_app.config['LANGUAGES'])
