from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import Principal, require_roles
from app.db.mongodb import get_database
from app.schemas.clinical_workflow import FollowUpCreate, FollowUpUpdate
from app.services.clinical_workflow_service import create_follow_up, list_follow_ups, update_follow_up

router = APIRouter(tags=["Follow-ups"])
Database = Annotated[Any, Depends(get_database)]
ClinicalPrincipal = Annotated[Principal, Depends(require_roles("triage_staff", "clinician", "specialist", "administrator"))]


@router.post("/visits/{visit_id}/follow-ups", status_code=201)
async def follow_up_create(visit_id: str, payload: FollowUpCreate, database: Database, principal: ClinicalPrincipal):
    return await create_follow_up(database, visit_id, payload, principal)


@router.get("/follow-ups")
async def follow_up_list(database: Database, _: ClinicalPrincipal, patient_id: str | None = Query(default=None)):
    return await list_follow_ups(database, patient_id)


@router.patch("/follow-ups/{follow_up_id}")
async def follow_up_update(follow_up_id: str, payload: FollowUpUpdate, database: Database, principal: ClinicalPrincipal):
    return await update_follow_up(database, follow_up_id, payload, principal)
