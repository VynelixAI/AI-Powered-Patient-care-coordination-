def test_assessment_uses_current_and_historical_evidence(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={
            "name": "Evidence Example",
            "date_of_birth": "1968-04-19",
            "gender": "Female",
            "phone": "0412345678",
            "conditions": ["Synthetic condition"],
            "medical_history": "Synthetic narrative history.",
        },
        headers=headers(),
    ).json()
    old_visit = client.post(
        f"/api/v1/patients/{patient['id']}/visits",
        json={"presenting_symptoms": "Previous synthetic symptom"},
        headers=headers(),
    ).json()
    old_observation = client.post(
        f"/api/v1/visits/{old_visit['id']}/observations",
        json={
            "measurement_type": "blood_pressure",
            "value": "136/84",
            "unit": "mmHg",
            "verification_status": "VERIFIED",
        },
        headers=headers("clinician"),
    )
    assert old_observation.status_code == 201
    visit = client.post(
        f"/api/v1/patients/{patient['id']}/visits",
        json={"presenting_symptoms": "Current synthetic symptoms"},
        headers=headers(),
    ).json()
    client.post(
        f"/api/v1/visits/{visit['id']}/observations",
        json={
            "measurement_type": "blood_pressure",
            "value": "142/88",
            "unit": "mmHg",
            "verification_status": "VERIFIED",
        },
        headers=headers("clinician"),
    )
    response = client.post(
        f"/api/v1/visits/{visit['id']}/assessments",
        json={},
        headers=headers("clinician"),
    )
    assert response.status_code == 201
    assessment = response.json()
    assert assessment["current_problem_summary"] == "Current synthetic symptoms"
    assert any("Synthetic narrative history" in value for value in assessment["relevant_historical_context"])
    assert assessment["historical_comparisons"][0]["comparison_status"] == "COMPARED"
    assert assessment["status"] == "PENDING_DOCTOR_REVIEW"
    assert assessment["potential_risk_indicators"] == []
    assert assessment["priority_recommendation"] == "NOT_DETERMINED_BY_SIMULATED_SERVICE"
    assert assessment["assessment_method"] == "SIMULATED_DEMO_CLINICAL_DECISION_SUPPORT"
    refreshed_visit = client.get(f"/api/v1/visits/{visit['id']}", headers=headers()).json()
    assert refreshed_visit["status"] == "AWAITING_REVIEW"


def test_review_reason_transition_and_routing(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "Review Example", "date_of_birth": "1992-07-14", "gender": "Non-binary", "phone": "0412345678"},
        headers=headers(),
    ).json()
    visit = client.post(
        f"/api/v1/patients/{patient['id']}/visits",
        json={"presenting_symptoms": "Synthetic symptom"},
        headers=headers(),
    ).json()
    assessment = client.post(
        f"/api/v1/visits/{visit['id']}/assessments",
        json={},
        headers=headers("clinician"),
    ).json()
    endpoint = f"/api/v1/assessments/{assessment['id']}/review"
    missing_reason = client.post(
        endpoint,
        json={"decision": "MODIFY", "final_priority": "HIGH", "final_destination": "Cardiology"},
        headers=headers("clinician"),
    )
    assert missing_reason.status_code == 422
    reviewed = client.post(
        endpoint,
        json={
            "decision": "APPROVE",
            "final_priority": "STANDARD",
            "final_destination": "General Medicine",
        },
        headers=headers("clinician"),
    )
    assert reviewed.status_code == 201
    route = client.post(
        f"/api/v1/visits/{visit['id']}/routing",
        json={"destination": "General Medicine"},
        headers=headers(),
    )
    assert route.status_code == 201
    assert route.json()["approved_priority"] == "STANDARD"
    assert route.json()["doctor_review_id"] == reviewed.json()["review"]["id"]
    duplicate = client.post(
        endpoint,
        json={"decision": "APPROVE", "final_priority": "LOW"},
        headers=headers("clinician"),
    )
    assert duplicate.status_code == 409


def test_assessment_reports_absent_history_without_fabricating_findings(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "No History", "date_of_birth": "1988-01-02", "gender": "Female", "phone": "0412345678"},
        headers=headers(),
    ).json()
    visit = patient["visits"][0]
    assessment = client.post(
        f"/api/v1/visits/{visit['id']}/assessments",
        json={},
        headers=headers("clinician"),
    ).json()
    assert assessment["relevant_historical_context"] == []
    assert assessment["historical_comparisons"] == []
    assert assessment["potential_risk_indicators"] == []
    assert any("No previous visits" in item for item in assessment["missing_or_uncertain_information"])


def test_route_requires_review_and_matching_destination(client, headers):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "Routing Example", "date_of_birth": "2000-01-01", "gender": "Male", "phone": "0412345678"},
        headers=headers(),
    ).json()
    visit = client.post(
        f"/api/v1/patients/{patient['id']}/visits",
        json={"presenting_symptoms": "Synthetic symptom"},
        headers=headers(),
    ).json()
    blocked = client.post(
        f"/api/v1/visits/{visit['id']}/routing",
        json={"destination": "Emergency Department"},
        headers=headers(),
    )
    assert blocked.status_code == 409
