from typing import Any

from fastapi import HTTPException

from app.repositories.base import Repository
from app.repositories.patient_repository import PatientRepository
from app.services.patient_service import serialize
from app.services.document_service import public_document


async def get_patient_history(database: Any, identifier: str, page: int, page_size: int) -> dict:
    patient = await PatientRepository(database.patients).by_identifier(identifier)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    visits_repo = Repository(database.visits)
    visit_query = {"patient_id": patient["id"]}
    visit_total = await visits_repo.count(visit_query)
    visits = await visits_repo.find_many(visit_query, (page - 1) * page_size, page_size)
    related = {}
    related_pagination = {}
    for name, timestamp in (
        ("documents", "uploaded_at"),
        ("assessments", "created_at"),
        ("doctor_reviews", "reviewed_at"),
        ("health_observations", "recorded_at"),
        ("care_routes", "created_at"),
    ):
        repository = Repository(database[name])
        query = {"patient_id": patient["id"]}
        total = await repository.count(query)
        cursor = database[name].find(query).sort(timestamp, -1).skip(
            (page - 1) * page_size
        ).limit(page_size)
        related[name] = await cursor.to_list(length=page_size)
        related_pagination[name] = {"page": page, "page_size": page_size, "total": total}
    return {
        "patient": {
            "id": patient["id"],
            "name": patient["name"],
            "hospital_patient_id": patient["hospital_patient_id"],
            "medical_history": patient.get("medical_history", ""),
            "conditions": patient.get("conditions", []),
            "allergies": patient.get("allergies", []),
            "medications": patient.get("medications", []),
        },
        "visits": [serialize(visit) for visit in visits],
        "pagination": {"page": page, "page_size": page_size, "total_visits": visit_total},
        "related_pagination": related_pagination,
        "clinician_recorded_diagnoses": [
            {"visit_id": visit["id"], "diagnoses": visit.get("clinician_recorded_diagnoses", [])}
            for visit in visits if visit.get("clinician_recorded_diagnoses")
        ],
        "documents": [public_document(item) for item in related["documents"]],
        "assessments": [serialize(item) for item in related["assessments"]],
        "doctor_decisions": [serialize(item) for item in related["doctor_reviews"]],
        "care_routes": [serialize(item) for item in related["care_routes"]],
        "treatments_and_follow_up": [
            {"visit_id": visit["id"], "outcome": visit.get("final_outcome")}
            for visit in visits if visit.get("final_outcome")
        ],
        "health_observations": [serialize(item) for item in related["health_observations"]],
        "historical_outcomes": [
            {"visit_id": visit["id"], "outcome": visit["final_outcome"]}
            for visit in visits if visit.get("final_outcome")
        ],
    }


async def get_current_visit_context(database: Any, visit_id: str) -> dict:
    from app.repositories.visit_repository import VisitRepository

    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    documents = await Repository(database.documents).find_many({"visit_id": visit["id"]}, 0, 100)
    observations = await Repository(database.health_observations).find_many({"visit_id": visit["id"]}, 0, 500)
    return {
        "visit": serialize(visit),
        "documents": [public_document(document) for document in documents],
        "observations": [serialize(observation) for observation in observations],
    }


async def get_relevant_patient_history(database: Any, patient_id: str, visit_id: str) -> dict:
    patient = await PatientRepository(database.patients).by_identifier(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    visits = await Repository(database.visits).find_many(
        {"patient_id": patient["id"], "id": {"$ne": visit_id}}, 0, 100
    )
    documents = await Repository(database.documents).find_many(
        {"patient_id": patient["id"], "visit_id": {"$ne": visit_id}}, 0, 500
    )
    assessments = await Repository(database.assessments).find_many(
        {"patient_id": patient["id"], "visit_id": {"$ne": visit_id}}, 0, 500
    )
    reviews = await Repository(database.doctor_reviews).find_many({"patient_id": patient["id"]}, 0, 500)
    observations = await Repository(database.health_observations).find_many(
        {"patient_id": patient["id"], "visit_id": {"$ne": visit_id}}, 0, 2000
    )
    return {
        "patient": serialize(patient),
        "visits": [serialize(item) for item in visits],
        "documents": [public_document(document) for document in documents],
        "assessments": assessments,
        "reviews": reviews,
        "observations": observations,
    }
