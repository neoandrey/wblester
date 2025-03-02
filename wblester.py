from flask import request
from app import create_app, db, cli, login, mail, bootstrap, moment, babel, session
from app.models import Users, AuditTrail # ,Tasks
from datetime import datetime
import traceback

app = create_app()
cli.register(app)


# basedir = os.path.abspath(os.path.dirname(__file__))
# logs_path = os.path.join(basedir, "logs")
# if not os.path.exists(logs_path):
#     os.mkdir(f"{logs_path}")
# site_prefix = app.config["SITE_ID"]
# date_suffix = datetime.now().strftime(datetime.now().strftime("%Y%m%d"))
# logfile_name_format = f"{site_prefix}-{date_suffix}"
# logging.basicConfig(
#     format="%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]",
#     filename="{}/{}.log".format(logs_path, logfile_name_format),
#     level=logging.DEBUG,
# )

# if app.config["LOG_TO_FILE"]:
#     basedir = os.path.abspath(os.path.dirname(__file__))
#     logs_path = os.path.join(basedir, "logs")
#     if not os.path.exists(logs_path):
#         os.mkdir(f"{logs_path}")
#     site_prefix = app.config["SITE_ID"]
#     date_suffix = datetime.now().strftime(
#         datetime.now().strftime("%Y%m%d")
#         # datetime.now().strftime("%Y%m%d_%H%M00")
#         # datetime.now().strftime("%Y%m%d_%H%M%S")
#     )
#     logfile_name_format = f"{site_prefix}-{date_suffix}"
#     file_handler = RotatingFileHandler(
#         "{}/{}.log".format(logs_path, logfile_name_format),
#         maxBytes=10240,
#         backupCount=10,
#     )
#     file_handler.setFormatter(
#         logging.Formatter(
#             "%(asctime)s %(levelname)s: %(message)s " "[in %(pathname)s:%(lineno)d]"
#         )
#     )
#     file_handler.setLevel(logging.INFO)
#     app.logger.addHandler(file_handler)


@app.after_request
def after_request(response):
    timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
    try:
        status = (response.status_code.split(" ")[0]).strip()
        #print(status)
        if int(status) < 400:
            print("logging away...")
            app.logger.info(
                "%s %s %s %s %s %s", timestamp,
                request.remote_addr,
                request.method,
                response.status,
                response.status_code,
                request.scheme,
                request.full_path,
            )
    except:
        pass
    return response


@app.errorhandler(Exception)
def exceptions(e):
    tb = traceback.format_exc()
    timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
    try:
        pass
        #app.logger.error(
        #    f"%s %s %s %s %s {e.code} INTERNAL SERVER ERROR\n%s",
        #    timestamp,
        #    request.remote_addr,
        #    request.method,
        #    request.scheme,
        #    request.full_path,
        #    tb,
        #)
    except:
        pass
    return e


@app.shell_context_processor
def make_shell_context():
    return {
        "create_app": create_app,
        "db": db,
        "cli": cli,
        "login": login,
        "mail": mail,
        "bootstrap": bootstrap,
        "moment": moment,
        "babel": babel,
        "session": session,
        "users": Users,
        "auditTrail": AuditTrail,
        "settings": app.config,
    }  # ,'tasks':Tasks}


#
