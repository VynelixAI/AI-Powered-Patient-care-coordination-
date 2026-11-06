from fastapi import HTTPException, UploadFile

ALLOWED_SIGNATURES = {
    "application/pdf": (b"%PDF-",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}


async def read_and_validate_upload(file: UploadFile, max_bytes: int) -> bytes:
    if file.content_type not in ALLOWED_SIGNATURES:
        raise HTTPException(status_code=415, detail="Only PDF, JPEG, PNG, and WebP files are accepted.")
    contents = await file.read(max_bytes + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Files must not exceed {max_bytes} bytes.")
    signatures = ALLOWED_SIGNATURES[file.content_type]
    valid_signature = any(contents.startswith(signature) for signature in signatures)
    if file.content_type == "image/webp":
        valid_signature = valid_signature and contents[8:12] == b"WEBP"
    if not valid_signature:
        raise HTTPException(status_code=415, detail="The file contents do not match the declared content type.")
    return contents
