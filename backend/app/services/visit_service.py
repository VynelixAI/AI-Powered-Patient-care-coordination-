import re
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.core.security import Principal
from app.repositories.base import Repository
from app.repositories.patient_repository import PatientRepository
from app.repositories.visit_repository import VisitRepository
from app.schemas.visit import VisitConsultationUpdate, VisitCreate, VisitStatus, VisitUpdate
from app.services.audit_service import record_event
from app.services.patient_service import serialize
from app.utils.dates import utc_now


async def get_visit(database: Any, identifier: str) -> dict:
    visit = await VisitRepository(database.visits).by_identifier(identifier)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    return serialize(visit)


async def create_visit(database: Any, patient_identifier: str, payload: VisitCreate, principal: Principal) -> dict:
    patient = await PatientRepository(database.patients).by_identifier(patient_identifier)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    number = await database.counters.find_one_and_update(
        {"_id": "visit_reference"},
        {"$inc": {"sequence": 1}},
        upsert=True,
        return_document=True,
    )
    visit_id = f"VYX-V-{number['sequence'] + 240000:06d}"
    now = utc_now()
    document = {
        "_id": str(uuid4()),
        "id": visit_id,
        "patient_id": patient["id"],
        "visit_number": number["sequence"],
        **payload.model_dump(mode="json"),
        "examination_findings": "",
        "consultation_notes": "",
        "status": "IN_PROGRESS",
        "created_at": now,
        "updated_at": now,
        "document_ids": [],
        "assessment_ids": [],
        "doctor_review_ids": [],
        "routing_id": None,
        "final_outcome": None,
    }
    await database.visits.insert_one(document)
    await record_event(database, principal, "VISIT_CREATED", visit_id, "A new visit was opened.", patient["id"], visit_id)
    return serialize(document)


async def list_patient_visits(database: Any, patient_id: str, page: int, page_size: int) -> dict:
    patient = await PatientRepository(database.patients).by_identifier(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    repo = Repository(database.visits)
    query = {"patient_id": patient["id"]}
    total = await repo.count(query)
    items = await repo.find_many(query, (page - 1) * page_size, page_size)
    return {"items": [serialize(item) for item in items], "page": page, "page_size": page_size, "total": total}


async def list_visits(
    database: Any,
    page: int,
    page_size: int,
    patient_id: str | None,
    status: VisitStatus | None,
    search: str | None,
) -> dict:
    query: dict[str, Any] = {}
    if patient_id:
        patient = await PatientRepository(database.patients).by_identifier(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found.")
        query["patient_id"] = patient["id"]
    if status:
        query["status"] = status.value
    if search and search.strip():
        escaped = re.escape(search.strip())
        patient_records = await database.patients.find(
            {"name": {"$regex": escaped, "$options": "i"}}
        ).limit(1000).to_list(length=1000)
        matching_patient_ids = [patient["id"] for patient in patient_records]
        search_terms: list[dict[str, Any]] = [
            {"id": {"$regex": escaped, "$options": "i"}},
            {"patient_id": {"$regex": escaped, "$options": "i"}},
            {"presenting_complaint": {"$regex": escaped, "$options": "i"}},
            {"presenting_symptoms": {"$regex": escaped, "$options": "i"}},
        ]
        if matching_patient_ids:
            search_terms.append({"patient_id": {"$in": matching_patient_ids}})
        query["$or"] = search_terms
    repo = Repository(database.visits)
    total = await repo.count(query)
    records = await repo.find_many(query, (page - 1) * page_size, page_size)
    return {"items": [serialize(record) for record in records], "page": page, "page_size": page_size, "total": total}


async def update_visit(database: Any, visit_id: str, payload: VisitUpdate, principal: Principal) -> dict:
    repo = VisitRepository(database.visits)
    visit = await repo.by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    values = payload.model_dump(mode="json", exclude_unset=True)
    if not values:
        raise HTTPException(status_code=422, detail="At least one visit field must be supplied.")
    values["updated_at"] = utc_now()
    updated = await repo.update({"_id": visit["_id"]}, values)
    action = "OUTCOME_UPDATED" if "final_outcome" in values else "VISIT_UPDATED"
    await record_event(
        database, principal, action, visit["id"], "Visit details or documented outcome updated.",
        visit["patient_id"], visit["id"],
    )
    return serialize(updated or {**visit, **values})


async def save_consultation(
    database: Any,
    visit_id: str,
    payload: VisitConsultationUpdate,
    principal: Principal,
) -> dict:
    repo = VisitRepository(database.visits)
    visit = await repo.by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")

    # Confirm the visit's stored patient relationship before modifying it.
    patient = await PatientRepository(database.patients).by_identifier(visit["patient_id"])
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient associated with this visit was not found.")

    values = {**payload.model_dump(mode="json"), "updated_at": utc_now()}
    updated = await repo.update({"_id": visit["_id"]}, values)
    saved = updated or {**visit, **values}
    await record_event(
        database,
        principal,
        "CONSULTATION_SAVED",
        visit["id"],
        "Clinical examination findings and consultation notes were saved.",
        patient["id"],
        visit["id"],
    )
    return {
        "visit_id": saved["id"],
        "patient_id": saved["patient_id"],
        "consultation": {
            "examination_findings": saved["examination_findings"],
            "consultation_notes": saved["consultation_notes"],
            "updated_at": saved["updated_at"],
        },
    }
