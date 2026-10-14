from common import db
from common.http import api_handler
from common.responses import response


@api_handler
def handler(event, user_id):
    return response(200, {"tasks": db.list_tasks(user_id)})
