from flask import Blueprint

bp = Blueprint("cpanel", __name__)
from app.cpanel import routes
