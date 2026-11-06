from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.core.security import Principal
from app.repositories.visit_repository import VisitRepository
from app.schemas.routing import RoutingCreate
from app.services.audit_service import record_event
from app.services.patient_service import serialize
from app.utils.dates import utc_now


async def create_care_route(
    database: Any, visit_id: str, payload: RoutingCreate, principal: Principal
) -> dict:
    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    if await database.care_routes.find_one({"visit_id": visit["id"]}) is not None:
        raise HTTPException(status_code=409, detail="A care route already exists for this visit.")
    # New workflow records an explicit manual clinical decision. The legacy
    # assessment/review fallback remains only for existing historical records.
    decision = await database.clinical_decisions.find({"visit_id": visit["id"]}).sort("updated_at", -1).limit(1).to_list(length=1)
    review = decision[0] if decision else None
    assessment = None
    if review is None:
        assessments = await database.assessments.find({"visit_id": visit["id"]}).sort("created_at", -1).limit(1).to_list(length=1)
        if assessments and assessments[0].get("status") == "REVIEWED":
            assessment = assessments[0]
            review = await database.doctor_reviews.find_one({"assessment_id": assessment["id"]})
    if review is None or review.get("final_destination") != payload.destination.value:
        raise HTTPException(status_code=409, detail="Routing destination must match a saved clinician decision.")
    now = utc_now()
    route = {
        "_id": str(uuid4()),
        "id": f"RTE-{uuid4().hex[:12].upper()}",
        "patient_id": visit["patient_id"],
        "visit_id": visit["id"],
        "assessment_id": assessment["id"] if assessment else None,
        "doctor_review_id": review["id"],
        "clinical_decision_id": review["id"] if decision else None,
        "destination": review["final_destination"],
        "approved_priority": review["final_priority"],
        "routing_status": "SIMULATED_READY",
        "assigned_clinician": payload.assigned_clinician,
        "created_at": now,
        "completed_at": None,
    }
    try:
        await database.care_routes.insert_one(route)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="A care route already exists for this visit.") from exc
    await database.visits.update_one(
        {"_id": visit["_id"]}, {"$set": {"routing_id": route["id"], "status": "ROUTED"}}
    )
    await record_event(
        database, principal, "CARE_ROUTE_CREATED", route["id"],
        "Simulated care route created from clinician-approved decision.", visit["patient_id"], visit["id"],
    )
    return serialize(route)


async def get_care_route(database: Any, visit_id: str) -> dict:
    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    route = await database.care_routes.find_one({"visit_id": visit["id"]})
    if route is None:
        raise HTTPException(status_code=404, detail="Care route not found.")
    return serialize(route)
