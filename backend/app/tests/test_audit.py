def test_audit_trail_records_authenticated_actor_and_safe_action(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={
            "name": "Audit Synthetic",
            "date_of_birth": "1981-05-03",
            "gender": "Female",
            "phone": "0412345678",
        },
        headers=headers(),
    ).json()
    response = client.get(f"/api/v1/patients/{patient['id']}/audit", headers=headers())
    assert response.status_code == 200
    event = next(item for item in response.json()["items"] if item["action"] == "VISIT_CREATED")
    assert event["actor_id"] == "test-user"
    assert event["actor_role"] == "triage_staff"
    assert "phone" not in event["safe_summary"].casefold()
    workspace = client.get("/api/v1/audit", headers=headers())
    assert workspace.status_code == 200
    assert any(item["patient_id"] == patient["id"] for item in workspace.json()["items"])
