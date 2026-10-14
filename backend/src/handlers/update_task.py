from common import db
from common.http import api_handler
from common.responses import ApiError, response
from common.validation import get_task_id, parse_json_body, validate_status, validate_title


@api_handler
def handler(event, user_id):
    task_id = get_task_id(event)
    body = parse_json_body(event)
    if "title" not in body and "status" not in body:
        raise ApiError(400, "Provide at least one of: title, status")
    title = validate_title(body["title"]) if "title" in body else None
    status = validate_status(body["status"]) if "status" in body else None
    task = db.update_task(user_id, task_id, title=title, status=status)
    return response(200, task)
