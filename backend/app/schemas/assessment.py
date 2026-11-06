from enum import StrEnum

from pydantic import Field

from app.schemas.common import ApiModel


class AssessmentStatus(StrEnum):
    PENDING_DOCTOR_REVIEW = "PENDING_DOCTOR_REVIEW"
    REVIEWED = "REVIEWED"


class AssessmentCreate(ApiModel):
    pass


class AssessmentResult(ApiModel):
    id: str
    patient_id: str
    visit_id: str
    current_problem_summary: str
    relevant_historical_context: list[str]
    current_findings: list[str]
    historical_comparisons: list[dict]
    potential_risk_indicators: list[str]
    missing_or_uncertain_information: list[str]
    priority_recommendation: str
    urgency_recommendation: str
    suggested_care_pathway: str
    evidence_references: list[dict]
    assessment_method: str
    assessment_version: str
    status: AssessmentStatus
    created_at: str
