from enum import StrEnum

from pydantic import Field

from app.schemas.common import ApiModel


class Destination(StrEnum):
    EMERGENCY_DEPARTMENT = "Emergency Department"
    GENERAL_MEDICINE = "General Medicine"
    CARDIOLOGY = "Cardiology"
    RESPIRATORY_MEDICINE = "Respiratory Medicine"
    ENDOCRINOLOGY = "Endocrinology"
    GENERAL_PRACTICE = "General Practice"
    OTHER_SPECIALIST = "Other Specialist"


class RoutingCreate(ApiModel):
    destination: Destination
    assigned_clinician: str | None = Field(default=None, max_length=160)
