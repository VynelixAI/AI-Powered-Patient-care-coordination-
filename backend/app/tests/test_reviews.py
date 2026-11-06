import pytest


@pytest.mark.parametrize("decision", ["MODIFY", "OVERRIDE"])
def test_modified_decision_preserves_assessment(client, headers, decision):
    patient = client.post(
        "/api/v1/patients",
        json={"name": "Review Preserve", "date_of_birth": "2001-03-01", "gender": "Female", "phone": "0412345678"},
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
    queue = client.get("/api/v1/doctor-reviews/pending", headers=headers())
    assert queue.status_code == 200
    assert any(item["id"] == assessment["id"] for item in queue.json()["items"])
    response = client.post(
        f"/api/v1/assessments/{assessment['id']}/review",
        json={
            "decision": decision,
            "comment": "Synthetic test reason.",
            "final_priority": "HIGH",
        },
        headers=headers("clinician"),
    )
    assert response.status_code == 201
    queue_after_review = client.get("/api/v1/doctor-reviews/pending", headers=headers())
    assert all(item["id"] != assessment["id"] for item in queue_after_review.json()["items"])
    original = client.get(f"/api/v1/assessments/{assessment['id']}", headers=headers()).json()
    assert original["current_problem_summary"] == assessment["current_problem_summary"]
    assert original["status"] == "REVIEWED"
    assert response.json()["review"]["decision"] == decision
