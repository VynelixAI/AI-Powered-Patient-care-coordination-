from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import Principal, current_principal, require_roles
from app.db.mongodb import get_database
from app.schemas.clinical_workflow import ClinicalDecisionUpsert, ReferralCreate, ReferralStatusUpdate, SpecialistConsultationUpsert
from app.services.clinical_workflow_service import (create_referral, get_specialist_consultations, list_clinical_decisions, list_referrals, save_clinical_decision, save_specialist_consultation, update_referral_status)

router = APIRouter(tags=["Manual Clinical Workflow"])
Database = Annotated[Any, Depends(get_database)]
ClinicalPrincipal = Annotated[Principal, Depends(require_roles("clinician", "specialist", "administrator"))]


@router.put("/visits/{visit_id}/clinical-decision")
async def clinical_decision_save(visit_id: str, payload: ClinicalDecisionUpsert, database: Database, principal: ClinicalPrincipal):
    return await save_clinical_decision(database, visit_id, payload, principal)


@router.get("/visits/{visit_id}/clinical-decisions")
async def clinical_decision_list(visit_id: str, database: Database, _: ClinicalPrincipal):
    return await list_clinical_decisions(database, visit_id)


@router.post("/visits/{visit_id}/referrals", status_code=201)
async def referral_create(visit_id: str, payload: ReferralCreate, database: Database, principal: Annotated[Principal, Depends(require_roles("clinician", "administrator"))]):
    return await create_referral(database, visit_id, payload, principal)


@router.get("/referrals")
async def referral_list(database: Database, principal: ClinicalPrincipal, patient_id: str | None = Query(default=None)):
    return await list_referrals(database, principal, patient_id)


@router.patch("/referrals/{referral_id}")
async def referral_status_update(referral_id: str, payload: ReferralStatusUpdate, database: Database, principal: ClinicalPrincipal):
    return await update_referral_status(database, referral_id, payload, principal)


@router.put("/referrals/{referral_id}/specialist-consultation")
async def specialist_consultation_save(referral_id: str, payload: SpecialistConsultationUpsert, database: Database, principal: ClinicalPrincipal):
    return await save_specialist_consultation(database, referral_id, payload, principal)


@router.get("/referrals/{referral_id}/specialist-consultations")
async def specialist_consultation_list(referral_id: str, database: Database, principal: ClinicalPrincipal):
    return await get_specialist_consultations(database, referral_id, principal)
