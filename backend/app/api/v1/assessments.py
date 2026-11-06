from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import Principal, current_principal, require_roles
from app.db.mongodb import get_database
from app.schemas.assessment import AssessmentCreate
from app.services.assessment_service import generate_assessment, get_assessment, list_visit_assessments

router = APIRouter(tags=["Assessments and Doctor Reviews"])
Database = Annotated[Any, Depends(get_database)]


@router.post("/visits/{visit_id}/assessments", status_code=201)
async def assessment_create(
    visit_id: str,
    payload: AssessmentCreate,
    database: Database,
    principal: Annotated[Principal, Depends(require_roles("clinician", "administrator"))],
):
    return await generate_assessment(database, visit_id, principal)


@router.get("/visits/{visit_id}/assessments")
async def visit_assessments(
    visit_id: str,
    database: Database,
    _: Principal = Depends(current_principal),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    return await list_visit_assessments(database, visit_id, page, page_size)


@router.get("/assessments/{assessment_id}")
async def assessment_get(assessment_id: str, database: Database, _: Principal = Depends(current_principal)):
    return await get_assessment(database, assessment_id)

