from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import Principal, require_roles
from app.db.mongodb import get_database
from app.schemas.clinical_workflow import PrescriptionCreate, PrescriptionDispense
from app.services.clinical_workflow_service import (authorize_prescription, create_prescription, dispense_prescription, list_pharmacy_prescriptions, list_prescriptions)

router = APIRouter(tags=["Prescriptions and Pharmacy"])
Database = Annotated[Any, Depends(get_database)]


@router.post("/visits/{visit_id}/prescriptions", status_code=201)
async def prescription_create(visit_id: str, payload: PrescriptionCreate, database: Database, principal: Annotated[Principal, Depends(require_roles("clinician", "specialist", "administrator"))]):
    return await create_prescription(database, visit_id, payload, principal)


@router.post("/prescriptions/{prescription_id}/authorize")
async def prescription_authorize(prescription_id: str, database: Database, principal: Annotated[Principal, Depends(require_roles("clinician", "administrator"))]):
    return await authorize_prescription(database, prescription_id, principal)


@router.get("/prescriptions")
async def prescription_list(database: Database, _: Annotated[Principal, Depends(require_roles("triage_staff", "clinician", "specialist", "administrator"))], patient_id: str | None = Query(default=None)):
    return await list_prescriptions(database, patient_id)


@router.get("/pharmacy/prescriptions")
async def pharmacy_prescription_list(database: Database, principal: Annotated[Principal, Depends(require_roles("pharmacy"))]):
    return await list_pharmacy_prescriptions(database, principal)


@router.post("/pharmacy/prescriptions/{prescription_id}/dispense")
async def prescription_dispense(prescription_id: str, payload: PrescriptionDispense, database: Database, principal: Annotated[Principal, Depends(require_roles("pharmacy"))]):
    return await dispense_prescription(database, prescription_id, payload, principal)
