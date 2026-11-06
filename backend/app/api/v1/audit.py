from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import Principal, current_principal
from app.db.mongodb import get_database
from app.services.patient_service import get_patient

router = APIRouter(tags=["Audit"])
Database = Annotated[Any, Depends(get_database)]


@router.get("/audit")
async def workspace_audit(
    database: Database,
    _: Principal = Depends(current_principal),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    total = await database.audit_logs.count_documents({})
    events = await database.audit_logs.find({}).sort("timestamp", -1).skip(
        (page - 1) * page_size
    ).limit(page_size).to_list(length=page_size)
    for event in events:
        event.pop("_id", None)
    return {"items": events, "page": page, "page_size": page_size, "total": total}


@router.get("/patients/{patient_id}/audit")
async def patient_audit(
    patient_id: str,
    database: Database,
    _: Principal = Depends(current_principal),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    patient = await get_patient(database, patient_id)
    query = {"patient_id": patient["id"]}
    total = await database.audit_logs.count_documents(query)
    events = await database.audit_logs.find(query).sort("timestamp", -1).skip(
        (page - 1) * page_size
    ).limit(page_size).to_list(length=page_size)
    for event in events:
        event.pop("_id", None)
    return {"items": events, "page": page, "page_size": page_size, "total": total}
