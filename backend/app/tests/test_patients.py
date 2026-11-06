def test_patient_registration_search_and_auth(client, headers):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/v1/health/ready").status_code == 401
    assert client.get("/api/v1/health/ready", headers=headers()).json() == {"status": "ready"}
    preflight = client.options(
        "/api/v1/patients",
        headers={
            "Origin": "http://localhost:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:5174"
    response = client.post(
        "/api/v1/patients",
        json={
            "name": "Synthetic Patient",
            "date_of_birth": "1984-11-02",
            "gender": "Prefer not to say",
            "phone": "0412345678",
            "allergies": ["Latex"],
        },
        headers=headers(),
    )
    assert response.status_code == 201
    patient = response.json()
    assert patient["hospital_patient_id"].startswith("VYX-P-")
    assert patient["visits"][0]["id"].startswith("VYX-V-")

    found = client.get("/api/v1/patients/search?q=Synthetic", headers=headers())
    assert found.status_code == 200
    assert found.json()["items"][0]["id"] == patient["id"]
    phone_found = client.get("/api/v1/patients/search?q=0412345678", headers=headers())
    assert phone_found.status_code == 200
    assert phone_found.json()["items"][0]["id"] == patient["id"]
    assert client.get(f"/api/v1/patients/{patient['id']}").status_code == 401
    assert client.post("/api/v1/patients", json={}, headers=headers("clinician")).status_code == 403


def test_multiple_visits_and_history_are_separate(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "History Example", "date_of_birth": "1970-01-01", "gender": "Female", "phone": "0412345678"},
        headers=headers(),
    ).json()
    first = patient["visits"][0]
    second_response = client.post(
        f"/api/v1/patients/{patient['id']}/visits",
        json={"presenting_symptoms": "Current synthetic symptom"},
        headers=headers(),
    )
    assert second_response.status_code == 201
    second = second_response.json()
    assert first["id"] != second["id"]
    assert second["patient_id"] == patient["id"]
    history = client.get(f"/api/v1/patients/{patient['id']}/history", headers=headers()).json()
    assert len(history["visits"]) == 2
    assert {item["id"] for item in history["visits"]} == {first["id"], second["id"]}
    events = client.get(f"/api/v1/patients/{patient['id']}/audit", headers=headers()).json()["items"]
    assert any(event["action"] == "PATIENT_HISTORY_RETRIEVED" for event in events)


def test_invalid_patient_input_is_rejected(client, headers):
    response = client.post(
        "/api/v1/patients",
        json={"name": "", "date_of_birth": "2099-01-01", "gender": "Female", "phone": "123"},
        headers=headers(),
    )
    assert response.status_code == 422


def test_same_name_does_not_collide_patient_ids(client, headers):
    payload = {
        "name": "Same Synthetic Name",
        "date_of_birth": "1988-08-08",
        "gender": "Prefer not to say",
        "phone": "0412345678",
    }
    first = client.post("/api/v1/patients", json=payload, headers=headers()).json()
    second = client.post("/api/v1/patients", json=payload, headers=headers()).json()
    assert first["id"] != second["id"]
    assert first["hospital_patient_id"] != second["hospital_patient_id"]
