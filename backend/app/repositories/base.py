from typing import Any

from pymongo import ReturnDocument


class Repository:
    def __init__(self, collection: Any):
        self.collection = collection

    async def find_one(self, query: dict) -> dict | None:
        return await self.collection.find_one(query)

    async def find_many(self, query: dict, skip: int = 0, limit: int = 100) -> list[dict]:
        cursor = self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def count(self, query: dict) -> int:
        return await self.collection.count_documents(query)

    async def insert(self, document: dict) -> None:
        await self.collection.insert_one(document)

    async def update(self, query: dict, values: dict) -> dict | None:
        return await self.collection.find_one_and_update(
            query,
            {"$set": values},
            return_document=ReturnDocument.AFTER,
        )
