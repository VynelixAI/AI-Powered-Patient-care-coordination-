from datetime import datetime
from typing import TypedDict


class ObservationDocument(TypedDict, total=False):
    _id: str
    id: str
    patient_id: str
    visit_id: str
    measurement_type: str
    value: str
    unit: str
    recorded_at: datetime
    verification_status: str
