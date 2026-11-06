
import { useEffect, useState } from "react";
import {
  authorizePrescription,
  createPrescription,
  fetchPrescriptions,
  type PrescriptionRecord,
} from "../services/backendApi";

export default function PrescriptionPage() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [visitId, setVisitId] = useState("VYX-V-240009");
  const [pharmacyId, setPharmacyId] = useState("PHARMACY-DEMO-001");
  const [medicationName, setMedicationName] = useState("");
  const [strength, setStrength] = useState("");
  const [dosage, setDosage] = useState("");
  const [route, setRoute] = useState("Oral");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [refills, setRefills] = useState(0);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPrescriptions() {
    try {
      const data = await fetchPrescriptions();
      setPrescriptions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load prescriptions."
      );
    }
  }

  useEffect(() => {
    void loadPrescriptions();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const created = await createPrescription(visitId.trim(), {
        pharmacy_id: pharmacyId.trim(),
        clinical_notes: clinicalNotes,
        expires_on: expiresOn,
        items: [
          {
            medication_name: medicationName.trim(),
            strength: strength.trim(),
            dosage: dosage.trim(),
            route,
            frequency: frequency.trim(),
            duration: duration.trim(),
            quantity,
            instructions: instructions.trim(),
            refills,
          },
        ],
      });

      setMessage(`Prescription ${created.id} created successfully.`);
      await loadPrescriptions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create prescription."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthorize(id: string) {
    setError("");
    setMessage("");

    try {
      const updated = await authorizePrescription(id);
      setMessage(`Prescription ${updated.id} authorized successfully.`);
      await loadPrescriptions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to authorize prescription."
      );
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Prescription Management</h1>
      <p>Create prescriptions for a patient visit and authorize them.</p>

      {message && (
        <p role="status" style={{ color: "green" }}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
          marginBottom: 28,
        }}
      >
        <label>
          Visit ID *
          <input
            required
            value={visitId}
            onChange={(e) => setVisitId(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label>
          Pharmacy ID *
          <input
            required
            value={pharmacyId}
            onChange={(e) => setPharmacyId(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label>
          Medication name *
          <input
            required
            value={medicationName}
            onChange={(e) => setMedicationName(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label>
          Strength *
          <input
            required
            placeholder="e.g. 500 mg"
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label>
          Dosage *
          <input
            required
            placeholder="e.g. 1 tablet"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label>
          Route
          <select
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            style={fieldStyle}
          >
            <option>Oral</option>
            <option>Topical</option>
            <option>Inhalation</option>
            <option>Injection</option>
          </select>
        </label>

        <label>
          Frequency *
          <input
            required
            placeholder="e.g. Twice daily"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label>
          Duration *
          <input
            required
            placeholder="e.g. 5 days"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label>
          Quantity *
          <input
            required
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            style={fieldStyle}
          />
        </label>

        <label>
          Refills
          <input
            type="number"
            min={0}
            value={refills}
            onChange={(e) => setRefills(Number(e.target.value))}
            style={fieldStyle}
          />
        </label>

        <label>
          Expiry date *
          <input
            required
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label style={{ gridColumn: "1 / -1" }}>
          Instructions
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label style={{ gridColumn: "1 / -1" }}>
          Clinical notes
          <textarea
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Creating..." : "Create Prescription"}
        </button>
      </form>

      <h2>Existing Prescriptions</h2>

      {prescriptions.length === 0 ? (
        <p>No prescriptions found.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {prescriptions.map((prescription) => (
            <section
              key={prescription.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 16,
              }}
            >
              <strong>{prescription.id}</strong>
              <p>Patient: {prescription.patient_id}</p>
              <p>Visit: {prescription.visit_id}</p>
              <p>Status: {prescription.status}</p>
              <p>
                Medication:{" "}
                {prescription.items
                  .map((item) => item.medication_name)
                  .join(", ")}
              </p>

              {prescription.status === "DRAFT" && (
                <button
                  type="button"
                  onClick={() => void handleAuthorize(prescription.id)}
                  style={buttonStyle}
                >
                  Authorize Prescription
                </button>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  marginTop: 6,
  border: "1px solid #ccc",
  borderRadius: 6,
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  border: 0,
  borderRadius: 6,
  background: "#176b59",
  color: "white",
  cursor: "pointer",
};
