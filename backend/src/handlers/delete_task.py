from common import db
from common.http import api_handler
from common.responses import response
from common.validation import get_task_id


@api_handler
def handler(event, user_id):
    db.delete_task(user_id, get_task_id(event))
    return response(204)
