import json
import uuid
from datetime import datetime

import pytest
from botocore.exceptions import ClientError

from conftest import USER_A, USER_B, body_of, make_event
from handlers import create_task, delete_task, list_tasks, update_task

ALL_HANDLERS = [create_task, list_tasks, update_task, delete_task]


def create(user=USER_A, **body):
    resp = create_task.handler(make_event(user, body=body), None)
    assert resp["statusCode"] == 201, resp
    return body_of(resp)


# ---------- create ----------
def test_create_task(table):
    resp = create_task.handler(make_event(body={"title": "  Write report "}), None)
    assert resp["statusCode"] == 201
    task = body_of(resp)
    assert task["title"] == "Write report"
    assert task["status"] == "todo"
    assert task["userId"] == USER_A
    uuid.UUID(task["taskId"])
    assert task["createdAt"] == task["updatedAt"]
    assert task["createdAt"].endswith("Z")
    datetime.fromisoformat(task["createdAt"].replace("Z", "+00:00"))
    assert resp["headers"]["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert table.scan()["Count"] == 1


def test_create_with_explicit_status(table):
    assert create(title="x", status="in_progress")["status"] == "in_progress"


def test_create_ignores_client_supplied_user_id(table):
    task = create(title="x", userId=USER_B)
    assert task["userId"] == USER_A
    assert table.scan()["Items"][0]["userId"] == USER_A


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"title": ""},
        {"title": "   "},
        {"title": None},
        {"title": 123},
        {"title": "x" * 201},
        {"title": "ok", "status": "bogus"},
        {"title": "ok", "status": None},
        {"title": "ok", "status": 1},
    ],
)
def test_create_invalid_input(table, body):
    resp = create_task.handler(make_event(body=body), None)
    assert resp["statusCode"] == 400
    assert table.scan()["Count"] == 0


def test_create_title_boundary(table):
    assert create(title="x" * 200)["title"] == "x" * 200


@pytest.mark.parametrize("raw", [None, "", "{not json", "[1,2]", '"str"', "123", "null"])
def test_create_malformed_body(table, raw):
    resp = create_task.handler(make_event(raw_body=raw), None)
    assert resp["statusCode"] == 400


def test_create_oversized_body(table):
    resp = create_task.handler(make_event(body={"title": "a", "x": "y" * 20000}), None)
    assert resp["statusCode"] == 400


# ---------- list ----------
def test_list_empty(table):
    resp = list_tasks.handler(make_event(), None)
    assert resp["statusCode"] == 200
    assert body_of(resp) == {"tasks": []}


def test_list_returns_only_own_tasks_newest_first(table):
    first = create(title="first")
    second = create(title="second")
    create(user=USER_B, title="not mine")
    tasks = body_of(list_tasks.handler(make_event(), None))["tasks"]
    assert [t["taskId"] for t in tasks] == [second["taskId"], first["taskId"]]
    assert all(t["userId"] == USER_A for t in tasks)


def test_list_ignores_user_id_query_param(table):
    create(user=USER_B, title="secret")
    resp = list_tasks.handler(make_event(query={"userId": USER_B}), None)
    assert body_of(resp)["tasks"] == []


# ---------- update ----------
def test_update_status_and_title(table):
    task = create(title="old")
    resp = update_task.handler(
        make_event(body={"status": "done", "title": " new "}, task_id=task["taskId"]), None
    )
    assert resp["statusCode"] == 200
    updated = body_of(resp)
    assert (updated["status"], updated["title"]) == ("done", "new")
    assert updated["createdAt"] == task["createdAt"]
    assert updated["updatedAt"] >= task["updatedAt"]
    stored = table.get_item(Key={"userId": USER_A, "taskId": task["taskId"]})["Item"]
    assert stored["status"] == "done"


def test_update_status_only_keeps_title(table):
    task = create(title="keep")
    updated = body_of(update_task.handler(make_event(body={"status": "done"}, task_id=task["taskId"]), None))
    assert updated["title"] == "keep"


@pytest.mark.parametrize(
    "body",
    [{}, {"status": "bogus"}, {"title": ""}, {"title": "x" * 201}, {"title": 5}, {"status": None}, {"foo": "bar"}],
)
def test_update_invalid_input(table, body):
    task = create(title="orig")
    resp = update_task.handler(make_event(body=body, task_id=task["taskId"]), None)
    assert resp["statusCode"] == 400
    assert table.get_item(Key={"userId": USER_A, "taskId": task["taskId"]})["Item"]["title"] == "orig"


def test_update_malformed_body(table):
    task = create(title="x")
    assert update_task.handler(make_event(raw_body="{oops", task_id=task["taskId"]), None)["statusCode"] == 400
    assert update_task.handler(make_event(task_id=task["taskId"]), None)["statusCode"] == 400


def test_update_nonexistent_task_is_404_and_does_not_create(table):
    resp = update_task.handler(make_event(body={"status": "done"}, task_id=str(uuid.uuid4())), None)
    assert resp["statusCode"] == 404
    assert table.scan()["Count"] == 0


def test_update_other_users_task_is_404(table):
    task = create(user=USER_B, title="theirs")
    resp = update_task.handler(make_event(body={"status": "done"}, task_id=task["taskId"]), None)
    assert resp["statusCode"] == 404
    stored = table.get_item(Key={"userId": USER_B, "taskId": task["taskId"]})["Item"]
    assert stored["status"] == "todo"


@pytest.mark.parametrize("task_id", [None, "", "not-a-uuid", "../etc"])
def test_update_invalid_task_id(table, task_id):
    resp = update_task.handler(make_event(body={"status": "done"}, task_id=task_id), None)
    assert resp["statusCode"] == 400


# ---------- delete ----------
def test_delete_task(table):
    task = create(title="bye")
    resp = delete_task.handler(make_event(task_id=task["taskId"]), None)
    assert resp["statusCode"] == 204
    assert "body" not in resp
    assert table.scan()["Count"] == 0


def test_delete_nonexistent_task_is_404(table):
    assert delete_task.handler(make_event(task_id=str(uuid.uuid4())), None)["statusCode"] == 404


def test_delete_other_users_task_is_404_and_task_survives(table):
    task = create(user=USER_B, title="theirs")
    resp = delete_task.handler(make_event(task_id=task["taskId"]), None)
    assert resp["statusCode"] == 404
    assert table.scan()["Count"] == 1


def test_delete_invalid_task_id(table):
    assert delete_task.handler(make_event(task_id="nope"), None)["statusCode"] == 400


# ---------- authentication ----------
@pytest.mark.parametrize("handler", ALL_HANDLERS)
@pytest.mark.parametrize(
    "event_patch",
    [
        {"requestContext": {}},
        {"requestContext": {"authorizer": None}},
        {"requestContext": {"authorizer": {"claims": {}}}},
        {"requestContext": {"authorizer": {"claims": {"sub": ""}}}},
        {"requestContext": {"authorizer": {"claims": {"sub": None}}}},
        {"requestContext": {"authorizer": {"claims": {"sub": 42}}}},
        {"requestContext": None},
    ],
)
def test_missing_auth_claims_returns_401(table, handler, event_patch):
    event = make_event(body={"title": "x", "status": "done"}, task_id=str(uuid.uuid4()))
    event.update(event_patch)
    resp = handler.handler(event, None)
    assert resp["statusCode"] == 401
    assert body_of(resp) == {"message": "Unauthorized"}
    assert table.scan()["Count"] == 0


def test_event_without_request_context_returns_401(table):
    assert list_tasks.handler({}, None)["statusCode"] == 401


# ---------- error hygiene ----------
def test_unexpected_error_returns_generic_500(table, monkeypatch):
    from common import db

    def boom(*a, **k):
        raise ClientError({"Error": {"Code": "InternalServerError", "Message": "secret-table-arn"}}, "Query")

    monkeypatch.setattr(db, "list_tasks", boom)
    resp = list_tasks.handler(make_event(), None)
    assert resp["statusCode"] == 500
    assert body_of(resp) == {"message": "Internal server error"}
    assert "secret" not in resp["body"]
