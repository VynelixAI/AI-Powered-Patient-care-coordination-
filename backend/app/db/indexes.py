from typing import Any


async def create_indexes(database: Any) -> None:
    await database.patients.create_index("hospital_patient_id", unique=True, name="uq_hospital_patient_id")
    await database.visits.create_index("id", unique=True, name="uq_visit_id")
    await database.visits.create_index([("patient_id", 1), ("created_at", -1)], name="ix_patient_visits")
    await database.visits.create_index([("status", 1), ("created_at", -1)], name="ix_status_visits")
    await database.documents.create_index("id", unique=True, name="uq_document_id")
    await database.documents.create_index([("visit_id", 1), ("uploaded_at", -1)], name="ix_visit_documents")
    await database.assessments.create_index("id", unique=True, name="uq_assessment_id")
    await database.assessments.create_index([("visit_id", 1), ("created_at", -1)], name="ix_visit_assessments")
    await database.assessments.create_index(
        [("status", 1), ("created_at", 1)], name="ix_pending_assessments"
    )
    await database.doctor_reviews.create_index("id", unique=True, name="uq_review_id")
    await database.doctor_reviews.create_index("assessment_id", unique=True, name="uq_review_assessment")
    await database.doctor_reviews.create_index([("assessment_id", 1), ("reviewed_at", -1)], name="ix_assessment_reviews")
    await database.health_observations.create_index("id", unique=True, name="uq_observation_id")
    await database.health_observations.create_index(
        [("patient_id", 1), ("measurement_type", 1), ("recorded_at", -1)],
        name="ix_patient_observations",
    )
    await database.care_routes.create_index("id", unique=True, name="uq_route_id")
    await database.care_routes.create_index("visit_id", unique=True, name="uq_route_visit")
    await database.clinical_decisions.create_index("id", unique=True, name="uq_clinical_decision_id")
    await database.clinical_decisions.create_index([("visit_id", 1), ("clinician_id", 1)], unique=True, name="uq_visit_clinician_decision")
    await database.referrals.create_index("id", unique=True, name="uq_referral_id")
    await database.referrals.create_index([("patient_id", 1), ("created_at", -1)], name="ix_patient_referrals")
    await database.referrals.create_index([("assigned_specialist_id", 1), ("status", 1)], name="ix_specialist_referrals")
    await database.specialist_consultations.create_index("id", unique=True, name="uq_specialist_consultation_id")
    await database.specialist_consultations.create_index([("referral_id", 1), ("clinician_id", 1)], unique=True, name="uq_referral_specialist_consultation")
    await database.prescriptions.create_index("id", unique=True, name="uq_prescription_id")
    await database.prescriptions.create_index([("patient_id", 1), ("created_at", -1)], name="ix_patient_prescriptions")
    await database.prescriptions.create_index([("pharmacy_id", 1), ("status", 1)], name="ix_pharmacy_prescriptions")
    await database.follow_ups.create_index("id", unique=True, name="uq_follow_up_id")
    await database.follow_ups.create_index([("patient_id", 1), ("status", 1), ("due_date", 1)], name="ix_patient_follow_ups")
    await database.audit_logs.create_index("id", unique=True, name="uq_audit_id")
    await database.audit_logs.create_index([("patient_id", 1), ("timestamp", -1)], name="ix_patient_audit")
    await database.audit_logs.create_index("timestamp", name="ix_workspace_audit")
