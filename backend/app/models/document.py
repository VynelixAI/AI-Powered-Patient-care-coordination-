from datetime import datetime
from typing import TypedDict


class MedicalDocument(TypedDict, total=False):
    _id: str
    id: str
    patient_id: str
    visit_id: str
    original_filename: str
    content_type: str
    file_size: int
    storage_reference: str
    uploaded_at: datetime
    category: str
    processing_status: str
    extraction_status: str
    extracted_findings: list[str]
