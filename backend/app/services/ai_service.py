from datetime import datetime, timezone


class SimulatedAssessmentService:
    method = "SIMULATED_DEMO_CLINICAL_DECISION_SUPPORT"
    version = "1.0"

    def generate(self, current: dict, history: dict, comparisons: list[dict]) -> dict:
        visit = current["visit"]
        observations = current["observations"]
        documents = current["documents"]
        historical_context = []
        patient = history["patient"]
        if patient.get("medical_history"):
            historical_context.append(patient["medical_history"])
        historical_context.extend(
            f"Recorded condition: {condition}" for condition in patient.get("conditions", [])
        )
        historical_context.extend(
            f"Prior visit {record['id']}: {record.get('presenting_symptoms')}"
            for record in history["visits"]
            if record.get("presenting_symptoms")
        )
        historical_context.extend(
            f"Clinician-recorded diagnosis from visit {record['id']}: {diagnosis}"
            for record in history["visits"]
            for diagnosis in record.get("clinician_recorded_diagnoses", [])
        )
        historical_context.extend(
            f"Documented outcome from visit {record['id']}: {record['final_outcome']}"
            for record in history["visits"]
            if record.get("final_outcome")
        )
        historical_context.extend(
            f"Recorded allergy: {allergy}" for allergy in patient.get("allergies", [])
        )
        historical_context.extend(
            f"Previous clinician decision: {review['decision']} ({review['final_priority']})."
            for review in history["reviews"]
        )
        historical_context.extend(
            f"Previous verified report finding from document {document['id']}: {finding}"
            for document in history["documents"]
            if document.get("extraction_status") == "VERIFIED"
            for finding in document.get("extracted_findings", [])
        )
        historical_context.extend(
            f"Previous document {document['id']} is available; extraction status: "
            f"{document.get('extraction_status', 'UNKNOWN')}."
            for document in history["documents"]
            if document.get("extraction_status") != "VERIFIED"
        )
        historical_context.extend(
            f"Previous assessment {assessment['id']} recorded on {assessment['created_at']} "
            f"with status {assessment['status']}."
            for assessment in history["assessments"]
        )
        current_findings = [
            f"Recorded observation: {item['measurement_type']} {item['value']} {item['unit']} "
            f"({item['verification_status']})."
            for item in observations
        ]
        current_findings.extend(
            f"Current medication recorded: {medication}"
            for medication in visit.get("current_medications", [])
        )
        if visit.get("medication_changes"):
            current_findings.append(f"Documented medication changes: {visit['medication_changes']}")
        if visit.get("clinician_notes"):
            current_findings.append(f"Clinician-entered note: {visit['clinician_notes']}")
        current_findings.extend(
            f"Verified extracted finding: {finding}"
            for document in documents
            if document.get("extraction_status") == "VERIFIED"
            for finding in document.get("extracted_findings", [])
        )
        problem_parts = []
        if visit.get("presenting_complaint"):
            problem_parts.append(f"Presenting complaint: {visit['presenting_complaint']}.")
        problem_parts.append(visit.get("presenting_symptoms") or "Current symptoms were not recorded.")
        if visit.get("symptom_onset"):
            problem_parts.append(f"Onset: {visit['symptom_onset']}.")
        if visit.get("symptom_duration"):
            problem_parts.append(f"Duration: {visit['symptom_duration']}.")
        uncertain = []
        if any(document.get("extraction_status") != "VERIFIED" for document in history["documents"]):
            uncertain.append("Some historical documents have no verified extracted findings.")
        if not observations:
            uncertain.append("No structured observations were recorded for the current visit.")
        if not documents:
            uncertain.append("No documents were attached to the current visit.")
        elif not any(document.get("extraction_status") == "VERIFIED" for document in documents):
            uncertain.append("Current document findings are not verified or have not been extracted.")
        has_prior_visit_information = any(
            record.get("presenting_symptoms")
            or record.get("clinician_notes")
            or record.get("clinician_recorded_diagnoses")
            or record.get("final_outcome")
            for record in history["visits"]
        )
        if not has_prior_visit_information and not patient.get("medical_history"):
            uncertain.append("No previous visits or narrative medical history are available.")
        return {
            "current_problem_summary": " ".join(problem_parts),
            "relevant_historical_context": historical_context,
            "current_findings": current_findings,
            "historical_comparisons": comparisons,
            "potential_risk_indicators": [],
            "missing_or_uncertain_information": uncertain,
            "priority_recommendation": "NOT_DETERMINED_BY_SIMULATED_SERVICE",
            "urgency_recommendation": (
                "Not determined by this simulated service; clinician assessment is required."
            ),
            "suggested_care_pathway": "Not determined; the reviewing clinician selects the care pathway.",
            "assessment_method": self.method,
            "assessment_version": self.version,
            "status": "PENDING_DOCTOR_REVIEW",
            "created_at": datetime.now(timezone.utc),
        }
