def test_upload_validation_storage_and_download_auth(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "Document Example", "date_of_birth": "1980-01-01", "gender": "Female", "phone": "0412345678"},
        headers=headers(),
    ).json()
    visit = patient["visits"][0]
    endpoint = f"/api/v1/visits/{visit['id']}/documents"
    invalid = client.post(
        endpoint,
        files={"file": ("not-really.pdf", b"not a pdf", "application/pdf")},
        headers=headers(),
    )
    assert invalid.status_code == 415
    uploaded = client.post(
        endpoint,
        files={"file": ("synthetic-report.pdf", b"%PDF-synthetic content", "application/pdf")},
        headers=headers(),
    )
    assert uploaded.status_code == 201
    document = uploaded.json()
    assert document["processing_status"] == "NOT_PROCESSED"
    assert document["extraction_status"] == "NOT_PROCESSED"
    assert "storage_reference" not in document
    patient_documents = client.get(
        f"/api/v1/patients/{patient['id']}/documents",
        headers=headers(),
    )
    assert patient_documents.status_code == 200
    assert patient_documents.json()["total"] == 1
    assert patient_documents.json()["items"][0]["id"] == document["id"]
    assert patient_documents.json()["items"][0]["patient_id"] == patient["id"]
    assert patient_documents.json()["items"][0]["visit_id"] == visit["id"]
    assert "storage_reference" not in patient_documents.json()["items"][0]
    assert client.get(f"/api/v1/patients/{patient['id']}/documents").status_code == 401
    assert client.get(f"/api/v1/documents/{document['id']}/download").status_code == 401
    downloaded = client.get(f"/api/v1/documents/{document['id']}/download", headers=headers())
    assert downloaded.status_code == 200
    assert downloaded.content == b"%PDF-synthetic content"


def test_patient_documents_returns_empty_list_and_404_for_unknown_patient(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "No Documents", "date_of_birth": "1980-01-01", "gender": "Female", "phone": "0412345678"},
        headers=headers(),
    ).json()
    empty = client.get(f"/api/v1/patients/{patient['id']}/documents", headers=headers())
    assert empty.status_code == 200
    assert empty.json()["items"] == []
    assert empty.json()["total"] == 0
    missing = client.get("/api/v1/patients/VYX-P-999999/documents", headers=headers())
    assert missing.status_code == 404
