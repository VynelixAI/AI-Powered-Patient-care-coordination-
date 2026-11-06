from datetime import datetime
from typing import TypedDict


class AuditDocument(TypedDict, total=False):
    _id: str
    id: str
    patient_id: str | None
    visit_id: str | None
    actor_id: str
    actor_role: str
    action: str
    timestamp: datetime
    resource_reference: str
    safe_summary: str
