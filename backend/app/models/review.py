from datetime import datetime
from typing import TypedDict


class DoctorReviewDocument(TypedDict, total=False):
    _id: str
    id: str
    assessment_id: str
    patient_id: str
    visit_id: str
    decision: str
    clinician_id: str
    final_priority: str
    final_destination: str | None
    reviewed_at: datetime
