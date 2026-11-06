import logging
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from pymongo.errors import PyMongoError

from app.core.config import Settings
from app.core.security import Principal
from app.repositories.visit_repository import VisitRepository
from app.schemas.document import DocumentCategory
from app.services.audit_service import record_event
from app.services.storage_service import LocalStorage
from app.utils.dates import utc_now
from app.utils.file_validation import read_and_validate_upload

EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
logger = logging.getLogger(__name__)


def public_document(document: dict) -> dict:
    item = dict(document)
    item.pop("_id", None)
    item.pop("storage_reference", None)
    return item


async def upload_document(
    database: Any,
    settings: Settings,
    visit_id: str,
    file: UploadFile,
    category: DocumentCategory,
    principal: Principal,
) -> dict:
    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    contents = await read_and_validate_upload(file, settings.max_upload_bytes)
    reference = await LocalStorage(settings.upload_directory).store(contents, EXTENSIONS[file.content_type])
    original_filename = (file.filename or "uploaded-document").replace("\\", "/").split("/")[-1]
    document = {
        "_id": str(uuid4()),
        "id": f"DOC-{uuid4().hex[:12].upper()}",
        "patient_id": visit["patient_id"],
        "visit_id": visit["id"],
        "original_filename": (original_filename or "uploaded-document")[:255],
        "content_type": file.content_type,
        "file_size": len(contents),
        "storage_reference": reference,
        "uploaded_at": utc_now(),
        "category": category.value,
        "processing_status": "NOT_PROCESSED",
        "extraction_status": "NOT_PROCESSED",
        "extraction_errors": [],
        "extracted_findings": [],
    }
    inserted = False
    try:
        await database.documents.insert_one(document)
        inserted = True
        await database.visits.update_one({"_id": visit["_id"]}, {"$addToSet": {"document_ids": document["id"]}})
        await record_event(
            database, principal, "DOCUMENT_UPLOADED", document["id"], "Medical document metadata uploaded.",
            visit["patient_id"], visit["id"],
        )
    except (PyMongoError, OSError):
        try:
            if inserted:
                await database.documents.delete_one({"_id": document["_id"]})
                await database.visits.update_one(
                    {"_id": visit["_id"]}, {"$pull": {"document_ids": document["id"]}}
                )
        except PyMongoError:
            logger.exception("Unable to roll back failed document metadata write.")
        try:
            (settings.upload_directory.resolve() / reference).unlink(missing_ok=True)
        except OSError:
            logger.exception("Unable to clean up a failed document upload.")
        raise
    return public_document(document)


async def get_document_for_download(database: Any, settings: Settings, document_id: str) -> tuple[dict, Path]:
    document = await database.documents.find_one({"id": document_id})
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    try:
        path = await LocalStorage(settings.upload_directory).read(document["storage_reference"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Stored document file was not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Stored document reference is invalid.") from exc
    return public_document(document), path
