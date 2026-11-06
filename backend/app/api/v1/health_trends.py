from datetime import datetime
from datetime import timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import Principal, current_principal, require_roles
from app.db.mongodb import get_database
from app.schemas.observation import ObservationCreate
from app.services.observation_service import create_observation, get_patient_trends, list_visit_observations

router = APIRouter(tags=["Health Trends"])
Database = Annotated[Any, Depends(get_database)]


@router.post("/visits/{visit_id}/observations", status_code=201)
async def observation_create(
    visit_id: str,
    payload: ObservationCreate,
    database: Database,
    principal: Annotated[Principal, Depends(require_roles("triage_staff", "clinician", "administrator"))],
):
    if payload.verification_status == "VERIFIED" and principal.role not in {"clinician", "administrator"}:
        raise HTTPException(status_code=403, detail="Only a clinician or administrator can verify an observation.")
    return await create_observation(database, visit_id, payload, principal)


@router.get("/visits/{visit_id}/observations")
async def visit_observations(
    visit_id: str,
    database: Database,
    _: Principal = Depends(current_principal),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
):
    return await list_visit_observations(database, visit_id, page, page_size)


@router.get("/patients/{patient_id}/health-trends")
async def patient_trends(
    patient_id: str,
    database: Database,
    _: Principal = Depends(current_principal),
    measurement_type: str | None = Query(default=None, max_length=80),
    start: datetime | None = None,
    end: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
):
    if start and end and start > end:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail="start must be earlier than or equal to end.")
    if (start and (start.tzinfo is None or start.utcoffset() is None)) or (
        end and (end.tzinfo is None or end.utcoffset() is None)
    ):
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail="start and end must include a timezone offset.")
    if start is not None:
        start = start.astimezone(timezone.utc)
    if end is not None:
        end = end.astimezone(timezone.utc)
    return await get_patient_trends(database, patient_id, measurement_type, start, end, page, page_size)
