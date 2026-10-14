"""Request parsing and validation."""
import base64
import json
import uuid

from common.responses import ApiError

VALID_STATUSES = ("todo", "in_progress", "done")
DEFAULT_STATUS = "todo"
MAX_TITLE_LENGTH = 200
MAX_BODY_BYTES = 10_000


def parse_json_body(event: dict) -> dict:
    raw = event.get("body")
    if not raw:
        raise ApiError(400, "Request body is required")
    if event.get("isBase64Encoded"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except Exception:
            raise ApiError(400, "Malformed request body")
    if len(raw) > MAX_BODY_BYTES:
        raise ApiError(400, "Request body too large")
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        raise ApiError(400, "Request body must be valid JSON")
    if not isinstance(data, dict):
        raise ApiError(400, "Request body must be a JSON object")
    return data


def validate_title(value) -> str:
    if not isinstance(value, str):
        raise ApiError(400, "title must be a string")
    title = value.strip()
    if not title:
        raise ApiError(400, "title must not be empty")
    if len(title) > MAX_TITLE_LENGTH:
        raise ApiError(400, f"title must be at most {MAX_TITLE_LENGTH} characters")
    return title


def validate_status(value) -> str:
    if not isinstance(value, str) or value not in VALID_STATUSES:
        raise ApiError(400, f"status must be one of: {', '.join(VALID_STATUSES)}")
    return value


def get_task_id(event: dict) -> str:
    task_id = (event.get("pathParameters") or {}).get("taskId")
    try:
        return str(uuid.UUID(task_id))
    except (TypeError, ValueError, AttributeError):
        raise ApiError(400, "taskId must be a valid UUID")
