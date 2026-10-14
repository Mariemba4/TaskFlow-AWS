"""Decorator giving every handler uniform auth, error handling and logging."""
import functools
import logging
import os

from common.auth import get_user_id
from common.responses import ApiError, error_response

logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


def api_handler(func):
    """Wrap `func(event, user_id) -> response`.

    ApiError -> its status/message. Anything else -> logged, generic 500
    (no internal details leak to the client).
    """

    @functools.wraps(func)
    def wrapper(event, context):
        try:
            user_id = get_user_id(event)
            return func(event, user_id)
        except ApiError as err:
            return error_response(err.status_code, err.message)
        except Exception:
            logger.exception("Unhandled error")
            return error_response(500, "Internal server error")

    return wrapper
