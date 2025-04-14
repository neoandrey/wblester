from flask import (
    render_template,
    redirect,
    url_for,
    flash,
    request,
    session,
    jsonify,
    current_app,
)
from werkzeug.urls import url_parse
from flask_login import login_user, logout_user, current_user
from flask_babel import _
from app import db, login, get_debug_template, settings, log
from app.auth import bp
from app.auth.forms import (
    LoginForm,
    RegistrationForm,
    ResetPasswordRequestForm,
    ResetPasswordForm,
)
from app.models import Users, SiteSettings #, Clients

# from app.auth.email import send_password_reset_email
from datetime import datetime
from app.main.serializer import Serializer

key_maker = Serializer()
from uuid import uuid4
import traceback, inspect, json


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


@login.user_loader
def load_user(id):
    # print(get_debug_template()[0].format(get_debug_template()[1](get_debug_template()[2]()).filename, get_debug_template()[1](get_debug_template()[2]()).lineno,
    #                   'load_user', "id: {}".format(session['current_user'].__dict__['_data']['id'])))
    id = (
        session["current_user"].user_id
        if id is None or (id and str(id).lower() == "none")
        else id
    )
    # print(get_debug_template()[0].format(get_debug_template()[1](get_debug_template()[2]()).filename, get_debug_template()[1](get_debug_template()[2]()).lineno,
    #                   'load_user', "id: {}".format(id)))
    if "current_user" in session:
        user = session["current_user"]
    else:
        user = Users().get({"user_id": id})
        session["current_user"] = user
        session["current_user"]["acky"] = str(uuid4())
        session["client_info"] = get_client_info(request)
    return user if user else None


def get_row_data(data):
    temp_data = {}
    for k, v in data.items():
        temp_data[k] = format_data(v)
    return temp_data


@bp.route("/auth/creator/session", methods=["POST", "GET"])
@bp.route("/creator/session", methods=["POST", "GET"])
def check_creator_user():
    session_active = False
    if session.get("current_user"):
        if (
            session["current_user"].is_authenticated
            and not session["current_user"].locked
        ):
            session_active = True
    return jsonify({"session": session_active})


@bp.route("/auth/login", methods=["GET", "POST"])
@bp.route("/login", methods=["GET", "POST"])
def admin_login():
    """
    Handles login of administrative users into to main platform
    """
    try:
        user_id = (
            session["current_user"].user_id
            if "current_user" in session and session["current_user"].user_id
            else None
        )

        user = None
        next_page = request.args.get("next")
        next_page = next_page if next_page and next_page != "" else "/cpanel"

        if "current_user" in session and session["current_user"] != {}:
            if (
                session["current_user"].is_authenticated
                and not session["current_user"].locked
                and session["current_user"].active
            ):

                if not next_page or url_parse(next_page).netloc != "":
                    next_page = url_for("api.admin_panel")
                    #  print("Redirecting to admin")
                return redirect(next_page)
            elif session["current_user"].locked and session["current_user"].role != 1:
                flash("Account Locked!")
                return redirect(url_for("auth.admin_login"))
            elif session["current_user"].active and session["current_user"].role != 1:
                flash("Account Disabled!")
                return redirect(url_for("auth.admin_login"))

        # if user_id:
        #    user = Users.get({"user_id": user_id})

        form = LoginForm()

        if request.method == "POST":
            # print(f"username: {form.username.data}")
            user = Users.get({"username": form.username.data})

            if (
                not bool(user)
                or (user and user.locked)
                or (user and not user.active)
                or (user and not user.check_password(form.password.data))
            ):
                if user and user.login_attempts >= 5:
                    user.locked = True
                elif user and user.locked:
                    flash("Invalid username or password. Account locked.")
                else:
                    flash("Invalid username or password")
                if user:
                    user.login_attempts = int(user.login_attempts) + 1
                    user.current_version = int(user.current_version) + 1
                    user.save()
                return redirect(url_for("auth.admin_login"))
            elif user.locked and user.role != 1:
                flash("Account Locked!")
                return redirect(url_for("auth.admin_login"))
            elif not user.active and user.role != 1:
                flash("Account Disabled!")
                return redirect(url_for("auth.admin_login"))
            login_user(user, remember=form.remember_me.data)

            user.connectionStatus = True
            login_count = int(user.loginCount)
            user.loginCount = login_count + 1
            user.current_version = int(user.current_version) + 1
            user.login_attempts = 0

            user.current_version = int(user.current_version) + 1
            user.save()
            session["current_user"] = user
            session["current_user"].password = "*" * 10
            session["current_user"]["acky"] = str(uuid4())
            session["client_info"] = get_client_info(request)

            if not next_page or url_parse(next_page).netloc != "":
                next_page = url_for("api.admin_panel")
            return redirect(next_page)

        elif request.method == "GET":
            opts = {}
            opts["startTime"] = datetime.now()
            opts["timeOut"] = None
            opts["siteName"] = settings["SITE_ID"]
            opts["userName"] = None
            opts["previousDest"] = None
            opts["currentTime"] = datetime.now()
            opts["siteTitle"] = settings["SITE_NAME"]
            opts["logo"] = "/static/logo_mini.png"
            opts["user_count"] = Users.get_record_count()

            siteSettings = SiteSettings.get({"settings_id": 1})
            opts["siteSettings"] = {}

            if siteSettings:
                opts["siteSettings"] = siteSettings
                opts["siteTitle"] = siteSettings.site_title
                opts["timeOut"] = siteSettings.time_out_minutes
                opts["siteName"] = siteSettings.site_name
                opts["siteSettings"]["site_logo"] = (
                    siteSettings.site_logo
                    if siteSettings and siteSettings.site_logo
                    else "/static/logo_mini.png"
                )
                opts["siteSettings"]["site_icon"] = (
                    "/static/favico.ico" if not siteSettings else siteSettings.site_icon
                )

            else:
                opts["siteSettings"]["site_name"] = current_app.config["APP_CONFIG"][
                    "SITE_NAME"
                ]
                opts["siteSettings"]["site_title"] = current_app.config["APP_CONFIG"][
                    "SITE_TITLE"
                ]
                opts["siteSettings"]["site_description"] = current_app.config["APP_CONFIG"][
                    "SITE_DESCRIPTION"
                ]
                opts["siteSettings"]["site_logo"] = "/static/logo_mini.png"
                opts["siteSettings"]["site_icon"] = "/static/favico.ico"
                opts["siteSettings"]["login_image"] = "/static/login_image.png"

            message = "Sign In"
            return render_template(
                "auth/login.html",
                title=_(message),
                pageID="login",
                options=opts,
                year=datetime.now().strftime("%Y"),
                form=form,
                message=message,
            )
        else:
            print("Invalid request.")
            return jsonify({"message": "Invalid request"})
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500


@bp.route("/auth/logout", methods=["GET", "POST"])
@bp.route("/auth/logoff", methods=["GET", "POST"])
@bp.route("/logout", methods=["GET", "POST"])
@bp.route("/logoff", methods=["GET", "POST"])
def logout():
    """
    End current session for user
    """
    #print("logging user out")
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
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500

        # return jsonify({"error": True, "message": str(e)})
    if session:
        session.clear()
    
    return redirect(url_for("auth.admin_login"))


@bp.route("/auth/client/signin", methods=["POST"])
def client_login():
    """
    Handles login of clients into to platform
    """
    try:
        # client_id = (
        #     session["current_client"].client_id
        #     if "current_client" in session and session["current_client"].client_id
        #     else None
        # )

        client = None
        next_page = request.args.get("next")
        next_page = next_page if next_page and next_page != "" else "/pages/activity"

        if "current_client" in session and session["current_client"] != {}:
            if (
                session["current_client"].connection_status
                and not session["current_client"].locked
                and session["current_client"].status
            ):

                print("current_client: ", session["current_client"])
                if not next_page or url_parse(next_page).netloc != "":
                    next_page = "/pages/activity"
                    #  print("Redirecting to admin")
                return jsonify(
                    {
                        "isSuccessful": True,
                        "message": "Session resumed!",
                        "redirect": next_page,
                    }
                )
            elif session["current_client"].locked:
                return jsonify({"isSuccessful": False, "message": "Account Locked!"})
                # return redirect(url_for("auth.client_login"))
            elif session["current_client"].status == Clients.DISABLED:
                # flash("Account Disabled!")
                return jsonify({"isSuccessful": False, "message": "Account Disabled!"})
                # return redirect(url_for("auth.client_login"))

        # if client_id:
        #    user = Users.get({"client_id": client_id})

        # form = LoginForm()
        print("request.method: ", request.method)
        if request.method == "POST":
            username = request.form["username"]
            password = request.form["password"]
            remember_me = request.form["rememberMe"]
            # print(f"username: {form.username.data}")
            client = None# Clients.get({"email_address": username})

            message = ""
            if (
                not bool(client)
                or (client and "locked" in client and client.locked)
                or (client and "status" in client and not client.status)
                or (
                    client
                    and "check_password" in client
                    and not client.check_password(password)
                )
            ):

                if client and client.login_attempts >= 5:
                    client.locked = True
                    client.status = Clients.DISABLED
                    client.is_active = False
                elif client and client.locked:
                    message = "Invalid username or password. Account locked."
                else:
                    message = "Invalid username or password"
                if client:
                    client.login_attempts = int(client.login_attempts) + 1
                    client.current_version = int(client.current_version) + 1
                    client.save()
                return jsonify({"isSuccessful": False, "message": message})
            elif client.locked:
                return jsonify({"isSuccessful": False, message: "Account Locked!"})

            elif not client.status:
                # flash("Account Disabled!")
                return jsonify({"isSuccessful": False, message: "Account Disabled!"})

            login_user(client, remember=remember_me)
            client.connection_status = True
            login_count = int(client.login_count)
            client.login_count = login_count + 1
            client.current_version = int(client.current_version) + 1
            client.login_attempts = 0
            client.save()
            session["current_client"] = client
            session["current_client"]["password_hash"] = "*" * 10
            session["current_client"]["password"] = "*" * 10
            session["current_client"]["fmky"] = str(uuid4())

            if not next_page or url_parse(next_page).netloc != "":
                next_page = "/pages/activity"
            return jsonify(
                {"isSuccessful": True, "message": "Login Successful", "redirect": next_page}
            )

        else:
            print("Invalid request.")
            return jsonify(
                {"isSuccessful": False, "message": "The request operation is not valid"}
            )
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500


@bp.route("/auth/client/logout", methods=["GET", "POST"])
@bp.route("/client/logout", methods=["GET", "POST"])
def client_logout():
    """
    End current session for client
    """
    try:
        if session and "current_client" in session:

            client = Clients.get({"client_id": session["current_client"].client_id})
            if client:
                session.clear()
                client.connection_status = False
                client.last_modified_date = datetime.now()
                client.current_version = int(client.current_version) + 1
                client.save()
                logout_user()
                return redirect(url_for("/pages/login"))
            else:
                logout_user()
                return redirect(url_for("/pages/login"))
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500

    if session:
        session.clear()
    return redirect("/pages/client/login")


@bp.errorhandler(400)
def csrf_token_missing(error):
    try:
        opts = {}
        opts["startTime"] = datetime.now()
        opts["timeOut"] = None
        opts["siteName"] = settings["SITE_ID"]
        opts["userName"] = None
        opts["previousDest"] = None
        opts["currentTime"] = datetime.now()
        opts["siteTitle"] = settings["SITE_NAME"]
        opts["logo"] = "/static/logo_mini.png"
        opts["user_count"] = Users.get_record_count()

        siteSettings = SiteSettings.get({"settings_id": 1})
        opts["siteSettings"] = {}
        form = LoginForm()

        if siteSettings:
            opts["siteSettings"] = siteSettings
            opts["siteTitle"] = siteSettings.site_title
            opts["timeOut"] = siteSettings.time_out_minutes
            opts["siteName"] = siteSettings.site_name
            opts["siteSettings"]["site_logo"] = (
                siteSettings.site_logo
                if siteSettings and siteSettings.site_logo
                else "/static/logo_mini.png"
            )
            opts["siteSettings"]["site_icon"] = (
                "/static/favico.ico" if not siteSettings else siteSettings.site_icon
            )

        else:
            opts["siteSettings"]["site_name"] = current_app.config["APP_CONFIG"][
                "SITE_NAME"
            ]
            opts["siteSettings"]["site_title"] = current_app.config["APP_CONFIG"][
                "SITE_TITLE"
            ]
            opts["siteSettings"]["site_description"] = current_app.config["APP_CONFIG"][
                "SITE_DESCRIPTION"
            ]
            opts["siteSettings"]["site_logo"] = "/static/logo_mini.png"
            opts["siteSettings"]["site_icon"] = "/static/favico.ico"
            opts["siteSettings"]["login_image"] = "/static/login_image.png"

        message = "Sign In"
        return render_template(
            "auth/login.html",
            title=_(message),
            pageID="login",
            options=opts,
            year=datetime.now().strftime("%Y"),
            message="Your Login Session has timed out. Please refresh the page and try again.",
            form=form,
        )

        # return redirect(url_for("auth.admin_login"))
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500


@bp.route("/auth/register/user", methods=["GET", "POST"])
@bp.route("/register/user", methods=["GET", "POST"])
def register_user():
    try:
        if current_user.is_authenticated:
            return redirect(url_for("main.index"))

        form = RegistrationForm()
        # print(request.form)
        if (
            request.method.lower() == "post"
            and request.form["username"] is not None
            and request.form["password"] is not None
        ):
            # user = Users(request.form['text'], email=form.email.data)
            try:
                role_id = None
                user_id = Users.get_next("user_id")
                if user_id == 1:
                    role_id = 1
                else:
                    role_id = 2
                user = Users(
                    id=user_id,
                    user_id=user_id,
                    username=request.form["username"].lower(),
                    creationDate=datetime.now(),
                    locked=False,
                    role_id=role_id,
                    connectionStatus=False,
                    active=True,
                    lastModifiedDate=datetime.now(),
                    loginCount=0,
                    current_version=0,
                )
                user.set_password(form.password.data)
                user.save()
                flash(_("Registration Successful!"))
                return redirect(url_for("auth.admin_login"))
            except Exception as e:
                print(e)
                traceback.format_exc()
                flash(_("Registration Failed. Please try with another user account"))
            return redirect(url_for("auth.admin_login"))
        # else:
        #     print("form is not valid")
    
        opts = {}
        opts["logo"] = "/static/logo_mini.png"
        opts["startTime"] = datetime.now()
        opts["timeOut"] = None
        opts["siteName"] = settings["SITE_ID"]
        opts["userName"] = None
        opts["previousDest"] = None
        opts["currentTime"] = datetime.now()
        opts["siteTitle"] = settings["SITE_NAME"]
        return render_template(
            "auth/register_user.html",
            pageID="register",
            options=opts,
            title=_("Add User"),
            form=form,
        )
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500


@bp.route("/auth/register/cpanel", methods=["GET", "POST"])
@bp.route("/register/cpanel", methods=["GET", "POST"])
def register_admin():
    try:
        if current_user.is_authenticated:
            return redirect(url_for("main.index"))

        form = RegistrationForm()
        if (
            request.method.lower() == "post"
            and request.form["email"] is not None
            and request.form["surname"] is not None
            and request.form["firstName"] is not None
            and request.form["username"] is not None
            and request.form["password"] is not None
        ):
            # user = Users(request.form['text'], email=form.email.data)
            user_id = Users.get_next("user_id")
            user = Users(
                id=user_id,
                user_id=user_id,
                username=request.form["username"].lower(),
                creationDate=datetime.now(),
                locked=False,
                role_id=0,
                connectionStatus=False,
                active=True,
                reset=False,
                lastModifiedDate=datetime.now(),
                loginCount=0,
                current_version=0,
            )
            user.set_password(form.password.data)
            user.save()
            flash(_("Registration Successful!"))
            return redirect(url_for("auth.admin_login"))
        # else:
        #     print("form is not valid")
        opts = {}
        opts["logo"] = "/static/logo_mini.png"
        opts["startTime"] = datetime.now()
        opts["timeOut"] = None
        opts["siteName"] = settings["SITE_ID"]
        opts["userName"] = None
        opts["previousDest"] = None
        opts["currentTime"] = datetime.now()
        opts["siteTitle"] = settings["SITE_NAME"]
        return render_template(
            "auth/register.html",
            pageID="register",
            options=opts,
            title=_("Add User"),
            form=form,
            
        )
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500


@bp.route("/reset_password_request", methods=["GET", "POST"])
def reset_password_request():
    try:
        if current_user.is_authenticated:
            return redirect(url_for("main.index"))
        form = ResetPasswordRequestForm()
        if form.validate_on_submit():
            user = Users.objects(email=form.email.data).first()
            if user:
                send_password_reset_email(user)
            flash(_("Check your email for the instructions to reset your password"))
            return redirect(url_for("auth.admin_login"))
        return render_template(
            "auth/reset_password_request.html", title=_("Reset Password"), form=form
        )
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500


@bp.route("/auth/password_recovery", methods=["POST"])
def recover_password_request():
    try:
        email = request.form.get("email")
        if email:
            client = Clients.get({"email": email})
            if client:
                send_password_reset_email(client)
                return jsonify(
                    {
                        "isSuccessful": False,
                        "message": f"A Recovery mail has been successfully sent to {email}.",
                    }
                )
            else:
                return jsonify(
                    {"isSuccessful": False, "message": "Invalid Session Information"}
                )
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500


@bp.route("/reset_password/<token>", methods=["GET", "POST"])
def reset_password(token):
    try:
        if current_user.is_authenticated:
            return redirect(url_for("main.index"))
        user = Users.verify_reset_password_token(token)
        if not user:
            return redirect(url_for("main.index"))
        form = ResetPasswordForm()
        if form.validate_on_submit():
            user.set_password(form.password.data)
            db.session.commit()
            flash(_("Your password has been reset."))
            return redirect(url_for("auth.admin_login"))
        return render_template("auth/reset_password.html", form=form)
    except Exception as exception:
        tb = traceback.format_exc()
        timestamp = datetime.now().strftime("[%Y-%b-%d %H:%M]")
        current_app.logger.error(
            f"%s %s %s %s %s INTERNAL SERVER ERROR\n%s",
            timestamp,
            request.remote_addr,
            request.method,
            request.scheme,
            request.full_path,
            tb,
        )
        traceback.print_exc()
        return jsonify({"is_successful": False, "message": str(exception)}), 500

