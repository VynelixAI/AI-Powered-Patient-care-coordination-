from app.repositories.base import Repository


class PatientRepository(Repository):
    async def by_identifier(self, identifier: str) -> dict | None:
        return await self.find_one({"$or": [{"id": identifier}, {"_id": identifier}]})

    async def search(self, query: dict, skip: int, limit: int) -> list[dict]:
        cursor = self.collection.find(query).sort("name", 1).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)
