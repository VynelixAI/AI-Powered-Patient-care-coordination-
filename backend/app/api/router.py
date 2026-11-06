from fastapi import APIRouter

from app.api.v1 import (
    assessments,
    audit,
    clinical_workflow,
    documents,
    doctor_reviews,
    health,
    health_trends,
    patients,
    prescriptions,
    routing,
    follow_ups,
    visits,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(patients.router)
api_router.include_router(visits.router)
api_router.include_router(documents.router)
api_router.include_router(assessments.router)
api_router.include_router(doctor_reviews.router)
api_router.include_router(clinical_workflow.router)
api_router.include_router(prescriptions.router)
api_router.include_router(follow_ups.router)
api_router.include_router(health_trends.router)
api_router.include_router(routing.router)
api_router.include_router(audit.router)
