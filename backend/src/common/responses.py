"""API Gateway proxy response helpers and the ApiError exception."""
import json
import os


class ApiError(Exception):
    """Raised by handlers/helpers to return a controlled, client-safe error."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def response(status_code: int, body=None) -> dict:
    headers = {
        "Content-Type": "application/json",
        # SAM's Cors block only covers the OPTIONS preflight; proxy responses need this too.
        "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", ""),
    }
    result = {"statusCode": status_code, "headers": headers}
    if body is not None:
        result["body"] = json.dumps(body)
    return result


def error_response(status_code: int, message: str) -> dict:
    return response(status_code, {"message": message})
