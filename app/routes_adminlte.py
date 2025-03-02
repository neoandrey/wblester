from flask import (
    render_template,
    jsonify,
    Flask,
    redirect,
    url_for,
    request,
    flash,
    abort,
    jsonify,
)
from werkzeug.utils import secure_filename
from app import app
import re
import os
from app.models import ReportUploads, ReportMetadata
from datetime import datetime
from redis import Redis
import rq
import bson
import json


@app.route("/<page>")
def show_index(page):
    page = page + ".html" if not page.endswith(".html") else page
    page = page.replace('href="', 'href="/')

    return re.sub(
        'href="(\w*)"',
        'href="/\1"',
        re.sub(
            '"[./]*[.]*plugins',
            '"/static/plugins',
            re.sub('"[./]*[.]*dist', '"/static/dist', render_template(page)),
        ),
    )


def search_for_page(folder, file_name):
    current_folder = os.path.abspath(os.path.dirname(__file__))
    file_path = None
    file_url = None
    for root, _, files in os.walk("./templates" + os.sep + folder):
        for file in files:
            if file == file_name:
                file_path = os.path.join(root, file)
    if file_path:
        file_url = file_path.replace(current_folder, "").replace(os.sep, "/")
    return file_url


@app.route("/<page>/<sub_page>/")
def show_sub_page(page, sub_page):
    rendered_page = f"{page}/{sub_page}"

    print(rendered_page)
    basedir = os.path.abspath(os.path.dirname(__file__))
    print(basedir + os.sep + "templates" + os.sep + rendered_page.replace("/", os.sep))
    if not os.path.exists(
        basedir + os.sep + "templates" + os.sep + rendered_page.replace("/", os.sep)
    ):
        rendered_page = search_for_page(page, sub_page)
        rendered_page = rendered_page.replace('href="', 'href="/')
    print(rendered_page)
    return re.sub(
        'href="(\w*)"',
        'href="/\1"',
        re.sub(
            '"[./]*[.]*plugins',
            '"/static/plugins',
            re.sub('"[./]*[.]*dist', '"/static/dist', render_template(rendered_page)),
        ),
    )  # render_template(rendered_page).replace('dist', 'static/dist').replace('plugins', 'static/plugins')


@app.route("/<page>/<sub_page>/<sub_sub_page>")
def show_page(page, sub_page, sub_sub_page):
    rendered_page = ""
    page_url = "{page}/{sub_page}/{sub_sub_page}".format(
        page=page, sub_page=sub_page, sub_sub_page=sub_sub_page
    )
    url_components = page_url.split("/")
    print(url_components)
    index = 0
    for comp in url_components:
        index += 1
        if comp.endswith(".html") and comp != url_components[-1]:
            continue
        rendered_page += f"/{comp}"

    print(rendered_page)
    basedir = os.path.abspath(os.path.dirname(__file__))
    print(basedir + os.sep + "templates" + rendered_page.replace("/", os.sep))
    if not os.path.exists(
        basedir + os.sep + "templates" + rendered_page.replace("/", os.sep)
    ):
        rendered_page = search_for_page(page, sub_page)
    print(rendered_page)

    # print("rendered page: {f}".format(f=rendered_page))
    return re.sub(
        'href="(\w*)"',
        'href="/\1"',
        re.sub(
            '"[./]*[.]*plugins',
            '"/static/plugins',
            re.sub('"[./]*[.]*dist', '"/static/dist', render_template(rendered_page)),
        ),
    )  # render_template(rendered_page).replace('dist', 'static/dist').replace('plugins', 'static/plugins')


@app.route("/<page>/<sub_page>/<sub_sub_page>/<sub3_page>")
def show_sub3_page(page, sub_page, sub_sub_page, sub3_page):
    rendered_page = None
    if sub_page.endswith("html") and sub_sub_page.endswith("html"):
        rendered_page = "{p1}/{p2}".format(p1=page, p2=sub3_page)
    elif sub_page.endswith("html"):
        rendered_page = "{p1}/{p2}/{p3}".format(p1=page, p2=sub_sub_page, p3=sub3_page)
    elif sub_sub_page.endswith("html"):
        rendered_page = "{p1}/{p2}/{p3}".format(p1=page, p2=sub_page, p3=sub3_page)
    elif sub_sub_page:
        rendered_page = "{p1}/{p2}/{p3}".format(p1=page, p2=sub_page, p3=sub_sub_page)
    elif sub_page:
        rendered_page = "{p1}/{p2}".format(p1=page, p2=sub_page)
    if not os.path.exists("templates" + os.sep + rendered_page.replace("/", os.sep)):
        rendered_page = search_for_page(page, sub_page)
    print(rendered_page)

    rendered_page = rendered_page.replace('href="', 'href="/')
    # print("rendered page: {f}".format(f=rendered_page))
    return re.sub(
        'href="(\w*)"',
        'href="/\1"',
        re.sub(
            '"[./]*[.]*plugins',
            '"/static/plugins',
            re.sub('"[./]*[.]*dist', '"/static/dist', render_template(rendered_page)),
        ),
    )  # render_template(rendered_page).replace('dist', 'static/dist').replace('plugins', 'static/plugins')


@app.route("/api/report/upload", methods=["POST"])
def handle_report_upload():
    print("args")
    print(request.args)
    print("form")
    print(request.form)
    print("values")
    print(request.values)
    print("files")
    print(request.files)
    uploaded_file = None
    report_name = None
    report_type = None
    report_org = None
    # if 'report_file' in request.files[0]:
    #    uploaded_file = request.files[0]['report_file']
    report_file = request.files.get("report_file")
    report_name = request.form.get("report_name")
    report_type = request.form.get("report_type")
    report_org = request.form.get("report_org")

    # print(report_name)
    # print(report_type)
    # print(report_org)
    # print(report_file)

    filename = secure_filename(report_file.filename)
    if filename != "":
        file_ext = os.path.splitext(filename)[1]
        if file_ext not in app.config["UPLOAD_EXTENSIONS"]:
            abort(400)
        raw_report_file = os.path.join(
            app.config["UPLOAD_PATH"]
        )  # .replace("\\","\\\\"))
        report_check = ReportUploads.get({"raw_report_file": raw_report_file})

        report_check = True if report_check else False
        if not report_check:
            user_id = 1
            report_file.save(os.path.join(app.config["UPLOAD_PATH"], filename))
            report_id = ReportUploads.get_record_count() + 1
            report_file_name = os.path.join(app.config["UPLOAD_PATH"], filename)
            uploaded_report = ReportUploads(
                report_id=report_id,
                report_name=report_name,
                report_type=report_type,
                report_organization=report_org,
                raw_report_file=report_file_name,
                created_datetime=datetime.now(),
            )
            uploaded_report.save()
            queue = rq.Queue(app.config["REDIS_QUEUE_NAME"], connection=app.redis)
            job = queue.enqueue(
                "app.tasks.process_uploaded_report",
                report_file_name,
                report_name,
                report_id,
                user_id,
            )

    return re.sub(
        'href="(\w*)"',
        'href="/\1"',
        re.sub(
            '"[./]*[.]*plugins',
            '"/static/plugins',
            re.sub(
                '"[./]*[.]*dist',
                '"/static/dist',
                render_template("/custom/workspace.html"),
            ),
        ),
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


@app.route("/api/dashboard/<start_date>/<end_date>", methods=["GET"])
def get_stats_info(start_date, end_date):
    start_date = datetime.strptime(start_date, "%Y-%m-%d")
    end_date = datetime.strptime(end_date, "%Y-%m-%d")

    report_data = ReportMetadata.objects().aggregate(
        [
            {
                "$match": {
                    "report_metadata_begin_date": {"$gte": start_date, "$lte": end_date}
                }
            },
            {
                "$lookup": {
                    "from": "report_records",
                    "localField": "report_id",
                    "foreignField": "report_id",
                    "as": "records",
                }
            },
        ]
    )
    temp_data = list(report_data)
    results = get_collection_data(temp_data) if len(temp_data) > 0 else []
    # print(results)
    return jsonify(results)
