from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.core.security import Principal
from app.repositories.patient_repository import PatientRepository
from app.repositories.visit_repository import VisitRepository
from app.schemas.clinical_workflow import (
    ClinicalDecisionUpsert, FollowUpCreate, FollowUpStatus, FollowUpUpdate, PrescriptionCreate,
    PrescriptionDispense, PrescriptionStatus, ReferralCreate, ReferralStatus, ReferralStatusUpdate,
    SpecialistConsultationUpsert,
)
from app.services.audit_service import record_event
from app.services.patient_service import serialize
from app.utils.dates import utc_now


async def _visit(database: Any, visit_id: str) -> dict:
    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    if await PatientRepository(database.patients).by_identifier(visit["patient_id"]) is None:
        raise HTTPException(status_code=404, detail="Patient associated with this visit was not found.")
    return visit


async def save_clinical_decision(database: Any, visit_id: str, payload: ClinicalDecisionUpsert, principal: Principal) -> dict:
    visit = await _visit(database, visit_id)
    values = payload.model_dump(mode="json")
    now = utc_now()
    existing = await database.clinical_decisions.find_one({"visit_id": visit["id"], "clinician_id": principal.subject})
    if existing:
        values["updated_at"] = now
        updated = await database.clinical_decisions.find_one_and_update(
            {"_id": existing["_id"]}, {"$set": values}, return_document=True
        )
        action = "CLINICAL_DECISION_UPDATED"
    else:
        updated = {
            "_id": str(uuid4()), "id": f"CDS-{uuid4().hex[:12].upper()}",
            "patient_id": visit["patient_id"], "visit_id": visit["id"], "clinician_id": principal.subject,
            "clinician_role": principal.role, **values, "created_at": now, "updated_at": now,
        }
        try:
            await database.clinical_decisions.insert_one(updated)
        except DuplicateKeyError as exc:
            raise HTTPException(status_code=409, detail="A decision is already being saved for this visit; retry the request.") from exc
        action = "CLINICAL_DECISION_CREATED"
    await record_event(database, principal, action, updated["id"], "Clinician decision and treatment plan recorded.", visit["patient_id"], visit["id"])
    return serialize(updated)


async def list_clinical_decisions(database: Any, visit_id: str) -> dict:
    visit = await _visit(database, visit_id)
    records = await database.clinical_decisions.find({"visit_id": visit["id"]}).sort("created_at", -1).to_list(length=100)
    return {"items": [serialize(record) for record in records]}


async def create_referral(database: Any, visit_id: str, payload: ReferralCreate, principal: Principal) -> dict:
    visit = await _visit(database, visit_id)
    duplicate = await database.referrals.find_one({
        "visit_id": visit["id"], "destination_specialty": payload.destination_specialty,
        "status": {"$in": [ReferralStatus.PENDING.value, ReferralStatus.ACCEPTED.value, ReferralStatus.IN_PROGRESS.value]},
    })
    if duplicate:
        raise HTTPException(status_code=409, detail="An active referral for this specialty already exists for the visit.")
    now = utc_now()
    referral = {
        "_id": str(uuid4()), "id": f"REF-{uuid4().hex[:12].upper()}", "patient_id": visit["patient_id"], "visit_id": visit["id"],
        "referring_clinician_id": principal.subject, "destination_specialty": payload.destination_specialty,
        "reason": payload.reason, "clinical_summary": payload.clinical_summary, "priority": payload.priority.value,
        "assigned_specialist_id": payload.assigned_specialist_id, "status": ReferralStatus.PENDING.value,
        "created_at": now, "updated_at": now,
    }
    await database.referrals.insert_one(referral)
    await record_event(database, principal, "REFERRAL_CREATED", referral["id"], "Referral created for the selected specialty.", visit["patient_id"], visit["id"])
    return serialize(referral)


async def list_referrals(database: Any, principal: Principal, patient_id: str | None = None) -> dict:
    query: dict[str, Any] = {}
    if principal.role == "specialist":
        query["assigned_specialist_id"] = principal.subject
    if patient_id:
        patient = await PatientRepository(database.patients).by_identifier(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found.")
        query["patient_id"] = patient["id"]
    records = await database.referrals.find(query).sort("created_at", -1).to_list(length=200)
    return {"items": [serialize(record) for record in records]}


async def _referral_for_access(database: Any, referral_id: str, principal: Principal) -> dict:
    referral = await database.referrals.find_one({"$or": [{"id": referral_id}, {"_id": referral_id}]})
    if referral is None:
        raise HTTPException(status_code=404, detail="Referral not found.")
    if principal.role == "specialist" and referral.get("assigned_specialist_id") != principal.subject:
        raise HTTPException(status_code=403, detail="This referral is not assigned to your specialist account.")
    return referral


async def update_referral_status(database: Any, referral_id: str, payload: ReferralStatusUpdate, principal: Principal) -> dict:
    referral = await _referral_for_access(database, referral_id, principal)
    if principal.role == "specialist" and payload.status not in {ReferralStatus.ACCEPTED, ReferralStatus.IN_PROGRESS, ReferralStatus.COMPLETED}:
        raise HTTPException(status_code=403, detail="Specialists can only accept, progress, or complete assigned referrals.")
    updated = await database.referrals.find_one_and_update(
        {"_id": referral["_id"]}, {"$set": {"status": payload.status.value, "updated_at": utc_now()}}, return_document=True
    )
    await record_event(database, principal, "REFERRAL_STATUS_UPDATED", referral["id"], "Referral status updated.", referral["patient_id"], referral["visit_id"])
    return serialize(updated or referral)


async def save_specialist_consultation(database: Any, referral_id: str, payload: SpecialistConsultationUpsert, principal: Principal) -> dict:
    referral = await _referral_for_access(database, referral_id, principal)
    now = utc_now()
    values = payload.model_dump(mode="json")
    existing = await database.specialist_consultations.find_one({"referral_id": referral["id"], "clinician_id": principal.subject})
    if existing:
        values["updated_at"] = now
        consultation = await database.specialist_consultations.find_one_and_update({"_id": existing["_id"]}, {"$set": values}, return_document=True)
        action = "SPECIALIST_CONSULTATION_UPDATED"
    else:
        consultation = {
            "_id": str(uuid4()), "id": f"SPC-{uuid4().hex[:12].upper()}", "referral_id": referral["id"],
            "patient_id": referral["patient_id"], "visit_id": referral["visit_id"], "clinician_id": principal.subject,
            "specialty": referral["destination_specialty"], **values, "created_at": now, "updated_at": now,
        }
        await database.specialist_consultations.insert_one(consultation)
        action = "SPECIALIST_CONSULTATION_CREATED"
    await database.referrals.update_one({"_id": referral["_id"]}, {"$set": {"status": ReferralStatus.COMPLETED.value, "updated_at": now}})
    await record_event(database, principal, action, consultation["id"], "Specialist consultation recorded.", referral["patient_id"], referral["visit_id"])
    return serialize(consultation)


async def get_specialist_consultations(database: Any, referral_id: str, principal: Principal) -> dict:
    referral = await _referral_for_access(database, referral_id, principal)
    records = await database.specialist_consultations.find({"referral_id": referral["id"]}).sort("created_at", -1).to_list(length=50)
    return {"items": [serialize(record) for record in records]}


async def create_prescription(database: Any, visit_id: str, payload: PrescriptionCreate, principal: Principal) -> dict:
    visit = await _visit(database, visit_id)
    now = utc_now()
    prescription = {
        "_id": str(uuid4()), "id": f"RX-{uuid4().hex[:12].upper()}", "patient_id": visit["patient_id"], "visit_id": visit["id"],
        "prescribing_clinician_id": principal.subject, "items": [item.model_dump(mode="json") for item in payload.items],
        "pharmacy_id": payload.pharmacy_id, "clinical_notes": payload.clinical_notes, "expires_on": payload.expires_on.isoformat() if payload.expires_on else None,
        "status": PrescriptionStatus.DRAFT.value, "created_at": now, "updated_at": now, "authorized_at": None, "authorized_by": None, "dispenses": [],
    }
    await database.prescriptions.insert_one(prescription)
    await record_event(database, principal, "PRESCRIPTION_CREATED", prescription["id"], "Prescription draft created.", visit["patient_id"], visit["id"])
    return serialize(prescription)


async def authorize_prescription(database: Any, prescription_id: str, principal: Principal) -> dict:
    prescription = await database.prescriptions.find_one({"$or": [{"id": prescription_id}, {"_id": prescription_id}]})
    if prescription is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    if prescription["status"] != PrescriptionStatus.DRAFT.value:
        raise HTTPException(status_code=409, detail="Only a draft prescription can be authorized.")
    now = utc_now()
    updated = await database.prescriptions.find_one_and_update(
        {"_id": prescription["_id"], "status": PrescriptionStatus.DRAFT.value},
        {"$set": {"status": PrescriptionStatus.AUTHORIZED.value, "authorized_at": now, "authorized_by": principal.subject, "updated_at": now}}, return_document=True,
    )
    if updated is None:
        raise HTTPException(status_code=409, detail="Prescription status changed; reload and retry.")
    await record_event(database, principal, "PRESCRIPTION_AUTHORIZED", prescription["id"], "Prescription authorized for dispensing.", prescription["patient_id"], prescription["visit_id"])
    return serialize(updated)


async def list_prescriptions(database: Any, patient_id: str | None = None) -> dict:
    query: dict[str, Any] = {}
    if patient_id:
        patient = await PatientRepository(database.patients).by_identifier(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found.")
        query["patient_id"] = patient["id"]
    records = await database.prescriptions.find(query).sort("created_at", -1).to_list(length=200)
    return {"items": [serialize(record) for record in records]}


def pharmacy_prescription(prescription: dict) -> dict:
    return {key: prescription.get(key) for key in ("id","patient_id","visit_id","pharmacy_id","prescribing_clinician_id","items","clinical_notes", "status", "created_at", "updated_at", "expires_on", "authorized_at", "dispenses")}


async def list_pharmacy_prescriptions(database: Any, principal: Principal) -> dict:
    records = await database.prescriptions.find({"pharmacy_id": principal.subject, "status": {"$in": [PrescriptionStatus.AUTHORIZED.value, PrescriptionStatus.PARTIALLY_DISPENSED.value]}}).sort("authorized_at", 1).to_list(length=200)
    return {"items": [pharmacy_prescription(record) for record in records]}


async def dispense_prescription(database: Any, prescription_id: str, payload: PrescriptionDispense, principal: Principal) -> dict:
    prescription = await database.prescriptions.find_one({"$or": [{"id": prescription_id}, {"_id": prescription_id}]})
    if prescription is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    if prescription.get("pharmacy_id") != principal.subject:
        raise HTTPException(status_code=403, detail="This prescription is not assigned to your pharmacy account.")
    if prescription["status"] not in {PrescriptionStatus.AUTHORIZED.value, PrescriptionStatus.PARTIALLY_DISPENSED.value}:
        raise HTTPException(status_code=409, detail="This prescription is not available for dispensing.")
    available = {item["medication_name"]: item["quantity"] for item in prescription["items"]}
    if any(item.medication_name not in available or item.quantity > available[item.medication_name] for item in payload.items):
        raise HTTPException(status_code=422, detail="Dispensed items must match the authorized prescription quantities.")
    now = utc_now()
    dispense = {"pharmacy_id": principal.subject, "items": [item.model_dump(mode="json") for item in payload.items], "dispensed_at": now}
    complete = {item.medication_name for item in payload.items} == set(available) and all(item.quantity == available[item.medication_name] for item in payload.items)
    status = PrescriptionStatus.DISPENSED.value if complete else PrescriptionStatus.PARTIALLY_DISPENSED.value
    updated = await database.prescriptions.find_one_and_update({"_id": prescription["_id"]}, {"$set": {"status": status, "updated_at": now}, "$addToSet": {"dispenses": dispense}}, return_document=True)
    await record_event(database, principal, "PRESCRIPTION_DISPENSED", prescription["id"], "Prescription dispensing action recorded.", prescription["patient_id"], prescription["visit_id"])
    return pharmacy_prescription(updated or prescription)


async def create_follow_up(database: Any, visit_id: str, payload: FollowUpCreate, principal: Principal) -> dict:
    visit = await _visit(database, visit_id)
    duplicate = await database.follow_ups.find_one({"visit_id": visit["id"], "reason": payload.reason, "due_date": payload.due_date.isoformat(), "status": {"$in": [FollowUpStatus.SCHEDULED.value, FollowUpStatus.DUE.value]}})
    if duplicate:
        raise HTTPException(status_code=409, detail="An active matching follow-up already exists for this visit.")
    now = utc_now()
    follow_up = {"_id": str(uuid4()), "id": f"FUP-{uuid4().hex[:12].upper()}", "patient_id": visit["patient_id"], "visit_id": visit["id"], "responsible_clinician_id": principal.subject, **payload.model_dump(mode="json"), "due_date": payload.due_date.isoformat(), "status": FollowUpStatus.SCHEDULED.value, "created_at": now, "updated_at": now, "status_history": [{"status": FollowUpStatus.SCHEDULED.value, "changed_at": now, "actor_id": principal.subject}]}
    await database.follow_ups.insert_one(follow_up)
    await record_event(database, principal, "FOLLOW_UP_CREATED", follow_up["id"], "Follow-up scheduled.", visit["patient_id"], visit["id"])
    return serialize(follow_up)


async def list_follow_ups(database: Any, patient_id: str | None = None) -> dict:
    query: dict[str, Any] = {}
    if patient_id:
        patient = await PatientRepository(database.patients).by_identifier(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found.")
        query["patient_id"] = patient["id"]
    records = await database.follow_ups.find(query).sort("due_date", 1).to_list(length=200)
    return {"items": [serialize(record) for record in records]}


async def update_follow_up(database: Any, follow_up_id: str, payload: FollowUpUpdate, principal: Principal) -> dict:
    follow_up = await database.follow_ups.find_one({"$or": [{"id": follow_up_id}, {"_id": follow_up_id}]})
    if follow_up is None:
        raise HTTPException(status_code=404, detail="Follow-up not found.")
    now = utc_now()
    values: dict[str, Any] = {"status": payload.status.value, "updated_at": now}
    if payload.notes is not None:
        values["notes"] = payload.notes
    updated = await database.follow_ups.find_one_and_update({"_id": follow_up["_id"]}, {"$set": values, "$addToSet": {"status_history": {"status": payload.status.value, "changed_at": now, "actor_id": principal.subject}}}, return_document=True)
    await record_event(database, principal, "FOLLOW_UP_STATUS_UPDATED", follow_up["id"], "Follow-up status updated.", follow_up["patient_id"], follow_up["visit_id"])
    return serialize(updated or follow_up)
