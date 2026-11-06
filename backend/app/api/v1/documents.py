from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app.core.config import Settings, get_settings
from app.core.security import Principal, current_principal, require_roles
from app.db.mongodb import get_database
from app.repositories.base import Repository
from app.repositories.patient_repository import PatientRepository
from app.repositories.visit_repository import VisitRepository
from app.schemas.document import DocumentCategory
from app.services.document_service import get_document_for_download, public_document, upload_document

router = APIRouter(tags=["Documents"])
Database = Annotated[Any, Depends(get_database)]


@router.get("/patients/{patient_id}/documents")
async def patient_documents(
    patient_id: str,
    database: Database,
    _: Principal = Depends(current_principal),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    patient = await PatientRepository(database.patients).by_identifier(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    query = {"patient_id": patient["id"]}
    total = await database.documents.count_documents(query)
    documents = await database.documents.find(query).sort("uploaded_at", -1).skip(
        (page - 1) * page_size
    ).limit(page_size).to_list(length=page_size)
    return {
        "items": [public_document(item) for item in documents],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("/visits/{visit_id}/documents", status_code=201)
async def document_upload(
    visit_id: str,
    database: Database,
    file: Annotated[UploadFile, File()],
    category: Annotated[DocumentCategory, Form()] = DocumentCategory.OTHER,
    settings: Settings = Depends(get_settings),
    principal: Principal = Depends(require_roles("triage_staff", "clinician", "administrator")),
):
    return await upload_document(database, settings, visit_id, file, category, principal)


@router.get("/visits/{visit_id}/documents")
async def visit_documents(
    visit_id: str,
    database: Database,
    _: Principal = Depends(current_principal),
    page: int = 1,
    page_size: int = 25,
):
    from fastapi import HTTPException

    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(status_code=422, detail="page must be positive and page_size must be between 1 and 100.")
    visit = await VisitRepository(database.visits).by_identifier(visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found.")
    repository = Repository(database.documents)
    query = {"visit_id": visit["id"]}
    total = await repository.count(query)
    documents = await repository.find_many(query, (page - 1) * page_size, page_size)
    return {
        "items": [public_document(item) for item in documents],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/documents/{document_id}/download")
async def document_download(
    document_id: str,
    database: Database,
    settings: Settings = Depends(get_settings),
    _: Principal = Depends(current_principal),
):
    document, path = await get_document_for_download(database, settings, document_id)
    return FileResponse(
        path,
        media_type=document["content_type"],
        filename=document["original_filename"],
        content_disposition_type="attachment",
    )
