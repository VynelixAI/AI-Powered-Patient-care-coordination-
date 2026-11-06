import re
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.core.security import Principal
from app.repositories.patient_repository import PatientRepository
from app.schemas.patient import PatientCreate, PatientUpdate
from app.services.audit_service import record_event
from app.utils.dates import utc_now
from app.utils.patient_id import generate_patient_id


def serialize(document: dict) -> dict:
    item = dict(document)
    internal_id = item.pop("_id", None)
    if internal_id is not None:
        item["internal_id"] = internal_id
    item["hospital_patient_id"] = item.get("hospital_patient_id", item.get("id"))
    return item


async def create_patient(database: Any, payload: PatientCreate, principal: Principal) -> dict:
    repo = PatientRepository(database.patients)
    for _ in range(3):
        patient_id = await generate_patient_id(database)
        now = utc_now()
        document = {
            "_id": str(uuid4()),
            "id": patient_id,
            "hospital_patient_id": patient_id,
            **payload.model_dump(mode="json"),
            "created_at": now,
            "updated_at": now,
        }
        try:
            await repo.insert(document)
        except DuplicateKeyError:
            continue
        visit_number = await database.counters.find_one_and_update(
            {"_id": "visit_reference"},
            {"$inc": {"sequence": 1}},
            upsert=True,
            return_document=True,
        )
        initial_visit_id = f"VYX-V-{visit_number['sequence'] + 240000:06d}"
        initial_visit = {
            "_id": str(uuid4()),
            "id": initial_visit_id,
            "patient_id": patient_id,
            "visit_number": visit_number["sequence"],
            "presenting_complaint": "Initial assessment",
            "presenting_symptoms": "",
            "symptom_onset": None,
            "symptom_duration": None,
            "current_medications": [],
            "medication_changes": None,
            "examination_findings": "",
            "consultation_notes": "",
            "clinician_notes": "",
            "status": "IN_PROGRESS",
            "created_at": now,
            "updated_at": now,
            "document_ids": [],
            "assessment_ids": [],
            "doctor_review_ids": [],
            "routing_id": None,
            "final_outcome": None,
        }
        await database.visits.insert_one(initial_visit)
        await record_event(database, principal, "PATIENT_REGISTERED", patient_id, "Patient record registered.", patient_id)
        await record_event(
            database, principal, "VISIT_CREATED", initial_visit_id,
            "Initial visit opened during patient registration.", patient_id, initial_visit_id,
        )
        return {**serialize(document), "visits": [serialize(initial_visit)]}
    raise HTTPException(status_code=503, detail="Could not allocate a unique Hospital Patient ID; retry the request.")


async def get_patient(database: Any, identifier: str) -> dict:
    document = await PatientRepository(database.patients).by_identifier(identifier)
    if document is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return serialize(document)


async def search_patients(database: Any, search: str | None, page: int, page_size: int) -> dict:
    repo = PatientRepository(database.patients)
    query: dict = {}
    if search:
        escaped = re.escape(search.strip())
        query = {
            "$or": [
                {"hospital_patient_id": {"$regex": f"^{escaped}", "$options": "i"}},
                {"name": {"$regex": escaped, "$options": "i"}},
                {"phone": {"$regex": escaped, "$options": "i"}},
            ]
        }
    total = await repo.count(query)
    records = await repo.search(query, (page - 1) * page_size, page_size)
    return {"items": [serialize(record) for record in records], "page": page, "page_size": page_size, "total": total}


async def update_patient(database: Any, identifier: str, payload: PatientUpdate, principal: Principal) -> dict:
    repo = PatientRepository(database.patients)
    patient = await repo.by_identifier(identifier)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    values = payload.model_dump(mode="json", exclude_unset=True)
    if not values:
        raise HTTPException(status_code=422, detail="At least one patient field must be supplied.")
    values["updated_at"] = utc_now()
    updated = await repo.update({"_id": patient["_id"]}, values)
    await record_event(
        database, principal, "PATIENT_UPDATED", patient["id"], "Permitted patient details updated.", patient["id"]
    )
    return serialize(updated or {**patient, **values})
