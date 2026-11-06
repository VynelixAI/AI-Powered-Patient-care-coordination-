import os
import re
from copy import deepcopy
from datetime import datetime

os.environ["APP_ENV"] = "test"
os.environ["AUTH_JWT_SECRET"] = "test-only-secret-that-is-long-enough-for-hmac"
os.environ["MONGODB_URI"] = "mongodb://unused.test"
os.environ["MONGODB_DATABASE"] = "vynelixai_test"
os.environ["UPLOAD_DIRECTORY"] = "uploads"

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.mongodb import get_database
from app.main import app


def matches(document, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(document, item) for item in expected):
                return False
            continue
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$regex" in expected:
                flags = re.IGNORECASE if expected.get("$options") == "i" else 0
                if actual is None or re.search(expected["$regex"], str(actual), flags) is None:
                    return False
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$gte" in expected and (actual is None or actual < expected["$gte"]):
                return False
            if "$lte" in expected and (actual is None or actual > expected["$lte"]):
                return False
        elif actual != expected:
            return False
    return True


class MemoryCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, field, direction=1):
        if isinstance(field, list):
            for name, order in reversed(field):
                self.items.sort(key=lambda item: item.get(name) or datetime.min, reverse=order < 0)
        else:
            self.items.sort(key=lambda item: item.get(field) or datetime.min, reverse=direction < 0)
        return self

    def skip(self, count):
        self.items = self.items[count:]
        return self

    def limit(self, count):
        self.items = self.items[:count]
        return self

    async def to_list(self, length=None):
        return deepcopy(self.items[:length] if length is not None else self.items)


class MemoryCollection:
    def __init__(self, name):
        self.name = name
        self.items = []

    async def create_index(self, *args, **kwargs):
        return kwargs.get("name", "test_index")

    async def insert_one(self, document):
        unique_keys = {
            "patients": ["id", "hospital_patient_id"],
            "visits": ["id"],
            "documents": ["id"],
            "assessments": ["id"],
            "doctor_reviews": ["id", "assessment_id"],
            "health_observations": ["id"],
            "care_routes": ["id", "visit_id"],
            "audit_logs": ["id"],
        }.get(self.name, [])
        for key in unique_keys:
            if any(item.get(key) == document.get(key) for item in self.items):
                raise DuplicateKeyError(f"duplicate key: {key}")
        self.items.append(deepcopy(document))
        return type("InsertResult", (), {"inserted_id": document.get("_id")})()

    async def find_one(self, query):
        for item in self.items:
            if matches(item, query):
                return deepcopy(item)
        return None

    def find(self, query):
        return MemoryCursor([item for item in self.items if matches(item, query)])

    async def count_documents(self, query):
        return sum(1 for item in self.items if matches(item, query))

    async def find_one_and_update(self, query, update, upsert=False, return_document=True):
        for item in self.items:
            if matches(item, query):
                before = deepcopy(item)
                apply_update(item, update)
                return deepcopy(item if return_document else before)
        if not upsert:
            return None
        inserted = {"_id": query.get("_id")}
        apply_update(inserted, update)
        self.items.append(inserted)
        return deepcopy(inserted)

    async def update_one(self, query, update):
        for item in self.items:
            if matches(item, query):
                apply_update(item, update)
                return type("UpdateResult", (), {"modified_count": 1, "matched_count": 1})()
        return type("UpdateResult", (), {"modified_count": 0, "matched_count": 0})()

    async def delete_one(self, query):
        for index, item in enumerate(self.items):
            if matches(item, query):
                self.items.pop(index)
                return type("DeleteResult", (), {"deleted_count": 1})()
        return type("DeleteResult", (), {"deleted_count": 0})()


def apply_update(item, update):
    for key, value in update.get("$set", {}).items():
        item[key] = deepcopy(value)
    for key, value in update.get("$inc", {}).items():
        item[key] = item.get(key, 0) + value
    for key, value in update.get("$addToSet", {}).items():
        target = item.setdefault(key, [])
        if value not in target:
            target.append(value)
    for key, value in update.get("$pull", {}).items():
        if value in item.get(key, []):
            item[key].remove(value)


class MemoryDatabase:
    collection_names = (
        "patients", "visits", "documents", "assessments", "doctor_reviews",
        "health_observations", "care_routes", "audit_logs", "counters",
        "clinical_decisions", "referrals", "specialist_consultations", "prescriptions", "follow_ups",
    )

    def __init__(self):
        self.collections = {name: MemoryCollection(name) for name in self.collection_names}

    def __getattr__(self, name):
        if name in self.collections:
            return self.collections[name]
        raise AttributeError(name)

    def __getitem__(self, name):
        return self.collections[name]

    async def command(self, name):
        return {"ok": 1}


@pytest.fixture
def database():
    return MemoryDatabase()


@pytest.fixture
def client(database, tmp_path):
    test_settings = get_settings().model_copy(update={"upload_directory": tmp_path})

    async def override_database():
        yield database

    app.dependency_overrides[get_database] = override_database
    app.dependency_overrides[get_settings] = lambda: test_settings
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def headers():
    settings = get_settings()

    def build(role="triage_staff", subject="test-user"):
        token = create_access_token(subject, role, settings)
        return {"Authorization": f"Bearer {token}"}

    return build
