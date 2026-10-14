"""Identity extraction from the API Gateway Cognito User Pool authorizer."""
from common.responses import ApiError


def get_user_id(event: dict) -> str:
    """Return the verified Cognito 'sub' claim. Never reads body or query params."""
    try:
        sub = event["requestContext"]["authorizer"]["claims"]["sub"]
    except (KeyError, TypeError):
        sub = None
    if not isinstance(sub, str) or not sub.strip():
        raise ApiError(401, "Unauthorized")
    return sub
