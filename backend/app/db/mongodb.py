from collections.abc import AsyncIterator
from typing import Any

from fastapi import HTTPException, Request
from pymongo import AsyncMongoClient


async def get_database(request: Request) -> AsyncIterator[Any]:
    database = getattr(request.app.state, "database", None)
    if database is None:
        raise HTTPException(status_code=503, detail="Database is not available.")
    yield database


async def connect_mongodb(uri: str, database_name: str) -> tuple[AsyncMongoClient, Any]:
    client = AsyncMongoClient(uri, serverSelectionTimeoutMS=5000)
    await client.admin.command("ping")
    return client, client[database_name]
