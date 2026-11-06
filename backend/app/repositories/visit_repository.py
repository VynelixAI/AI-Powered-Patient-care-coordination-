from app.repositories.base import Repository


class VisitRepository(Repository):
    async def by_identifier(self, identifier: str) -> dict | None:
        return await self.find_one({"$or": [{"id": identifier}, {"_id": identifier}]})
