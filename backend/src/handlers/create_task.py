from common import db
from common.http import api_handler
from common.responses import response
from common.validation import DEFAULT_STATUS, parse_json_body, validate_status, validate_title


@api_handler
def handler(event, user_id):
    body = parse_json_body(event)
    title = validate_title(body.get("title"))
    status = validate_status(body["status"]) if "status" in body else DEFAULT_STATUS
    task = db.create_task(user_id, title, status)
    return response(201, task)
