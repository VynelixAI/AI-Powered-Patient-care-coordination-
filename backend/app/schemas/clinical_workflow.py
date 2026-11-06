from datetime import date
from enum import StrEnum

from pydantic import Field, model_validator

from app.schemas.common import ApiModel
from app.schemas.review import ClinicalPriority, ReviewDecision


class ReferralStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ClinicalDecisionUpsert(ApiModel):
    decision: ReviewDecision
    final_priority: ClinicalPriority
    final_destination: str = Field(min_length=1, max_length=120)
    rationale: str | None = Field(default=None, max_length=5000)
    clinical_impression: str | None = Field(default=None, max_length=3000)
    treatment_plan: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def require_rationale_for_change(self):
        if self.decision in {ReviewDecision.MODIFY, ReviewDecision.OVERRIDE} and not (self.rationale or "").strip():
            raise ValueError("A rationale is required to modify or override a decision.")
        return self


class ReferralCreate(ApiModel):
    destination_specialty: str = Field(min_length=1, max_length=120)
    reason: str = Field(min_length=1, max_length=3000)
    clinical_summary: str | None = Field(default=None, max_length=5000)
    priority: ClinicalPriority
    assigned_specialist_id: str | None = Field(default=None, min_length=1, max_length=160)


class ReferralStatusUpdate(ApiModel):
    status: ReferralStatus


class SpecialistConsultationUpsert(ApiModel):
    examination_findings: str = Field(max_length=10000)
    consultation_notes: str = Field(max_length=10000)
    clinical_impression: str | None = Field(default=None, max_length=3000)
    recommendations: str | None = Field(default=None, max_length=5000)
    follow_up_instructions: str | None = Field(default=None, max_length=3000)


class PrescriptionStatus(StrEnum):
    DRAFT = "DRAFT"
    AUTHORIZED = "AUTHORIZED"
    PARTIALLY_DISPENSED = "PARTIALLY_DISPENSED"
    DISPENSED = "DISPENSED"
    CANCELLED = "CANCELLED"


class PrescriptionItem(ApiModel):
    medication_name: str = Field(min_length=1, max_length=160)
    strength: str = Field(min_length=1, max_length=80)
    dosage: str = Field(min_length=1, max_length=160)
    route: str = Field(min_length=1, max_length=80)
    frequency: str = Field(min_length=1, max_length=120)
    duration: str | None = Field(default=None, max_length=120)
    quantity: int = Field(ge=1, le=10000)
    instructions: str | None = Field(default=None, max_length=1000)
    refills: int = Field(default=0, ge=0, le=20)


class PrescriptionCreate(ApiModel):
    pharmacy_id: str = Field(min_length=1, max_length=160)
    items: list[PrescriptionItem] = Field(min_length=1, max_length=50)
    expires_on: date | None = None
    clinical_notes: str | None = Field(default=None, max_length=3000)


class DispenseItem(ApiModel):
    medication_name: str = Field(min_length=1, max_length=160)
    quantity: int = Field(ge=1, le=10000)


class PrescriptionDispense(ApiModel):
    items: list[DispenseItem] = Field(min_length=1, max_length=50)


class FollowUpStatus(StrEnum):
    SCHEDULED = "SCHEDULED"
    DUE = "DUE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class FollowUpCreate(ApiModel):
    reason: str = Field(min_length=1, max_length=3000)
    due_date: date
    notes: str | None = Field(default=None, max_length=3000)
    referral_id: str | None = Field(default=None, max_length=80)
    prescription_id: str | None = Field(default=None, max_length=80)


class FollowUpUpdate(ApiModel):
    status: FollowUpStatus
    notes: str | None = Field(default=None, max_length=3000)
