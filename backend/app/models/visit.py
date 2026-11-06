from datetime import datetime
from typing import TypedDict


class VisitDocument(TypedDict, total=False):
    _id: str
    id: str
    patient_id: str
    visit_number: int
    presenting_symptoms: str
    examination_findings: str
    consultation_notes: str
    status: str
    created_at: datetime
    document_ids: list[str]
    assessment_ids: list[str]
    doctor_review_ids: list[str]
    routing_id: str | None
    final_outcome: str | None
