from typing import Any
from uuid import uuid4

from app.core.security import Principal
from app.utils.dates import utc_now


async def record_event(
    database: Any,
    principal: Principal,
    action: str,
    resource_reference: str,
    safe_summary: str,
    patient_id: str | None = None,
    visit_id: str | None = None,
) -> dict:
    event = {
        "_id": str(uuid4()),
        "id": f"AUD-{uuid4().hex[:12].upper()}",
        "patient_id": patient_id,
        "visit_id": visit_id,
        "actor_id": principal.subject,
        "actor_role": principal.role,
        "action": action,
        "timestamp": utc_now(),
        "resource_reference": resource_reference,
        "safe_summary": safe_summary,
    }
    await database.audit_logs.insert_one(event)
    return event
