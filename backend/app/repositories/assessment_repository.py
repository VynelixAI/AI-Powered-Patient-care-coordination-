from app.repositories.base import Repository


class AssessmentRepository(Repository):
    async def for_visit(self, visit_id: str, skip: int = 0, limit: int = 100) -> list[dict]:
        return await self.find_many({"visit_id": visit_id}, skip, limit)
