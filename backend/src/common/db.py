"""DynamoDB access. Every operation is keyed by userId, which enforces ownership."""
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

from common.responses import ApiError

_table = None


def get_table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
    return _table


def reset_table_cache():
    """For tests only."""
    global _table
    _table = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _is_conditional_failure(err: ClientError) -> bool:
    return err.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException"


def create_task(user_id: str, title: str, status: str) -> dict:
    now = _now()
    item = {
        "userId": user_id,
        "taskId": str(uuid.uuid4()),
        "title": title,
        "status": status,
        "createdAt": now,
        "updatedAt": now,
    }
    get_table().put_item(Item=item, ConditionExpression="attribute_not_exists(taskId)")
    return item


def list_tasks(user_id: str) -> list:
    table = get_table()
    kwargs = {"KeyConditionExpression": Key("userId").eq(user_id)}
    items = []
    while True:
        page = table.query(**kwargs)
        items.extend(page.get("Items", []))
        if "LastEvaluatedKey" not in page:
            break
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    return sorted(items, key=lambda i: i["createdAt"], reverse=True)


def update_task(user_id: str, task_id: str, title=None, status=None) -> dict:
    names = {"#u": "updatedAt"}
    values = {":u": _now()}
    sets = ["#u = :u"]
    if title is not None:
        names["#t"] = "title"
        values[":t"] = title
        sets.append("#t = :t")
    if status is not None:
        names["#s"] = "status"
        values[":s"] = status
        sets.append("#s = :s")
    try:
        result = get_table().update_item(
            Key={"userId": user_id, "taskId": task_id},
            UpdateExpression="SET " + ", ".join(sets),
            ConditionExpression="attribute_exists(taskId)",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
    except ClientError as err:
        if _is_conditional_failure(err):
            raise ApiError(404, "Task not found")
        raise
    return result["Attributes"]


def delete_task(user_id: str, task_id: str) -> None:
    try:
        get_table().delete_item(
            Key={"userId": user_id, "taskId": task_id},
            ConditionExpression="attribute_exists(taskId)",
        )
    except ClientError as err:
        if _is_conditional_failure(err):
            raise ApiError(404, "Task not found")
        raise
