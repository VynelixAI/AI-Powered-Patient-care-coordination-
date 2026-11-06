from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.core.security import Principal
from app.repositories.visit_repository import VisitRepository
from app.schemas.observation import ObservationCreate
from app.services.audit_service import record_event
from app.services.comparison_service import compare_current_and_historical_data
from app.services.patient_service import serialize
from app.utils.dates import utc_now


async def list_visit_observations(database: Any, visit_id: str, page: int, page_size: int) -> dict:
    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    query = {"visit_id": visit["id"]}
    total = await database.health_observations.count_documents(query)
    observations = await database.health_observations.find(query).sort("recorded_at", -1).skip(
        (page - 1) * page_size
    ).limit(page_size).to_list(length=page_size)
    return {
        "items": [serialize(item) for item in observations],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


async def create_observation(
    database: Any, visit_id: str, payload: ObservationCreate, principal: Principal
) -> dict:
    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    observation = {
        "_id": str(uuid4()),
        "id": f"OBS-{uuid4().hex[:12].upper()}",
        "patient_id": visit["patient_id"],
        "visit_id": visit["id"],
        **payload.model_dump(mode="json"),
        "recorded_at": payload.recorded_at or utc_now(),
    }
    await database.health_observations.insert_one(observation)
    await record_event(
        database, principal, "OBSERVATION_RECORDED", observation["id"],
        "Structured health observation recorded.", visit["patient_id"], visit["id"],
    )
    return serialize(observation)


async def get_patient_trends(
    database: Any,
    patient_id: str,
    measurement_type: str | None,
    start: Any,
    end: Any,
    page: int,
    page_size: int,
) -> dict:
    patient = await database.patients.find_one({"$or": [{"id": patient_id}, {"_id": patient_id}]})
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    query: dict = {"patient_id": patient["id"]}
    if measurement_type:
        query["measurement_type"] = measurement_type
    time_range = {}
    if start is not None:
        time_range["$gte"] = start
    if end is not None:
        time_range["$lte"] = end
    if time_range:
        query["recorded_at"] = time_range
    total = await database.health_observations.count_documents(query)
    observations = await database.health_observations.find(query).sort("recorded_at", 1).skip(
        (page - 1) * page_size
    ).limit(page_size).to_list(length=page_size)
    groups: dict[tuple[str, str], list[dict]] = {}
    for observation in observations:
        groups.setdefault((observation["measurement_type"], observation["unit"]), []).append(observation)
    comparisons = []
    for group in groups.values():
        if len(group) > 1:
            comparisons.extend(compare_current_and_historical_data([group[-1]], group[:-1]))
    return {
        "patient_id": patient["id"],
        "items": [serialize(item) for item in observations],
        "comparisons": comparisons,
        "page": page,
        "page_size": page_size,
        "total": total,
    }
