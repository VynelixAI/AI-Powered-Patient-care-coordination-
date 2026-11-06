from datetime import date, datetime
from typing import TypedDict


class PatientDocument(TypedDict, total=False):
    _id: str
    id: str
    hospital_patient_id: str
    name: str
    date_of_birth: date
    gender: str
    phone: str
    allergies: list[str]
    conditions: list[str]
    medications: list[str]
    medical_history: str
    created_at: datetime
    updated_at: datetime
