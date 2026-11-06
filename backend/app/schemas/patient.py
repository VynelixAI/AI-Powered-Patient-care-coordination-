from datetime import date

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import ApiModel


class PatientCreate(ApiModel):
    name: str = Field(min_length=1, max_length=160)
    date_of_birth: date
    gender: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=8, max_length=40)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=300)
    emergency_contact: str | None = Field(default=None, max_length=160)
    allergies: list[str] = Field(default_factory=list, max_length=50)
    conditions: list[str] = Field(default_factory=list, max_length=100)
    medications: list[str] = Field(default_factory=list, max_length=100)
    medical_history: str = Field(default="", max_length=5000)

    @field_validator("date_of_birth")
    @classmethod
    def dob_not_in_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        return value


class PatientUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, min_length=1, max_length=80)
    phone: str | None = Field(default=None, min_length=8, max_length=40)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=300)
    emergency_contact: str | None = Field(default=None, max_length=160)
    allergies: list[str] | None = Field(default=None, max_length=50)
    conditions: list[str] | None = Field(default=None, max_length=100)
    medications: list[str] | None = Field(default=None, max_length=100)
    medical_history: str | None = Field(default=None, max_length=5000)

    @field_validator("date_of_birth")
    @classmethod
    def dob_not_in_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        return value
