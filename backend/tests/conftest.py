import json
import os
import sys

import boto3
import pytest
from moto import mock_aws

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

TABLE_NAME = "taskflow-test-tasks"
USER_A = "11111111-aaaa-aaaa-aaaa-111111111111"
USER_B = "22222222-bbbb-bbbb-bbbb-222222222222"


@pytest.fixture(autouse=True)
def aws_env(monkeypatch):
    # Dummy values so boto3 can never pick up real credentials during tests.
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)
    monkeypatch.setenv("ALLOWED_ORIGIN", "http://localhost:5173")


@pytest.fixture
def table(aws_env):
    from common import db

    with mock_aws():
        db.reset_table_cache()
        ddb = boto3.resource("dynamodb")
        tbl = ddb.create_table(
            TableName=TABLE_NAME,
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[
                {"AttributeName": "userId", "AttributeType": "S"},
                {"AttributeName": "taskId", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "userId", "KeyType": "HASH"},
                {"AttributeName": "taskId", "KeyType": "RANGE"},
            ],
        )
        yield tbl
        db.reset_table_cache()


def make_event(user_id=USER_A, body=None, task_id=None, raw_body=None, query=None):
    event = {
        "requestContext": {"authorizer": {"claims": {"sub": user_id}}} if user_id else {},
        "pathParameters": {"taskId": task_id} if task_id else None,
        "queryStringParameters": query,
        "body": raw_body if raw_body is not None else (json.dumps(body) if body is not None else None),
    }
    return event


def body_of(resp):
    return json.loads(resp["body"]) if resp.get("body") else None
