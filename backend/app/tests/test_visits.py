def test_visit_lifecycle_and_returning_patient_history(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "Visit Test", "date_of_birth": "1990-05-01", "gender": "Male", "phone": "0412345678"},
        headers=headers(),
    ).json()
    visit = client.post(
        f"/api/v1/patients/{patient['id']}/visits",
        json={"presenting_symptoms": "Historical note", "clinician_notes": "Synthetic prior note"},
        headers=headers(),
    ).json()
    update = client.patch(
        f"/api/v1/visits/{visit['id']}",
        json={"final_outcome": "Documented follow-up"},
        headers=headers("clinician"),
    )
    assert update.status_code == 200
    invalid_route_state = client.patch(
        f"/api/v1/visits/{visit['id']}",
        json={"status": "ROUTED"},
        headers=headers("clinician"),
    )
    assert invalid_route_state.status_code == 422
    history = client.get(f"/api/v1/patients/{patient['id']}/history", headers=headers()).json()
    assert any(item.get("outcome") == "Documented follow-up" for item in history["historical_outcomes"])


def test_visit_list_filters_and_observation_list(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "List Filter Example", "date_of_birth": "1990-05-01", "gender": "Male", "phone": "0412345678"},
        headers=headers(),
    ).json()
    visit = patient["visits"][0]
    created = client.post(
        f"/api/v1/visits/{visit['id']}/observations",
        json={"measurement_type": "weight", "value": "72", "unit": "kg"},
        headers=headers(),
    )
    assert created.status_code == 201
    observations = client.get(
        f"/api/v1/visits/{visit['id']}/observations", headers=headers()
    )
    assert observations.status_code == 200
    assert observations.json()["items"][0]["id"] == created.json()["id"]

    by_patient_name = client.get("/api/v1/visits?q=List%20Filter", headers=headers())
    assert by_patient_name.status_code == 200
    assert any(item["id"] == visit["id"] for item in by_patient_name.json()["items"])
    by_status = client.get("/api/v1/visits?status=COMPLETED", headers=headers())
    assert by_status.status_code == 200
    assert by_status.json()["items"] == []


def test_consultation_is_saved_on_the_existing_visit_and_requires_clinician_role(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "Consultation Test", "date_of_birth": "1990-05-01", "gender": "Female", "phone": "0412345678"},
        headers=headers(),
    ).json()
    visit_id = patient["visits"][0]["id"]
    payload = {
        "examination_findings": "Synthetic examination finding.",
        "consultation_notes": "Synthetic clinician consultation note.",
    }

    denied = client.put(f"/api/v1/visits/{visit_id}/consultation", json=payload, headers=headers())
    assert denied.status_code == 403

    saved = client.put(
        f"/api/v1/visits/{visit_id}/consultation", json=payload, headers=headers("clinician")
    )
    assert saved.status_code == 200
    assert saved.json()["visit_id"] == visit_id
    assert saved.json()["consultation"]["consultation_notes"] == payload["consultation_notes"]

    replacement = {**payload, "consultation_notes": "Updated synthetic note."}
    updated = client.put(
        f"/api/v1/visits/{visit_id}/consultation", json=replacement, headers=headers("clinician")
    )
    assert updated.status_code == 200
    visit = client.get(f"/api/v1/visits/{visit_id}", headers=headers()).json()
    assert visit["patient_id"] == patient["id"]
    assert visit["consultation_notes"] == replacement["consultation_notes"]
    assert visit["presenting_complaint"] == "Initial assessment"

    assert client.put(f"/api/v1/visits/not-a-visit/consultation", json=payload, headers=headers("clinician")).status_code == 404
    assert client.put(f"/api/v1/visits/{visit_id}/consultation", json=payload).status_code == 401
    assert client.put(
        f"/api/v1/visits/{visit_id}/consultation",
        json={"examination_findings": "Missing the required consultation field."},
        headers=headers("clinician"),
    ).status_code == 422
