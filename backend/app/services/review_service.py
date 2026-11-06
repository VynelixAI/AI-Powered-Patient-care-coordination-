from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.core.security import Principal
from app.schemas.review import DoctorReviewCreate
from app.services.audit_service import record_event
from app.services.patient_service import serialize
from app.utils.dates import utc_now


async def review_assessment(
    database: Any, assessment_id: str, payload: DoctorReviewCreate, principal: Principal
) -> dict:
    assessment = await database.assessments.find_one({"id": assessment_id})
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    if assessment["status"] != "PENDING_DOCTOR_REVIEW":
        raise HTTPException(status_code=409, detail="This assessment has already been reviewed.")
    now = utc_now()
    review = {
        "_id": str(uuid4()),
        "id": f"REV-{uuid4().hex[:12].upper()}",
        "assessment_id": assessment_id,
        "patient_id": assessment["patient_id"],
        "visit_id": assessment["visit_id"],
        "decision": payload.decision.value,
        "clinician_id": principal.subject,
        "comment": payload.comment,
        "final_priority": payload.final_priority.value,
        "final_destination": payload.final_destination,
        "reviewed_at": now,
    }
    transitioned = await database.assessments.find_one_and_update(
        {"_id": assessment["_id"], "status": "PENDING_DOCTOR_REVIEW"},
        {"$set": {"status": "REVIEWED", "doctor_review_id": review["id"], "reviewed_at": now}},
        return_document=True,
    )
    if transitioned is None:
        raise HTTPException(status_code=409, detail="This assessment has already been reviewed.")
    await database.doctor_reviews.insert_one(review)
    await database.visits.update_one(
        {"id": assessment["visit_id"]}, {"$addToSet": {"doctor_review_ids": review["id"]}}
    )
    await record_event(
        database,
        principal,
        f"DOCTOR_{payload.decision.value}",
        review["id"],
        f"Clinician recorded {payload.decision.value.lower()} decision.",
        assessment["patient_id"],
        assessment["visit_id"],
    )
    return {"review": serialize(review), "assessment_status": "REVIEWED"}


async def get_review(database: Any, assessment_id: str) -> dict:
    review = await database.doctor_reviews.find_one({"assessment_id": assessment_id})
    if review is None:
        raise HTTPException(status_code=404, detail="Doctor review not found.")
    return serialize(review)


async def list_pending_reviews(database: Any, page: int, page_size: int) -> dict:
    query = {"status": "PENDING_DOCTOR_REVIEW"}
    total = await database.assessments.count_documents(query)
    assessments = await database.assessments.find(query).sort("created_at", 1).skip(
        (page - 1) * page_size
    ).limit(page_size).to_list(length=page_size)
    return {
        "items": [serialize(assessment) for assessment in assessments],
        "page": page,
        "page_size": page_size,
        "total": total,
    }
