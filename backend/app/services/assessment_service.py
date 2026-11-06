from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.core.security import Principal
from app.repositories.visit_repository import VisitRepository
from app.services.ai_service import SimulatedAssessmentService
from app.services.audit_service import record_event
from app.services.comparison_service import compare_observations
from app.services.history_service import get_current_visit_context, get_relevant_patient_history
from app.services.patient_service import serialize
from app.utils.dates import utc_now


async def generate_assessment(database: Any, visit_id: str, principal: Principal) -> dict:
    current = await get_current_visit_context(database, visit_id)
    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    history = await get_relevant_patient_history(database, visit["patient_id"], visit_id)
    comparisons = await compare_observations(database, visit["patient_id"], visit_id, current["observations"])
    await record_event(
        database,
        principal,
        "PATIENT_HISTORY_RETRIEVED",
        visit["patient_id"],
        "Relevant stored history retrieved for assessment context.",
        visit["patient_id"],
        visit["id"],
    )
    generated = SimulatedAssessmentService().generate(current, history, comparisons)
    evidence = []
    evidence_ids = set()
    for item in current["observations"]:
        evidence.append(
            {
                "source_record_id": item["id"],
                "visit_id": item["visit_id"],
                "date": item["recorded_at"],
                "value": item["value"],
                "unit": item["unit"],
                "verification_status": item["verification_status"],
            }
        )
        evidence_ids.add(item["id"])
    for comparison in comparisons:
        historical = comparison.get("historical")
        if historical and historical["id"] not in evidence_ids:
            evidence.append(
                {
                    "source_record_id": historical["id"],
                    "visit_id": None,
                    "date": historical["recorded_at"],
                    "value": historical["value"],
                    "unit": historical["unit"],
                    "verification_status": historical["verification_status"],
                }
            )
            evidence_ids.add(historical["id"])
    for observation in history["observations"]:
        if observation["id"] not in evidence_ids:
            evidence.append(
                {
                    "source_record_id": observation["id"],
                    "visit_id": observation["visit_id"],
                    "date": observation["recorded_at"],
                    "value": observation["value"],
                    "unit": observation["unit"],
                    "verification_status": observation["verification_status"],
                }
            )
            evidence_ids.add(observation["id"])
    for source_document in [*history["documents"], *current["documents"]]:
        if source_document["id"] in evidence_ids:
            continue
        findings = source_document.get("extracted_findings", [])
        evidence.append(
            {
                "source_record_id": source_document["id"],
                "visit_id": source_document["visit_id"],
                "date": source_document["uploaded_at"],
                "value": findings if source_document.get("extraction_status") == "VERIFIED" else None,
                "unit": None,
                "verification_status": source_document.get("extraction_status", "UNKNOWN"),
            }
        )
        evidence_ids.add(source_document["id"])
    document = {
        "_id": str(uuid4()),
        "id": f"ASM-{uuid4().hex[:12].upper()}",
        "patient_id": visit["patient_id"],
        "visit_id": visit["id"],
        **generated,
         "status": "PENDING_DOCTOR_REVIEW",
        "evidence_references": evidence,
        "created_at": utc_now(),
    }
    await database.assessments.insert_one(document)
    await database.visits.update_one(
        {"_id": visit["_id"]},
        {"$addToSet": {"assessment_ids": document["id"]}, "$set": {"status": "AWAITING_REVIEW"}},
    )
    await record_event(
        database, principal, "ASSESSMENT_GENERATED", document["id"],
        "Simulated assessment generated for clinician review.", visit["patient_id"], visit["id"],
    )
    return serialize(document)


async def get_assessment(database: Any, assessment_id: str) -> dict:
    assessment = await database.assessments.find_one({"id": assessment_id})
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return serialize(assessment)


async def list_visit_assessments(database: Any, visit_id: str, page: int, page_size: int) -> dict:
    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    query = {"visit_id": visit["id"]}
    total = await database.assessments.count_documents(query)
    items = await database.assessments.find(query).sort("created_at", -1).skip(
        (page - 1) * page_size
    ).limit(page_size).to_list(length=page_size)
    return {"items": [serialize(item) for item in items], "page": page, "page_size": page_size, "total": total}
