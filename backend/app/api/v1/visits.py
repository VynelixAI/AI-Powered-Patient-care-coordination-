from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import Principal, current_principal, require_roles
from app.db.mongodb import get_database
from app.schemas.visit import VisitConsultationUpdate, VisitCreate, VisitStatus, VisitUpdate
from app.services.history_service import get_current_visit_context
from app.services.patient_service import get_patient
from app.services.visit_service import create_visit, get_visit, list_patient_visits, list_visits, save_consultation, update_visit

router = APIRouter(tags=["Visits"])
Database = Annotated[Any, Depends(get_database)]


@router.post("/patients/{patient_id}/visits", status_code=201)
async def visit_create(
    patient_id: str,
    payload: VisitCreate,
    database: Database,
    principal: Annotated[Principal, Depends(require_roles("triage_staff", "clinician", "administrator"))],
):
    return await create_visit(database, patient_id, payload, principal)


@router.get("/visits")
async def visit_list(
    database: Database,
    _: Principal = Depends(current_principal),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    patient_id: str | None = Query(default=None, min_length=1, max_length=80),
    status: VisitStatus | None = None,
    q: str | None = Query(default=None, min_length=1, max_length=160),
):
    return await list_visits(database, page, page_size, patient_id, status, q)


@router.get("/visits/{visit_id}")
async def visit_get(visit_id: str, database: Database, _: Principal = Depends(current_principal)):
    return await get_visit(database, visit_id)


@router.patch("/visits/{visit_id}")
async def visit_patch(
    visit_id: str,
    payload: VisitUpdate,
    database: Database,
    principal: Annotated[Principal, Depends(require_roles("clinician", "administrator"))],
):
    return await update_visit(database, visit_id, payload, principal)


@router.put("/visits/{visit_id}/consultation")
async def visit_consultation_update(
    visit_id: str,
    payload: VisitConsultationUpdate,
    database: Database,
    principal: Annotated[Principal, Depends(require_roles("clinician", "administrator"))],
):
    return await save_consultation(database, visit_id, payload, principal)


@router.get("/visits/{visit_id}/timeline")
async def visit_timeline(visit_id: str, database: Database, _: Principal = Depends(current_principal)):
    current = await get_current_visit_context(database, visit_id)
    visit = await get_visit(database, visit_id)
    return {"visit": visit, "documents": current["documents"], "observations": current["observations"]}
