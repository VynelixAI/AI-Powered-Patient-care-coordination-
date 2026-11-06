from enum import StrEnum

from app.schemas.common import ApiModel


class DocumentCategory(StrEnum):
    REFERRAL = "REFERRAL"
    PATHOLOGY = "PATHOLOGY"
    IMAGING = "IMAGING"
    DISCHARGE_SUMMARY = "DISCHARGE_SUMMARY"
    OTHER = "OTHER"


class DocumentMetadata(ApiModel):
    category: DocumentCategory = DocumentCategory.OTHER


class DocumentRecord(ApiModel):
    id: str
    patient_id: str
    visit_id: str
    original_filename: str
    content_type: str
    file_size: int
    uploaded_at: str
    category: str
    processing_status: str
    extraction_status: str
    extracted_findings: list[str]
