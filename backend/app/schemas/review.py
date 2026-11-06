from enum import StrEnum

from pydantic import Field, model_validator

from app.schemas.common import ApiModel


class ReviewDecision(StrEnum):
    APPROVE = "APPROVE"
    MODIFY = "MODIFY"
    OVERRIDE = "OVERRIDE"


class ClinicalPriority(StrEnum):
    URGENT = "URGENT"
    HIGH = "HIGH"
    STANDARD = "STANDARD"
    LOW = "LOW"


class DoctorReviewCreate(ApiModel):
    decision: ReviewDecision
    comment: str | None = Field(default=None, max_length=5000)
    final_priority: ClinicalPriority
    final_destination: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def require_reason_for_change(self):
        if self.decision in {ReviewDecision.MODIFY, ReviewDecision.OVERRIDE} and not (self.comment or "").strip():
            raise ValueError("A reason is required to modify or override an assessment.")
        return self
