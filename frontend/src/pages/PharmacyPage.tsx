
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  PackageCheck,
  Pill,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  dispensePrescription,
  fetchPharmacyPrescriptions,
  type PrescriptionRecord,
} from "../services/backendApi";

interface DispensingHistoryRecord {
  prescriptionId: string;
  medications: { name: string; quantity: number }[];
  dispensedAt: string;
}

export default function PharmacyPage() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [dispensingHistory, setDispensingHistory] = useState<
    DispensingHistoryRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPrescriptions = useCallback(async () => {
    setError("");

    try {
      const records = await fetchPharmacyPrescriptions();

      // Normalize optional fields without inventing missing IDs.
      const normalizedRecords = records.map((prescription) => ({
        ...prescription,
        patient_id: prescription.patient_id || "",
        visit_id: prescription.visit_id || "",
        pharmacy_id: prescription.pharmacy_id || "",
        items: Array.isArray(prescription.items)
          ? prescription.items
          : [],
      }));

      setPrescriptions(normalizedRecords);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load pharmacy prescriptions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrescriptions();
  }, [loadPrescriptions]);

  async function handleDispense(prescription: PrescriptionRecord) {
    setError("");
    setMessage("");
    setBusyId(prescription.id);

    try {
      if (!prescription.items?.length) {
        throw new Error("This prescription has no medication items.");
      }

      const items = prescription.items.map((item) => {
        const rawQuantity = quantities[prescription.id];
        const quantity =
          rawQuantity === undefined ? item.quantity : Number(rawQuantity);

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > item.quantity
        ) {
          throw new Error(
            `Enter a valid quantity between 1 and ${item.quantity}.`
          );
        }

        return {
          medication_name: item.medication_name,
          quantity,
        };
      });

      const result = await dispensePrescription(prescription.id, items);
      const latestDispense =
        result.dispenses?.[result.dispenses.length - 1];

      setDispensingHistory((current) => [
        {
          prescriptionId: result.id || prescription.id,
          medications: items.map((item) => ({
            name: item.medication_name,
            quantity: item.quantity,
          })),
          dispensedAt:
            latestDispense?.dispensed_at ?? new Date().toISOString(),
        },
        ...current.filter(
          (record) => record.prescriptionId !== prescription.id
        ),
      ]);

      setMessage(`Prescription ${prescription.id} dispensed successfully.`);
      setError("");

      setQuantities((current) => {
        const next = { ...current };
        delete next[prescription.id];
        return next;
      });

      await loadPrescriptions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to dispense prescription."
      );
    } finally {
      setBusyId("");
    }
  }

  const authorizedCount = prescriptions.filter(
    (prescription) => prescription.status === "AUTHORIZED"
  ).length;

  const dispensedCount =
    prescriptions.filter(
      (prescription) => prescription.status === "DISPENSED"
    ).length + dispensingHistory.length;

  return (
    <main className="pharmacy-page">
      <header className="pharmacy-header">
        <div>
          <div className="pharmacy-eyebrow">
            <Activity size={15} />
            PHARMACY OPERATIONS
          </div>
          <h1>Pharmacy Management</h1>
          <p>
            Review authorized prescriptions and record medication dispensing.
          </p>
        </div>

        <button
          type="button"
          className="pharmacy-button pharmacy-button-secondary"
          disabled={loading}
          onClick={() => {
            setMessage("");
            setLoading(true);
            void loadPrescriptions();
          }}
        >
          <RefreshCw size={16} className={loading ? "pharmacy-spin" : ""} />
          Refresh prescriptions
        </button>
      </header>

      <section className="pharmacy-stats" aria-label="Prescription summary">
        <article className="pharmacy-stat-card">
          <span className="pharmacy-stat-icon pharmacy-icon-blue">
            <Pill size={20} />
          </span>
          <div>
            <span className="pharmacy-stat-label">Total returned</span>
            <strong>{prescriptions.length}</strong>
          </div>
        </article>

        <article className="pharmacy-stat-card">
          <span className="pharmacy-stat-icon pharmacy-icon-amber">
            <Clock size={20} />
          </span>
          <div>
            <span className="pharmacy-stat-label">Awaiting dispensing</span>
            <strong>{authorizedCount}</strong>
          </div>
        </article>

        <article className="pharmacy-stat-card">
          <span className="pharmacy-stat-icon pharmacy-icon-green">
            <PackageCheck size={20} />
          </span>
          <div>
            <span className="pharmacy-stat-label">Dispensed this session</span>
            <strong>{dispensedCount}</strong>
          </div>
        </article>
      </section>

      {message && (
        <div className="pharmacy-alert pharmacy-alert-success" role="status">
          <CheckCircle2 size={19} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="pharmacy-alert pharmacy-alert-error" role="alert">
          <ShieldAlert size={19} />
          <span>{error}</span>
        </div>
      )}

      <section className="pharmacy-list-section">
        <div className="pharmacy-section-heading">
          <div>
            <h2>Prescription queue</h2>
            <p>Prescriptions returned by the pharmacy service.</p>
          </div>
          <span className="pharmacy-count">
            {prescriptions.length} records
          </span>
        </div>

        {loading ? (
          <div className="pharmacy-empty-state">
            <RefreshCw size={26} className="pharmacy-spin" />
            <h3>Loading prescriptions</h3>
            <p>Retrieving records from the backend.</p>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="pharmacy-empty-state">
            <span className="pharmacy-empty-icon">
              <PackageCheck size={30} />
            </span>
            <h3>All caught up</h3>
            <p>
              No prescriptions are currently available in the pharmacy queue.
              Authorized prescriptions will appear here when returned by the
              backend.
            </p>
            <button
              type="button"
              className="pharmacy-button pharmacy-button-secondary"
              onClick={() => {
                setLoading(true);
                void loadPrescriptions();
              }}
            >
              <RefreshCw size={16} />
              Check again
            </button>
          </div>
        ) : (
          <div className="pharmacy-prescription-list">
            {prescriptions.map((prescription) => {
              const minimumQuantity =
                prescription.items.length > 0
                  ? Math.min(
                      ...prescription.items.map((item) => item.quantity)
                    )
                  : 0;

              const isAuthorized = prescription.status === "AUTHORIZED";
              const isBusy = busyId === prescription.id;

              return (
                <article
                  className="pharmacy-prescription-card"
                  key={prescription.id}
                >
                  <div className="pharmacy-card-header">
                    <div className="pharmacy-prescription-title">
                      <span className="pharmacy-prescription-icon">
                        <Pill size={20} />
                      </span>
                      <div>
                        <h3>{prescription.id}</h3>
                        <p>Prescription record</p>
                      </div>
                    </div>

                    <span
                      className={`pharmacy-status ${
                        isAuthorized
                          ? "pharmacy-status-authorized"
                          : prescription.status === "DISPENSED"
                            ? "pharmacy-status-dispensed"
                            : "pharmacy-status-other"
                      }`}
                    >
                      {prescription.status}
                    </span>
                  </div>

                  <div className="pharmacy-details-grid">
                    <div className="pharmacy-detail">
                      <span>Patient ID</span>
                      <strong>
                        {prescription.patient_id || "Not provided by API"}
                      </strong>
                    </div>

                    <div className="pharmacy-detail">
                      <span>Visit ID</span>
                      <strong>
                        {prescription.visit_id || "Not provided by API"}
                      </strong>
                    </div>

                    <div className="pharmacy-detail">
                      <span>Pharmacy ID</span>
                      <strong>
                        {prescription.pharmacy_id || "Not provided by API"}
                      </strong>
                    </div>
                  </div>

                  <div className="pharmacy-medication-section">
                    <h4>Medication details</h4>

                    {prescription.items.map((item, index) => (
                      <div
                        className="pharmacy-medication-row"
                        key={`${item.medication_name}-${index}`}
                      >
                        <div className="pharmacy-medication-main">
                          <strong>{item.medication_name}</strong>
                          <span>
                            {item.strength || "Strength unavailable"} ·{" "}
                            {item.dosage || "Dosage unavailable"}
                          </span>
                          <span>
                            Frequency: {item.frequency || "Not specified"}
                          </span>
                        </div>

                        <div className="pharmacy-quantity">
                          <span>Prescribed</span>
                          <strong>{item.quantity}</strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  {isAuthorized && prescription.items.length > 0 && (
                    <div className="pharmacy-dispense-panel">
                      <label
                        className="pharmacy-quantity-label"
                        htmlFor={`quantity-${prescription.id}`}
                      >
                        Quantity to dispense
                      </label>

                      <input
                        id={`quantity-${prescription.id}`}
                        type="number"
                        min={1}
                        max={minimumQuantity}
                        step={1}
                        value={
                          quantities[prescription.id] ??
                          String(minimumQuantity)
                        }
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [prescription.id]: event.target.value,
                          }))
                        }
                        className="pharmacy-quantity-input"
                      />

                      <button
                        type="button"
                        className="pharmacy-button pharmacy-button-primary"
                        disabled={isBusy}
                        onClick={() => void handleDispense(prescription)}
                      >
                        {isBusy ? (
                          <>
                            <RefreshCw
                              size={16}
                              className="pharmacy-spin"
                            />
                            Processing...
                          </>
                        ) : (
                          <>
                            <PackageCheck size={17} />
                            Dispense medication
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="pharmacy-list-section" style={{ marginTop: 24 }}>
        <div className="pharmacy-section-heading">
          <div>
            <h2>Recently dispensed</h2>
            <p>
              Successful dispensing operations during this page session.
            </p>
          </div>
          <span className="pharmacy-count">
            {dispensingHistory.length} records
          </span>
        </div>

        {dispensingHistory.length === 0 ? (
          <div className="pharmacy-empty-state">
            <span className="pharmacy-empty-icon">
              <PackageCheck size={30} />
            </span>
            <h3>No recent dispensing activity</h3>
            <p>
              Successfully dispensed prescriptions will appear here until this
              page is reloaded. This session history is not permanent.
            </p>
          </div>
        ) : (
          <div className="pharmacy-prescription-list">
            {dispensingHistory.map((record) => (
              <article
                className="pharmacy-prescription-card"
                key={record.prescriptionId}
              >
                <div className="pharmacy-card-header">
                  <div className="pharmacy-prescription-title">
                    <span className="pharmacy-prescription-icon">
                      <PackageCheck size={20} />
                    </span>
                    <div>
                      <h3>{record.prescriptionId}</h3>
                      <p>
                        Dispensed{" "}
                        {new Date(record.dispensedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className="pharmacy-status pharmacy-status-dispensed">
                    DISPENSED
                  </span>
                </div>

                {record.medications.map((medication, index) => (
                  <p key={`${medication.name}-${index}`}>
                    <strong>{medication.name}</strong>
                    {" · "}
                    Quantity dispensed: {medication.quantity}
                  </p>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .pharmacy-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
          color: #203c38;
        }

        .pharmacy-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 26px;
        }

        .pharmacy-eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #277563;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.1px;
          margin-bottom: 10px;
        }

        .pharmacy-header h1 {
          margin: 0;
          font-size: clamp(26px, 3vw, 34px);
          line-height: 1.25;
          font-weight: 700;
        }

        .pharmacy-header p,
        .pharmacy-section-heading p {
          color: #71817d;
          margin: 9px 0 0;
          line-height: 1.6;
        }

        .pharmacy-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 10px 15px;
          border: 1px solid transparent;
          border-radius: 8px;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }

        .pharmacy-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .pharmacy-button-primary {
          background: #176b59;
          color: #fff;
        }

        .pharmacy-button-primary:hover:not(:disabled) {
          background: #115746;
        }

        .pharmacy-button-secondary {
          background: #fff;
          border-color: #dce5e1;
          color: #285c51;
        }

        .pharmacy-button-secondary:hover:not(:disabled) {
          background: #f0f7f4;
          border-color: #bad5ca;
        }

        .pharmacy-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 26px;
        }

        .pharmacy-stat-card {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          padding: 19px;
          background: #fff;
          border: 1px solid #e4e9e5;
          border-radius: 12px;
        }

        .pharmacy-stat-icon,
        .pharmacy-prescription-icon,
        .pharmacy-empty-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 10px;
          width: 44px;
          height: 44px;
        }

        .pharmacy-icon-blue {
          background: #edf4fc;
          color: #416f9e;
        }

        .pharmacy-icon-amber {
          background: #fff5df;
          color: #9a6b17;
        }

        .pharmacy-icon-green {
          background: #e9f6ef;
          color: #277b55;
        }

        .pharmacy-stat-label {
          display: block;
          color: #788681;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .pharmacy-stat-card strong {
          font-size: 25px;
          line-height: 1.2;
          font-weight: 700;
        }

        .pharmacy-alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 13px 15px;
          margin-bottom: 20px;
          border: 1px solid;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.5;
        }

        .pharmacy-alert-success {
          color: #206a46;
          background: #edf8f0;
          border-color: #cde8d4;
        }

        .pharmacy-alert-error {
          color: #a13c37;
          background: #fff0ef;
          border-color: #f2d0ce;
        }

        .pharmacy-list-section {
          background: #fff;
          border: 1px solid #e4e9e5;
          border-radius: 13px;
          padding: 22px;
        }

        .pharmacy-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 20px;
        }

        .pharmacy-section-heading h2 {
          font-size: 19px;
          margin: 0;
        }

        .pharmacy-section-heading p {
          font-size: 13px;
        }

        .pharmacy-count {
          padding: 6px 10px;
          border-radius: 20px;
          background: #eff5f1;
          color: #35695b;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 600;
        }

        .pharmacy-prescription-list {
          display: grid;
          gap: 16px;
        }

        .pharmacy-prescription-card {
          border: 1px solid #e2e9e5;
          border-radius: 11px;
          padding: 20px;
          min-width: 0;
        }

        .pharmacy-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding-bottom: 17px;
          border-bottom: 1px solid #edf0ed;
        }

        .pharmacy-prescription-title {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .pharmacy-prescription-icon {
          color: #28725f;
          background: #edf6f1;
        }

        .pharmacy-prescription-title h3 {
          margin: 0;
          font-size: 16px;
          overflow-wrap: anywhere;
        }

        .pharmacy-prescription-title p {
          margin: 4px 0 0;
          color: #81908b;
          font-size: 12px;
        }

        .pharmacy-status {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .pharmacy-status-authorized {
          background: #fff4dd;
          color: #956416;
        }

        .pharmacy-status-dispensed {
          background: #e7f6ec;
          color: #247348;
        }

        .pharmacy-status-other {
          background: #eef1f2;
          color: #566763;
        }

        .pharmacy-details-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          padding: 18px 0;
          border-bottom: 1px solid #edf0ed;
        }

        .pharmacy-detail {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .pharmacy-detail span,
        .pharmacy-quantity span {
          color: #7d8b86;
          font-size: 12px;
        }

        .pharmacy-detail strong {
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .pharmacy-medication-section {
          padding-top: 17px;
        }

        .pharmacy-medication-section h4 {
          margin: 0 0 12px;
          font-size: 14px;
        }

        .pharmacy-medication-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 13px;
          border-radius: 8px;
          background: #f8faf8;
          margin-top: 8px;
        }

        .pharmacy-medication-main {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .pharmacy-medication-main strong {
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .pharmacy-medication-main span {
          font-size: 12px;
          color: #72817b;
        }

        .pharmacy-quantity {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          padding-left: 12px;
        }

        .pharmacy-quantity strong {
          font-size: 19px;
        }

        .pharmacy-dispense-panel {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 18px;
          padding-top: 17px;
          border-top: 1px solid #edf0ed;
        }

        .pharmacy-quantity-label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #50645d;
          font-size: 12px;
          font-weight: 600;
        }

        .pharmacy-quantity-input {
          width: 120px;
          min-height: 42px;
          box-sizing: border-box;
          padding: 9px 11px;
          color: #263f38;
          background: #fff;
          border: 1px solid #d6e0da;
          border-radius: 7px;
          font: inherit;
        }

        .pharmacy-quantity-input:focus {
          outline: 2px solid #b9dcd0;
          border-color: #438a76;
        }

        .pharmacy-empty-state {
          display: flex;
          align-items: center;
          flex-direction: column;
          text-align: center;
          padding: 45px 20px;
          color: #71817b;
        }

        .pharmacy-empty-icon {
          width: 58px;
          height: 58px;
          background: #edf6f1;
          color: #347a64;
          border-radius: 50%;
          margin-bottom: 12px;
        }

        .pharmacy-empty-state h3 {
          margin: 5px 0 8px;
          color: #2a4840;
          font-size: 17px;
        }

        .pharmacy-empty-state p {
          max-width: 480px;
          margin: 0 0 18px;
          font-size: 13px;
          line-height: 1.7;
        }

        .pharmacy-spin {
          animation: pharmacy-rotate 1s linear infinite;
        }

        @keyframes pharmacy-rotate {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 760px) {
          .pharmacy-page { padding: 16px; }
          .pharmacy-header { flex-direction: column; }
          .pharmacy-stats { grid-template-columns: 1fr; gap: 10px; }
          .pharmacy-details-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .pharmacy-list-section { padding: 15px; }
          .pharmacy-prescription-card { padding: 15px; }
          .pharmacy-section-heading {
            align-items: flex-start;
            flex-direction: column;
          }
          .pharmacy-dispense-panel {
            align-items: stretch;
            flex-direction: column;
          }
          .pharmacy-quantity-input { width: 100%; }
          .pharmacy-dispense-panel .pharmacy-button { width: 100%; }
        }
      `}</style>
    </main>
  );
}
