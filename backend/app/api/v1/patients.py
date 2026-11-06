from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import Principal, current_principal, require_roles
from app.db.mongodb import get_database
from app.schemas.patient import PatientCreate, PatientUpdate
from app.services.audit_service import record_event
from app.services.history_service import get_patient_history
from app.services.patient_service import create_patient, get_patient, search_patients, update_patient
from app.services.visit_service import list_patient_visits

router = APIRouter(prefix="/patients", tags=["Patients"])
Database = Annotated[Any, Depends(get_database)]


@router.post("", status_code=201)
async def register_patient(
    payload: PatientCreate,
    database: Database,
    principal: Annotated[Principal, Depends(require_roles("triage_staff", "administrator"))],
):
    return await create_patient(database, payload, principal)


@router.get("/search")
async def search(
    database: Database,
    q: str | None = Query(default=None, min_length=1, max_length=160),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _: Principal = Depends(current_principal),
):
    return await search_patients(database, q, page, page_size)


@router.get("")
async def list_patients(
    database: Database,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _: Principal = Depends(current_principal),
):
    return await search_patients(database, None, page, page_size)


@router.get("/{patient_id}/visits")
async def patient_visits(
    patient_id: str,
    database: Database,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _: Principal = Depends(current_principal),
):
    return await list_patient_visits(database, patient_id, page, page_size)


@router.get("/{patient_id}/history")
async def patient_history(
    patient_id: str,
    database: Database,
    principal: Annotated[Principal, Depends(current_principal)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    history = await get_patient_history(database, patient_id, page, page_size)
    await record_event(
        database, principal, "PATIENT_HISTORY_RETRIEVED", history["patient"]["id"],
        "Patient history retrieved by an authenticated user.", history["patient"]["id"],
    )
    return history


@router.get("/{patient_id}")
async def patient_profile(
    patient_id: str,
    database: Database,
    _: Principal = Depends(current_principal),
):
    patient = await get_patient(database, patient_id)
    visits = await list_patient_visits(database, patient["id"], page=1, page_size=100)
    return {**patient, "visits": visits["items"]}


@router.patch("/{patient_id}")
async def patient_update(
    patient_id: str,
    payload: PatientUpdate,
    database: Database,
    principal: Annotated[Principal, Depends(require_roles("triage_staff", "administrator"))],
):
    return await update_patient(database, patient_id, payload, principal)
