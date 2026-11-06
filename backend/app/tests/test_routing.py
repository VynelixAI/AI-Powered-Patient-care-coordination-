from app.services.comparison_service import compare_current_and_historical_data


def test_comparison_avoids_incompatible_unverified_and_missing_data():
    historical = [{
        "id": "old",
        "measurement_type": "weight",
        "value": "72",
        "unit": "kg",
        "recorded_at": "2025-01-01T00:00:00Z",
        "verification_status": "VERIFIED",
        "source_record_id": None,
    }]
    incompatible = {
        "id": "new",
        "measurement_type": "weight",
        "value": "160",
        "unit": "lb",
        "recorded_at": "2025-02-01T00:00:00Z",
        "verification_status": "VERIFIED",
    }
    comparison = compare_current_and_historical_data([incompatible], historical)
    assert comparison[0]["historical"] is None
    assert comparison[0]["change"] is None
    unverified = {**incompatible, "unit": "kg", "verification_status": "UNVERIFIED"}
    assert compare_current_and_historical_data([unverified], historical)[0]["historical"] is None
    assert compare_current_and_historical_data([], historical) == []


def test_routing_cannot_reuse_a_review_when_a_new_assessment_is_pending(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "Stale Review", "date_of_birth": "1987-01-01", "gender": "Female", "phone": "0412345678"},
        headers=headers(),
    ).json()
    visit_id = patient["visits"][0]["id"]
    assessment = client.post(
        f"/api/v1/visits/{visit_id}/assessments", json={}, headers=headers("clinician")
    ).json()
    reviewed = client.post(
        f"/api/v1/assessments/{assessment['id']}/review",
        json={
            "decision": "APPROVE",
            "final_priority": "STANDARD",
            "final_destination": "General Medicine",
        },
        headers=headers("clinician"),
    )
    assert reviewed.status_code == 201
    second_assessment = client.post(
        f"/api/v1/visits/{visit_id}/assessments", json={}, headers=headers("clinician")
    )
    assert second_assessment.status_code == 201
    route = client.post(
        f"/api/v1/visits/{visit_id}/routing",
        json={"destination": "General Medicine"},
        headers=headers(),
    )
    assert route.status_code == 409


def test_only_clinicians_can_mark_observations_verified(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "Verified Observation", "date_of_birth": "1986-06-06", "gender": "Male", "phone": "0412345678"},
        headers=headers(),
    ).json()
    visit_id = patient["visits"][0]["id"]
    payload = {
        "measurement_type": "weight",
        "value": "72",
        "unit": "kg",
        "verification_status": "VERIFIED",
    }
    denied = client.post(
        f"/api/v1/visits/{visit_id}/observations", json=payload, headers=headers("triage_staff")
    )
    assert denied.status_code == 403
    accepted = client.post(
        f"/api/v1/visits/{visit_id}/observations", json=payload, headers=headers("clinician")
    )
    assert accepted.status_code == 201
