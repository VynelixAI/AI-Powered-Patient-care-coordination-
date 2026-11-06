from datetime import datetime
from typing import TypedDict


class AssessmentDocument(TypedDict, total=False):
    _id: str
    id: str
    patient_id: str
    visit_id: str
    evidence_references: list[dict]
    status: str
    created_at: datetime
