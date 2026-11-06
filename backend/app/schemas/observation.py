from datetime import datetime
from datetime import timezone

from pydantic import Field, field_validator

from app.schemas.common import ApiModel


class ObservationCreate(ApiModel):
    measurement_type: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=120)
    unit: str = Field(min_length=1, max_length=40)
    recorded_at: datetime | None = None
    source_record_id: str | None = Field(default=None, max_length=120)
    reference_range: str | None = Field(default=None, max_length=120)
    verification_status: str = Field(default="UNVERIFIED", pattern="^(UNVERIFIED|VERIFIED)$")

    @field_validator("recorded_at")
    @classmethod
    def require_utc_offset(cls, value: datetime | None) -> datetime | None:
        if value is not None:
            if value.tzinfo is None or value.utcoffset() is None:
                raise ValueError("recorded_at must include a timezone offset.")
            return value.astimezone(timezone.utc)
        return value
