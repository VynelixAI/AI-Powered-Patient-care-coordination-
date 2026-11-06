from datetime import datetime
from enum import StrEnum

from pydantic import Field, model_validator

from app.schemas.common import ApiModel


class VisitStatus(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    AWAITING_REVIEW = "AWAITING_REVIEW"
    ROUTED = "ROUTED"
    COMPLETED = "COMPLETED"


class VisitCreate(ApiModel):
    presenting_complaint: str | None = Field(default=None, max_length=500)
    presenting_symptoms: str = Field(min_length=1, max_length=5000)
    symptom_onset: str | None = Field(default=None, max_length=200)
    symptom_duration: str | None = Field(default=None, max_length=200)
    current_medications: list[str] = Field(default_factory=list, max_length=100)
    medication_changes: str | None = Field(default=None, max_length=2000)
    clinician_notes: str = Field(default="", max_length=10000)


class VisitUpdate(ApiModel):
    presenting_complaint: str | None = Field(default=None, max_length=500)
    presenting_symptoms: str | None = Field(default=None, max_length=5000)
    symptom_onset: str | None = Field(default=None, max_length=200)
    symptom_duration: str | None = Field(default=None, max_length=200)
    current_medications: list[str] | None = Field(default=None, max_length=100)
    medication_changes: str | None = Field(default=None, max_length=2000)
    clinician_notes: str | None = Field(default=None, max_length=10000)
    clinician_recorded_diagnoses: list[str] | None = Field(default=None, max_length=100)
    status: VisitStatus | None = None
    final_outcome: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def route_state_is_workflow_managed(self):
        if self.status == VisitStatus.ROUTED:
            raise ValueError("Visit status ROUTED is set only by the clinician-approved routing workflow.")
        return self


class VisitConsultationUpdate(ApiModel):
    examination_findings: str = Field(max_length=10000)
    consultation_notes: str = Field(max_length=10000)


class VisitVital(ApiModel):
    measurement_type: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=120)
    unit: str = Field(min_length=1, max_length=40)
    recorded_at: datetime | None = None
