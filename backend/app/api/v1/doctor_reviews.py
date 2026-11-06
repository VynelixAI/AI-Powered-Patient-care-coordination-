from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import Principal, current_principal, require_roles
from app.db.mongodb import get_database
from app.schemas.review import DoctorReviewCreate
from app.services.review_service import get_review, list_pending_reviews, review_assessment

router = APIRouter(tags=["Doctor Reviews"])
Database = Annotated[Any, Depends(get_database)]


@router.get("/doctor-reviews/pending")
async def pending_reviews(
    database: Database,
    _: Principal = Depends(current_principal),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    return await list_pending_reviews(database, page, page_size)


@router.post("/assessments/{assessment_id}/review", status_code=201)
async def assessment_review(
    assessment_id: str,
    payload: DoctorReviewCreate,
    database: Database,
    principal: Annotated[Principal, Depends(require_roles("clinician", "administrator"))],
):
    return await review_assessment(database, assessment_id, payload, principal)


@router.get("/assessments/{assessment_id}/review")
async def assessment_review_get(
    assessment_id: str, database: Database, _: Principal = Depends(current_principal)
):
    return await get_review(database, assessment_id)
