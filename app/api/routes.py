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
    Roles,
    SiteSettings,
    # Categories,
    # Tactics,
    # Biases,
    # Principles,
    # OptionSets,
    # Questions,
    # Recommendations,
    # Results,
    # Summaries,
    # Details,
    # GroupCodes,
    # Awareness,
)

import traceback, json, time, re, json, rq, os, re, random, inspect
from flask_login import current_user, login_required
from flask_babel import _  # , get_locale
from datetime import datetime, timedelta
from redis import Redis
import app.models as models

# from app.gmailbox import GmailHelper

# from guess_language import guess_language
from app import db, settings, get_debug_template, csrf, cache  # ,socketio
from flask_mongoengine import BaseQuerySet

# from app.translate import translate
from app.api import bp

from app.main.serializer import Serializer
from rq.job import Job
from PIL import Image, ImageFilter


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
                if "password" in k:
                    temp_data[k] = "*" * 12
                elif "date" in k or "time" in k:
                    temp_data[k] = (
                        (datetime.fromtimestamp(v["$date"] / 1000.0)).strftime(
                            "%Y-%m-%d %H:%M:%S"
                        )
                        if "$date" in v
                        else v
                    )
                elif k != "_id":
                    temp_data[k] = v
            results.append(temp_data)
    return results


@csrf.exempt
@bp.route("/api/data/<table>", methods=["GET"])
# @cache.cached()
# @login_required
def api_get_data(table):
    """
    Fetches Table Data
    """
    tables = []
    results = {}
    if "+" in table:
        tables = table.split("+")
    else:
        tables.append(table)
    for tab in tables:
        results[tab.lower()] = []
        table_key = tab.capitalize()
        for k in models.__dict__.keys():
            if k.lower() == tab.lower():
                table_key = k
                break
        collection = models.__dict__[table_key]
        query = request.args.get(tab.lower())
        if query == "{}":
            query = {}
        elif query != "none":
            query = json.loads(query)

        if query == "none":
            break
        data = collection.find(query)
        data = data.to_json()
        if len(data) > 0:
            for row in json.loads(data):
                temp_data = {}
                for k, v in row.items():
                    if "password" in k:
                        temp_data[k] = "*" * 12
                    elif "date" in k or "time" in k:
                        temp_data[k] = (
                            (datetime.fromtimestamp(v["$date"] / 1000.0)).strftime(
                                "%Y-%m-%d %H:%M:%S"
                            )
                            if "$date" in v
                            else v
                        )
                    elif k != "_id":
                        temp_data[k] = v
                results[tab.lower()].append(temp_data)
    return jsonify(results)


@csrf.exempt
@bp.route("/api/oldsync/<table>", methods=["GET"])
@bp.route("/api/oldsync/<table>/<max_id>", methods=["GET"])
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
@bp.route("/api/add/<data_type>", methods=["POST"])
# @login_required
def add_record(data_type):
    """
    Add Record to database
    """
    # count = current_app.config["CIPHER_COUNT"]
    mode = request.form.get("mode")
    # key_maker = Serializer()
    error_message = None
    # try:
    if mode == "new":
        if data_type == "users":
            username = request.form.get("username")
            password = None
            locked = request.form.get("locked")
            status = request.form.get("status")
            role_id = request.form.get("role")
            password = request.form.get("password")
            existing_user = Users.get({"username": username})

            if not existing_user:
                role_id = None
                user_id = Users.get_next("user_id")
                if user_id == 1:
                    role_id = 1  # sysadmin
                else:
                    role_id = 2  # groupadmin
                if user_id == 1:
                    role_id = 0
                user = Users(
                    id=user_id,
                    user_id=user_id,
                    username=username.strip(),
                    creationDate=datetime.now(),
                    locked=locked,
                    role_id=role_id,
                    connectionStatus=False,
                    status=status,
                    lastModifiedDate=datetime.now(),
                    loginCount=0,
                )
                user.set_password(password)
                user.save()
                user.passwordHash = "***********************"
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": user,
                        "description": "New record added to Users",
                        "change_type": "INSERT",
                        "object_type": "Users",
                        "user_id": str(0),
                        "username": "System",
                    }
                )
                return jsonify({"message": "User account created sucessfully"})
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

                return jsonify({"message": "Role created sucessfully"})
            return jsonify({"message": "Role already exists"})
        elif data_type == "categories":
            category_name = request.form.get("category_name")
            category_description = request.form.get("description")
            category = Categories.get({"category_name": category_name})
            is_existing_category = True if category else False
            if not is_existing_category:
                category_id = Categories.get_next("category_id")
                category = Categories(
                    category_id=category_id,
                    category_name=str(category_name).strip(),
                    description=category_description.strip(),
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                category.save()
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
                        "new_object": category,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Category",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Category created sucessfully"})
            return jsonify({"message": "Category already exists"})
        elif data_type == "tactics":
            tactic_name = request.form.get("tactic_name")
            tactic_description = request.form.get("description")
            tactic = Tactics.get({"tactic_name": tactic_name})
            is_existing_tactic = True if tactic else False
            if not is_existing_tactic:
                tactic_id = Tactics.get_next("tactic_id")
                tactic = Tactics(
                    tactic_id=tactic_id,
                    tactic_name=tactic_name.strip(),
                    description=tactic_description,
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                tactic.save()
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
                        "new_object": tactic,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Tactic",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Tactic created sucessfully"})
            return jsonify({"message": "Tactic already exists"})
        elif data_type == "awareness":
            awareness_name = request.form.get("awareness_name")
            awareness_description = request.form.get("description")
            awareness = Awareness.get({"awareness_name": awareness_name})
            is_existing_awareness = True if awareness else False
            if not is_existing_awareness:
                awareness_id = Awareness.get_next("awareness_id")
                awareness = Awareness(
                    awareness_id=awareness_id,
                    awareness_name=awareness_name.strip(),
                    description=awareness_description.strip(),
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                awareness.save()
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
                        "new_object": awareness,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Awareness",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Awareness created successfully"})
            return jsonify({"message": "Awareness already exists"})
        elif data_type == "biases":
            bias_name = request.form.get("bias_name")
            description = request.form.get("description")
            bias = Biases.get({"bias_name": bias_name})
            is_existing_bias = True if bias else False
            if not is_existing_bias:
                bias_id = Biases.get_next("bias_id")
                bias = Biases(
                    bias_id=bias_id,
                    bias_name=bias_name.strip(),
                    description=description.strip(),
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                bias.save()
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
                        "new_object": bias,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Bias",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Bias created sucessfully"})
            return jsonify({"message": "Bias already exists"})
        elif data_type == "principles":
            principle_name = request.form.get("principle_name")
            description = request.form.get("description")
            principle = Principles.get({"principle_name": principle_name})
            is_existing_principle = True if principle else False
            if not is_existing_principle:
                principle_id = Principles.get_next("principle_id")
                principle = Principles(
                    principle_id=principle_id,
                    principle_name=principle_name.strip(),
                    description=description.strip(),
                    last_modified_date=datetime.now(),
                    created_datetime=datetime.now(),
                    current_version=0,
                )
                principle.save()
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
                        "new_object": principle,
                        "description": f"{data_type} record updated",
                        "change_type": "INSERT",
                        "object_type": "Principle",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Principle created sucessfully"})
            return jsonify({"message": "Principle already exists"})
        elif data_type == "optionsets":
            optionset_name = request.form.get("optionset_name")
            optionlist = request.form.get("optionlist")
            preamble = request.form.get("preamble")
            exclusive = request.form.get("exclusive")
            optionset = OptionSets.get({"optionset_name": optionset_name})
            is_existing_optionset = True if optionset else False
            options = []
            for item in optionlist.split(","):
                if item and item.strip() != "":
                    options.append(item.strip())

            if not is_existing_optionset:
                optionset_id = OptionSets.get_next("optionset_id")
                optionset = OptionSets(
                    optionset_id=optionset_id,
                    optionset_name=optionset_name.strip(),
                    options=options,
                    preamble=preamble,
                    exclusive=exclusive,
                    created_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )
                optionset.save()
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
                        "new_object": optionset,
                        "description": f"{data_type} record created",
                        "change_type": "INSERT",
                        "object_type": "OptionSet",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                return jsonify({"message": "OptionSet created sucessfully"})
            return jsonify(
                {"message": "OptionSet with the details provided already exists"}
            )
        elif data_type == "questions":
            category_id = request.form.get("category_id")
            tactic_id = request.form.get("tactic_id")
            bias_id = request.form.get("bias_id")
            principle_id = request.form.get("principle_id")
            recommendation_id = request.form.get("recommendation_id")
            text = request.form.get("text")
            optionset_id = request.form.get("optionset_id")
            question = Questions.get({"text": text})
            acceptable_options = request.form.get("acceptable_options")
            if acceptable_options:
                acceptable_options = json.loads(acceptable_options)
            is_existing_question = True if question else False
            if not is_existing_question:
                question_id = Questions.get_next("question_id")
                question = Questions(
                    question_id=question_id,
                    category_id=category_id,
                    tactic_id=tactic_id,
                    bias_id=bias_id,
                    principle_id=principle_id,
                    recommendation_id=recommendation_id,
                    text=text,
                    optionset_id=optionset_id,
                    acceptable_options=acceptable_options,
                    created_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )

                question.save()
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
                        "new_object": question,
                        "description": f"{data_type} record created",
                        "change_type": "INSERT",
                        "object_type": "Question",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                return jsonify({"message": "Question created sucessfully"})
            return jsonify(
                {"message": "Question with the details provided already exists"}
            )
        elif data_type == "recommendations":
            tactic_id = request.form.get("tactic_id")
            recommendation_name = request.form.get("recommendation_name")
            details = request.form.get("details")
            category_id = request.form.get("category_id")
            details = str(details).strip() if details else None
            recommendation = Recommendations.get({"name": recommendation_name})
            is_existing_recommendation = True if recommendation else False
            if not is_existing_recommendation:
                recommendation_id = Recommendations.get_next("recommendation_id")
                recommendation = Recommendations(
                    recommendation_id=recommendation_id,
                    recommendation_name=recommendation_name,
                    tactic_id=tactic_id,
                    details=details,
                    category_id=category_id,
                    created_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )

                recommendation.save()
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
                        "new_object": recommendation,
                        "description": f"{data_type} record created",
                        "change_type": "INSERT",
                        "object_type": "Recommendation",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                return jsonify({"message": "Recommendation created sucessfully"})
            return jsonify(
                {"message": "Recommendation with the details provided already exists"}
            )
        elif data_type == "summaries":
            candidate_id = request.form.get("candidate_id")
            group_code = request.form.get("group_code")
            start_time = datetime.now()
            question_count = 0
            category = None

            if group_code:
                category = Categories.get(
                    {"category_name": "Group"}
                )  # Case must match. i.e Group and not group
            else:
                # print("Getting individual category")
                category = Categories.get(
                    {"category_name": "Individual"}
                )  # Case must match -i.e. Individual not individual

            questions = Questions.find({"category_id": category.category_id})
            question_count = questions.count()
            questions = get_found_records(questions)
            question_ids = [question["question_id"] for question in questions]
            current_question_id = random.choice(question_ids)
            viewed_questions = []
            is_complete = False
            is_cancelled = False
            end_time = None
            result_id = None
            summary = None
            if group_code and candidate_id:
                summary = Summaries.get(
                    {
                        "candidate_id": candidate_id,
                        "group_code": group_code,
                        "is_complete": False,
                    }
                )
            else:
                summary = Summaries.get(
                    {"candidate_id": candidate_id, "is_complete": False}
                )
            is_existing_summary = True if summary else False
            if not is_existing_summary:
                summary_id = Summaries.get_next("summary_id")
                summary = Summaries(
                    summary_id=summary_id,
                    candidate_id=candidate_id,
                    group_code=group_code,
                    start_time=start_time,
                    current_question_id=current_question_id,
                    viewed_questions=viewed_questions,
                    is_complete=is_complete,
                    is_cancelled=is_cancelled,
                    end_time=end_time,
                    result_id=result_id,
                    created_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )
                # print(summary.to_json())
                summary.save()
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": summary,
                        "description": "Evaluation Summary record created",
                        "change_type": "INSERT",
                        "object_type": "Summaries",
                        "user_id": str(0),
                        "username": "system",
                    }
                )
                return jsonify({"message": "Summary created sucessfully"})
            return jsonify(
                {"message": "Summary with the details provided already exists"}
            )
        elif data_type == "details":
            candidate_id = request.form.get("candidate_id")
            summary_id = request.form.get("summary_id")
            group_code = request.form.get("group_code")
            answer_map = request.form.get("answer_map")
            detail = Details.get(
                {
                    "candidate_id": candidate_id,
                    "summary_id": summary_id,
                    "group_code": group_code,
                }
            )
            is_existing_detail = True if detail else False
            if not is_existing_detail:
                if answer_map:
                    answer_map = json.loads(answer_map)
                detail_id = Details.get_next("detail_id")
                detail = Details(
                    detail_id=detail_id,
                    summary_id=summary_id,
                    candidate_id=candidate_id,
                    group_code=group_code,
                    answer_map=answer_map,
                    create_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )
                detail.save()
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": detail,
                        "description": "Evaluation Detail record created",
                        "change_type": "INSERT",
                        "object_type": "Detail",
                        "user_id": str(0),
                        "username": "system",
                    }
                )

                current_app.task_queue.enqueue(
                    "app.tasks.save_evaluation_results",
                    args=[
                        mode,
                        group_code,
                        summary_id,
                        detail_id,
                        candidate_id,
                        detail.answer_map,
                    ],
                    job_timeout=current_app.config["SYNC_INTERVAL"],
                )
                return jsonify({"message": "Detail created sucessfully"})
            else:
                return jsonify(
                    {"message": "Detail with the details provided already exists"}
                )
        elif data_type == "groupcodes":
            code = request.form.get("code")
            user_id = request.form.get("user_id")
            group_code = GroupCodes.get({"code": code})
            is_existing_groupcode = True if group_code else False
            if not is_existing_groupcode:
                code_id = GroupCodes.get_next("code_id")
                groupcode = GroupCodes(
                    code_id=code_id,
                    user_id=user_id,
                    code=code,
                    created_datetime=datetime.now(),
                    last_modified_date=datetime.now(),
                    current_version=0,
                )
                groupcode.save()
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
                        "new_object": groupcode,
                        "description": "Evaluation GroupCode record created",
                        "change_type": "INSERT",
                        "object_type": "GroupCode",
                        "user_id": str(0),
                        "username": "system",
                    }
                )
                return jsonify({"message": "GroupCode created sucessfully"})
            return jsonify({"message": "Group code already exists"})
    elif mode == "edit":
        if data_type == "users":
            username = request.form.get("username")
            password = None
            user_id = request.form.get("user_id")
            locked = request.form.get("locked")
            active = request.form.get("status")
            role_id = request.form.get("role")
            locked = True if str(locked) == "true" else False
            active = True if str(active) == "true" else False
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
                existing_user.role_id = role_id
                existing_user.active = active
                existing_user.lastModifiedDate = datetime.now
                if str(password_changed) == "true":
                    existing_user.set_password(password)
                existing_user.current_version = int(existing_user.current_version) + 1
                existing_user.save()
                AuditTrail.log_to_trail(
                    {
                        "old_object": old_user,
                        "new_object": existing_user,
                        "description": f"Record with ID: {user_id} updated.",
                        "change_type": "UPDATE",
                        "object_type": "Users",
                        "user_id": str(0),
                        "username": "System",
                    }
                )
                return jsonify({"message": "User account updated sucessfully"})
            else:
                error_message = "User account could not be updated."
                return jsonify(
                    {
                        "message": "User account update failed",
                        "error": error_message,
                    }
                )
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

                return jsonify({"message": "Role created sucessfully"})
            return jsonify({"message": "Role already exists"})
        elif data_type == "categories":
            category_id = request.form.get("category_id")
            category_name = request.form.get("category_name")
            category_description = request.form.get("description")
            category = Categories.get({"category_id": category_id})
            is_existing_category = True if category else False
            if is_existing_category:

                category.category_name = category_name.strip()
                category.description = category_description.strip()
                category.created_datetime = datetime.now()
                category.last_modified_date = datetime.now()
                category.current_version = int(category.current_version) + 1

                category.save()
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
                        "new_object": category,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Category",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Category updated sucessfully"})
            return jsonify({"message": "Category does not exist"})
        elif data_type == "awareness":
            awareness_id = request.form.get("awareness_id")
            awareness_name = request.form.get("awareness_name")
            awareness_description = request.form.get("description")
            awareness = Awareness.get({"awareness_id": awareness_id})
            is_existing_awareness = True if awareness else False
            if is_existing_awareness:
                awareness.awareness_name = awareness_name.strip()
                awareness.description = awareness_description.strip()
                awareness.last_modified_date = datetime.now()
                awareness.current_version = int(awareness.current_version) + 1

                awareness.save()
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
                        "new_object": awareness,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Awareness",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Awareness updated sucessfully"})
            return jsonify({"message": "Awareness does not exist"})
        elif data_type == "tactics":
            tactic_id = request.form.get("tactic_id")
            tactic_name = request.form.get("tactic_name")
            tactic_description = request.form.get("description")
            tactic = Tactics.get({"tactic_id": tactic_id})
            is_existing_tactic = True if tactic else False
            if is_existing_tactic:

                tactic.tactic_name = tactic_name.strip()
                tactic.description = tactic_description.strip()
                tactic.created_datetime = datetime.now()
                tactic.last_modified_date = datetime.now()
                tactic.current_version = int(tactic.current_version) + 1

                tactic.save()
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
                        "new_object": tactic,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Tactic",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Attack Tactic updated sucessfully"})
            return jsonify({"message": "Attack Tactic does not exist"})
        elif data_type == "biases":
            bias_id = request.form.get("bias_id")
            bias_name = request.form.get("bias_name")
            description = request.form.get("description")
            bias = Biases.get({"bias_id": bias_id})
            is_existing_bias = True if bias else False
            if is_existing_bias:

                bias.bias_name = bias_name
                bias.description = description
                bias.created_datetime = datetime.now()
                bias.last_modified_date = datetime.now()
                bias.current_version = int(bias.current_version) + 1

                bias.save()
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
                        "new_object": bias,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Bias",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Attack Bias updated sucessfully"})
            return jsonify({"message": "Attack Bias does not exist"})
        elif data_type == "principles":
            principle_id = request.form.get("principle_id")
            principle_name = request.form.get("principle_name")
            description = request.form.get("description")
            principle = Principles.get({"principle_id": principle_id})
            is_existing_principle = True if principle else False
            if is_existing_principle:
                principle.principle_name = principle_name.strip()
                principle.description = description.strip()
                principle.created_datetime = datetime.now()
                principle.last_modified_date = datetime.now()
                principle.current_version = int(principle.current_version) + 1

                principle.save()
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
                        "new_object": principle,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Principle",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Attack Principle updated sucessfully"})
            return jsonify({"message": "Attack Principle does not exist"})
        elif data_type == "optionsets":
            optionset_id = request.form.get("optionset_id")
            optionset_name = request.form.get("optionset_name")
            optionlist = request.form.get("optionlist")
            preamble = request.form.get("preamble")
            exclusive = request.form.get("exclusive")
            exclusive = True if exclusive == "true" else False
            optionset = OptionSets.get({"optionset_id": optionset_id})
            options = []
            for item in optionlist.split(","):
                if item and item.strip() != "":
                    options.append(item.strip())
            is_existing_optionset = True if optionset else False
            if is_existing_optionset:

                optionset.optionset_name = optionset_name.strip()
                optionset.options = options
                optionset.preamble = preamble
                optionset.exclusive = exclusive
                optionset.created_datetime = datetime.now()
                optionset.last_modified_date = datetime.now()
                optionset.current_version = int(optionset.current_version) + 1
                optionset.save()

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
                        "new_object": optionset,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "OptionSet",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )
                return jsonify({"message": "OptionSet updated sucessfully"})
            return jsonify({"message": "OptionSet does not exist"})
        elif data_type == "questions":
            question_id = request.form.get("question_id")
            category_id = request.form.get("category_id")
            tactic_id = request.form.get("tactic_id")
            bias_id = request.form.get("bias_id")
            principle_id = request.form.get("principle_id")
            recommendation_id = request.form.get("recommendation_id")
            text = request.form.get("text")
            acceptable_options = request.form.get("acceptable_options")
            optionset_id = request.form.get("optionset_id")
            if acceptable_options:
                acceptable_options = json.loads(acceptable_options)
            question = Questions.get({"question_id": question_id})
            is_existing_question = True if question else False
            if is_existing_question:
                question.category_id = category_id
                question.tactic_id = tactic_id
                question.bias_id = bias_id
                question.principle_id = principle_id
                question.recommendation_id = recommendation_id
                question.text = text.strip()
                question.acceptable_options = acceptable_options
                question.optionset_id = optionset_id
                question.created_datetime = datetime.now()
                question.last_modified_date = datetime.now()
                question.current_version = int(question.current_version) + 1
                question.save()
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
                        "new_object": question,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Question",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Question updated sucessfully"})
            return jsonify({"message": "Question does not exist"})
        elif data_type == "recommendations":
            recommendation_id = request.form.get("recommendation_id")
            category_id = request.form.get("category_id")
            recommendation_name = request.form.get("recommendation_name")
            tactic_id = request.form.get("tactic_id")
            details = request.form.get("details")
            recommendation = Recommendations.get(
                {"recommendation_id": recommendation_id}
            )
            is_existing_recommendation = True if recommendation else False
            if is_existing_recommendation:
                recommendation.recommendation_name = recommendation_name.strip()
                recommendation.tactic_id = tactic_id
                recommendation.category_id = category_id
                recommendation.details = details.strip()
                recommendation.created_datetime = datetime.now()
                recommendation.last_modified_date = datetime.now()
                recommendation.current_version = int(recommendation.current_version) + 1
                recommendation.save()
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
                        "new_object": recommendation,
                        "description": f"{data_type} record updated",
                        "change_type": "UPDATE",
                        "object_type": "Recommendation",
                        "user_id": str(user_id),
                        "username": user_name,
                    }
                )

                return jsonify({"message": "Recommendation updated sucessfully"})
            return jsonify({"message": "Recommendation does not exist"})
        elif data_type == "summaries":
            summary_id = request.form.get("summary_id")
            candidate_id = request.form.get("candidate_id")
            current_question = request.form.get("current_question")
            is_complete = request.form.get("is_complete")
            is_cancelled = request.form.get("is_cancelled")
            end_time = request.form.get("end_time")
            group_code = request.form.get("group_code")
            result_id = request.form.get("result_id")
            summary = Summaries.get({"summary_id": summary_id})
            is_existing_summary = True if summary else False
            current_question_id = 1
            category = None
            if is_existing_summary:

                current_question_list = []
                current_question_list.append(int(current_question))

                if group_code:
                    category = Categories.get(
                        {"category_name": "Group"}
                    )  # Note the case again
                else:
                    category = Categories.get(
                        {"category_name": "Individual"}
                    )  # Note the case again

                questions = Questions.find({"category_id": category.category_id})
                if questions.count() > 0:
                    questions = get_found_records(questions)
                if current_question:
                    summary.viewed_questions = (
                        list(summary.viewed_questions) + current_question_list
                    )
                viewed_questions = list(summary.viewed_questions)

                # print("Viewed questions")
                # print(viewed_questions)
                pending_questions = [
                    question["question_id"]
                    for question in questions
                    if question["question_id"] not in viewed_questions
                ]

                if (len(pending_questions)) > 0:
                    current_question_id = random.choice(pending_questions)
                    summary.current_question_id = current_question_id
                else:
                    is_complete = True
                    end_time = datetime.now()
                # print(f"current_question: {current_question_id}")
                if is_complete:
                    summary.is_complete = is_complete
                if is_cancelled:
                    summary.is_cancelled = is_cancelled
                if end_time:
                    summary.end_time = end_time
                if result_id:
                    summary.result_id = result_id

                summary.last_modified_date = datetime.now()
                summary.current_version = int(summary.current_version) + 1
                summary.save()
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": summary,
                        "description": "Summaries record updated",
                        "change_type": "UPDATE",
                        "object_type": "Summaries",
                        "user_id": str(0),
                        "username": "System",
                    }
                )
                if not is_complete:
                    return jsonify({"message": "Summaries updated sucessfully"})
                else:
                    return jsonify({"message": "evaluation complete"})
            return jsonify({"message": "Summary does not exist"})
        elif data_type == "details":
            detail_id = request.form.get("detail_id")
            candidate_id = request.form.get("candidate_id")
            summary_id = request.form.get("summary_id")
            group_code = request.form.get("group_code")
            answer_map = request.form.get("answer_map")
            if detail_id:
                detail = Details.get({"detail_id": detail_id})
            is_existing_detail = True if detail else False
            if is_existing_detail:
                if answer_map:
                    answer_map = json.loads(answer_map)
                    detail.answer_map = (
                        detail.answer_map | answer_map
                    )  # add new question and answer map to answer_map dictionary
                detail.last_modified_date = datetime.now()
                detail.current_version = int(detail.current_version) + 1
                detail.save()
                AuditTrail.log_to_trail(
                    {
                        "old_object": None,
                        "new_object": detail,
                        "description": f"Details collection record with ID {detail_id} updated",
                        "change_type": "UPDATE",
                        "object_type": "Details",
                        "user_id": str(0),
                        "username": "System",
                    }
                )

                current_app.task_queue.enqueue(
                    "app.tasks.save_evaluation_results",
                    args=[
                        mode,
                        group_code,
                        summary_id,
                        detail_id,
                        candidate_id,
                        detail.answer_map,
                    ],
                    job_timeout=current_app.config["SYNC_INTERVAL"],
                )
                return jsonify({"message": "Details updated sucessfully"})


# except Exception as error:
#     traceback.format_exc()
#     print(error)
#     return jsonify({"message": "Failed to communicate with server"})
@csrf.exempt
@bp.route("/api/delete/<table>", methods=["POST"])
@login_required
def remove_record(table):
    """
    Remove Record from database
    """
    collection = models.__dict__[table]
    id = ""
    if table.lower() == "imapaccounts":
        id = "account_id"
    elif table.lower() == "gmailaccounts":
        id = "account_id"
    elif table.lower() == "hosts":
        id = "host_id"
    elif table.lower() == "alerts":
        id = "alert_id"
    elif table.lower() == "schedules":
        id = "schedule_id"
    id_value = request.form.get(id)
    temp_data = {}
    temp_data[id] = id_value
    entry_pending_removal = collection.find(temp_data)
    try:
        if table.lower() == "hosts":
            entry_pending_removal = (
                json.loads(entry_pending_removal.to_json())[0]
                if type(entry_pending_removal) is BaseQuerySet
                else entry_pending_removal
            )
            current_app.task_queue.enqueue(
                "app.tasks.remove_storage_objects",
                args=[id_value],
                job_timeout=current_app.config["SYNC_INTERVAL"],
            )
            AuditTrail.log_to_trail(
                {
                    "old_object": entry_pending_removal,
                    "new_object": None,
                    "description": f"{table} delete request submitted",
                    "change_type": "DELETE",
                    "object_type": table,
                    "user_id": str(current_user._id),
                    "username": current_user.username,
                }
            )
            return jsonify(
                {
                    "message": "Host with ID: "
                    + id_value
                    + " and all its dependent objects have been scheduled for deletion."
                }
            )
        else:
            entry_pending_removal.delete()
            AuditTrail.log_to_trail(
                {
                    "old_object": entry_pending_removal,
                    "new_object": None,
                    "description": f"{table} record deleted",
                    "change_type": "DELETE",
                    "object_type": table,
                    "user_id": str(current_user._id),
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
@bp.route("/api/sync/<sync_type>", methods=["GET"])
# @cache.cached()
# @login_required
def get_table_version_data(sync_type):
    """
    Gets version information for tables that are to be synced
    """
    version_data = {}

    for info in current_app.config["COMPONENT_CONFIG"]["syncInfo"][sync_type]:

        collection = collection = models.__dict__[
            info["collectionName"]
        ]  # get_collection_from_name(info["collectionName"])
        id_field = info["idField"]
        version_info = None
        version_info = collection.objects().aggregate(
            {
                "$project": {
                    f"{id_field}": f"${id_field}",
                    "current_version": "$current_version",
                }
            }
        )
        version_info = list(version_info)
        version_data[info["collectionName"]] = (
            get_collection_data(version_info) if len(version_info) > 0 else []
        )

    return jsonify(version_data)


@csrf.exempt
@bp.route("/api/sync/update/<sync_type>", methods=["GET"])
def get_table_update_data(sync_type):
    """
    gets update data for local table
    """
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

    return jsonify(table_update_data)


@csrf.exempt
@bp.route("/api/result_count", methods=["POST"])
# @login_required
def result_count():
    """
    Get result count for candidate
    """
    candidate_id = request.form.get("candidate_id")
    evaluation_id = request.form.get("evaluation_id")
    results = [1] if session and session["current_user"].role_id == 1 else []

    if evaluation_id and candidate_id:
        results = Results.get(
            {"evaluation_id": evaluation_id, "candidate_id": candidate_id}
        )
    return jsonify({"count": len(results)})


@csrf.exempt
@bp.route("/api/update/summary", methods=["POST"])
# @login_required
def update_summary():
    """
    update awareness method
    """
    summary_id = request.form.get("summary_id")
    preferred_awareness_method = request.form.get("preferred_awareness_method")
    summary = Summaries.get({"summary_id": summary_id})
    is_existing_summary = True if summary else False
    if is_existing_summary:
        summary.awareness_method = preferred_awareness_method
        summary.last_modified_date = datetime.now()
        summary.current_version = int(summary.current_version) + 1
        summary.save()
        AuditTrail.log_to_trail(
            {
                "old_object": None,
                "new_object": summary,
                "description": "Summaries record updated",
                "change_type": "UPDATE",
                "object_type": "Summaries",
                "user_id": str(0),
                "username": "System",
            }
        )
        return jsonify({"message": "Summaries updated sucessfully"})
    return jsonify({"message": "evaluation complete"})
