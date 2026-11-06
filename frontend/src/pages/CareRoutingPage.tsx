
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
} from 'lucide-react';

import type { DemoState } from '../types';
import {
  Button,
  Badge,
  Card,
  PageTitle,
  Detail,
} from '../components/ui';
import {
  formatDate,
  patientForVisit,
  latestVisits,
  statusTone,
} from '../utils/clinical';
import {
  createVisitRoute,
  createSpecialistReferral,
  fetchReferrals,
  changeReferralStatus,
  saveSpecialistConsultation,
  
  type SpecialistConsultation,
  type ReferralRecord,
  type ReferralStatus,
} from '../services/backendApi';
import { addAudit, updateVisit } from '../services/mockApi';

type ReferralPriority = 'LOW' | 'STANDARD' | 'HIGH' | 'URGENT';

export function CareRoutingPage({
  state,
  setState,
  backendMode,
  onRefresh,
  onError,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  backendMode: boolean;
  onRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const candidates = latestVisits(state).filter(({ visit }) =>
    backendMode
      ? Boolean(visit.doctorReview)
      : Boolean(visit.doctorReview || visit.careRoute),
  );

  const [visitId, setVisitId] = useState(
    candidates[0]?.visit.id ?? '',
  );
  const [confirmed, setConfirmed] = useState(false);
  const [routing, setRouting] = useState(false);
const [referralUpdating, setReferralUpdating] = useState(false);
  const [specialty, setSpecialty] = useState('Neurology');
  const [referralPriority, setReferralPriority] =
    useState<ReferralPriority>('STANDARD');
  const [referralReason, setReferralReason] = useState('');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [referralSaving, setReferralSaving] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');
  const [createdReferral, setCreatedReferral] =
    useState<ReferralRecord | null>(null);
  const [savedReferral, setSavedReferral] =
  useState<ReferralRecord | null>(null);

const [consultation, setConsultation] =
  useState<SpecialistConsultation | null>(null);

const [examinationFindings, setExaminationFindings] =
  useState('');

const [consultationNotes, setConsultationNotes] =
  useState('');

const [clinicalImpression, setClinicalImpression] =
  useState('');

const [recommendations, setRecommendations] =
  useState('');

const [followUpInstructions, setFollowUpInstructions] =
  useState('');

const [consultationSaving, setConsultationSaving] =
  useState(false);

const [consultationMessage, setConsultationMessage] =
  useState('');


  const patient = patientForVisit(state, visitId);
  const visit = patient?.visits.find((item) => item.id === visitId);

  useEffect(() => {
  if (!backendMode || !visitId || !patient?.id) {
    setSavedReferral(null);
    return;
  }

  let cancelled = false;

  const loadReferral = async () => {
    try {
      const referrals = await fetchReferrals(patient.id);

      if (cancelled) return;

      const existing = referrals.find(
        (referral) => referral.visit_id === visitId,
      );

      setSavedReferral(existing ?? null);
    } catch (error) {
      if (!cancelled) onError(error);
    }
  };

  void loadReferral();

  return () => {
    cancelled = true;
  };
}, [backendMode, visitId, patient?.id, onError]);

  useEffect(() => {
    const availableVisits = candidates.map(
      ({ visit: item }) => item.id,
    );

    setVisitId((current) =>
      availableVisits.includes(current)
        ? current
        : availableVisits[0] ?? '',
    );
  }, [state.patients]);

  useEffect(() => {
    setConfirmed(false);
    setReferralMessage('');
    setCreatedReferral(null);
  }, [visitId]);

  const routePatient = async () => {
    if (!visit || !patient || routing) return;

    const route = {
      destination:
        visit.doctorReview?.destination ??
        visit.careRoute?.destination ??
        'General Medicine',
      priority:
        visit.doctorReview?.priority ?? visit.priority,
      status: 'Routed' as const,
      assignedClinician: 'Dr Amelia Ward',
      routedAt: new Date().toISOString(),
    };

    if (backendMode) {
      setRouting(true);

      try {
        await createVisitRoute(visit.id, route.destination);
        await onRefresh();
        setConfirmed(true);
      } catch (error) {
        onError(error);
      } finally {
        setRouting(false);
      }

      return;
    }

    const updated = updateVisit(state, visit.id, {
      careRoute: route,
      status: 'Routed',
    });

    setState(
      addAudit(
        updated,
        'Care route confirmed',
        'Triage team',
        `Visit routed to ${route.destination}; this is a simulated destination.`,
        visit.id,
      ),
    );

    setConfirmed(true);
  };

  const submitReferral = async () => {
    if (!visit || !patient || referralSaving) return;

    if (!referralReason.trim()) {
      setReferralMessage('Please enter a referral reason.');
      return;
    }

    setReferralSaving(true);
    setReferralMessage('');
    setCreatedReferral(null);

    try {
      const referral = await createSpecialistReferral(
        visit.id,
        {
          destination_specialty: specialty,
          priority: referralPriority,
          reason: referralReason.trim(),
          clinical_summary: clinicalSummary.trim() || null,
        },
      );

      setCreatedReferral(referral);
      setReferralMessage(
        'Specialist referral created successfully.',
      );

      await onRefresh();
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Unable to create the referral.';

      setReferralMessage(`Referral failed: ${detail}`);
      onError(error);
    } finally {
      setReferralSaving(false);
    }
  };
const updateReferralStatus = async (status: ReferralStatus) => {
  const referral = savedReferral ?? createdReferral;

  if (!backendMode || !referral || referralUpdating) return;

  setReferralUpdating(true);
  setReferralMessage('');

  try {
    const updated = await changeReferralStatus(referral.id, status);

    setSavedReferral(updated);
    setCreatedReferral(updated);
    setReferralMessage(`Referral status updated to ${updated.status}.`);

    await onRefresh();
  } catch (error) {
    onError(error);
  } finally {
    setReferralUpdating(false);
  }
};


const saveConsultation = async () => {
  const referral = savedReferral ?? createdReferral;

  if (!referral || consultationSaving) return;

  setConsultationSaving(true);
  setConsultationMessage('');

  try {
    const result = await saveSpecialistConsultation(
      referral.id,
      {
        examination_findings: examinationFindings,
        consultation_notes: consultationNotes,
        clinical_impression: clinicalImpression,
        recommendations,
        follow_up_instructions: followUpInstructions,
      },
    );

    setConsultation(result);
    setConsultationMessage(
      'Specialist consultation saved successfully.',
    );

    await onRefresh();
  } catch (error) {
    setConsultationMessage(
      error instanceof Error
        ? error.message
        : 'Unable to save consultation.',
    );
    onError(error);
  } finally {
    setConsultationSaving(false);
  }
};


  return (
    <>
      <PageTitle
        eyebrow="CARE COORDINATION"
        title="Care routing"
        description="Confirm a clinician-approved destination and manage specialist referrals."
        action={
          <Badge tone={backendMode ? 'green' : 'blue'}>
            {backendMode ? 'BACKEND MODE' : 'MOCK ROUTING'}
          </Badge>
        }
      />

      {candidates.length > 0 ? (
        <>
          <div className="assessment-toolbar">
            <label className="select-labeled">
              <span>Visit to route</span>
              <select
                value={visitId}
                onChange={(event) =>
                  setVisitId(event.target.value)
                }
              >
                {candidates.map(({ patient: person, visit: item }) => (
                  <option value={item.id} key={item.id}>
                    {person.name} · {item.complaint}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {visit && patient && (
            <>
              <div className="routing-grid">
                <Card className="routing-main">
                  <div className="route-patient-header">
                    <div className="patient-mini">
                      <div className="avatar avatar-small">
                        {patient.name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')}
                      </div>

                      <span>
                        <strong>{patient.name}</strong>
                        <small>
                          {patient.id} · Visit {visit.id}
                        </small>
                      </span>
                    </div>

                    <Badge
                      tone={statusTone(
                        visit.careRoute?.status ?? 'Ready to route',
                      )}
                    >
                      {visit.careRoute?.status ?? 'Ready to route'}
                    </Badge>
                  </div>

                  <div className="route-detail-grid">
                    <Detail
                      label="Presenting complaint"
                      value={visit.complaint}
                    />
                    <Detail
                      label="Clinician-approved priority"
                      value={
                        visit.doctorReview?.priority ??
                        visit.priority
                      }
                    />
                    <Detail
                      label="Approved destination"
                      value={
                        visit.doctorReview?.destination ??
                        visit.careRoute?.destination ??
                        'Not reviewed'
                      }
                    />
                    <Detail
                      label="Clinician review"
                      value={
                        visit.doctorReview
                          ? `${visit.doctorReview.decision} · ${formatDate(
                              visit.doctorReview.reviewedAt,
                            )}`
                          : 'Not yet recorded'
                      }
                    />
                  </div>

                  {visit.doctorReview?.reason && (
                    <div className="route-reason">
                      <strong>Clinician note</strong>
                      <p>{visit.doctorReview.reason}</p>
                    </div>
                  )}

                  {visit.careRoute?.status === 'Routed' ? (
                    <div className="route-success">
                      <CheckCircle2 size={20} />
                      <span>
                        <strong>Route confirmed</strong>
                        <small>
                          {visit.careRoute.destination} ·{' '}
                          {visit.careRoute.assignedClinician} ·{' '}
                          {formatDate(
                            visit.careRoute.routedAt ?? visit.date,
                          )}
                        </small>
                      </span>
                    </div>
                  ) : (
                    <div className="route-confirm-box">
                      <div>
                        <h3>Confirm care pathway</h3>
                        <p>
                          {backendMode
                            ? 'This saves the routing record in the backend. It does not contact a hospital or verify clinician availability.'
                            : 'This records a simulated route in the browser. It does not contact a hospital or verify clinician availability.'}
                        </p>
                      </div>

                      <Button
                        disabled={routing}
                        onClick={() => void routePatient()}
                      >
                        {routing ? (
                          <Activity size={16} />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                        {routing ? 'Saving…' : 'Confirm routing'}
                      </Button>
                    </div>
                  )}

                  {confirmed && (
                    <div
                      className="success-message route-message"
                      role="status"
                    >
                      <CheckCircle2 size={16} />
                      {backendMode
                        ? 'Routing record saved in the backend.'
                        : 'Routing recorded in this browser.'}
                    </div>
                  )}
                </Card>

                <Card className="route-history-card">
                  <div className="card-heading">
                    <div>
                      <h2>Routing timeline</h2>
                      <p>
                        {backendMode
                          ? 'Backend workflow record'
                          : 'Demo route history'}
                      </p>
                    </div>
                  </div>

                  <div className="route-timeline">
                    <div className="route-step done">
                      <span>
                        <Check size={13} />
                      </span>
                      <div>
                        <strong>Visit opened</strong>
                        <small>{formatDate(visit.date)}</small>
                      </div>
                    </div>

                    <div
                      className={`route-step ${
                        visit.doctorReview ? 'done' : ''
                      }`}
                    >
                      <span>
                        {visit.doctorReview ? (
                          <Check size={13} />
                        ) : (
                          '2'
                        )}
                      </span>
                      <div>
                        <strong>Clinician decision</strong>
                        <small>
                          {visit.doctorReview
                            ? `${visit.doctorReview.decision} · ${formatDate(
                                visit.doctorReview.reviewedAt,
                              )}`
                            : 'Awaiting review'}
                        </small>
                      </div>
                    </div>

                    <div
                      className={`route-step ${
                        visit.careRoute?.status === 'Routed'
                          ? 'done'
                          : ''
                      }`}
                    >
                      <span>
                        {visit.careRoute?.status === 'Routed' ? (
                          <Check size={13} />
                        ) : (
                          '3'
                        )}
                      </span>
                      <div>
                        <strong>Destination confirmed</strong>
                        <small>
                          {visit.careRoute?.routedAt
                            ? formatDate(visit.careRoute.routedAt)
                            : 'Not yet routed'}
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="notice-box">
                    <AlertCircle size={16} />
                    <span>
                      Synthetic assignments only. No real hospital
                      or doctor availability is checked.
                    </span>
                  </div>
                </Card>
              </div>

              <Card>
                <h2>Create Specialist Referral</h2>
                <p>
                  Create a referral linked to the selected patient
                  and visit. This is separate from care routing.
                </p>

                {!backendMode && (
                  <div className="notice-box" role="status">
                    Switch to backend mode to create a persistent
                    specialist referral. The referral API is not
                    called in mock mode.
                  </div>
                )}

                <div className="form-grid">
                  <label className="select-labeled">
                    <span>Destination specialty</span>
                    <select
                      value={specialty}
                      disabled={referralSaving}
                      onChange={(event) =>
                        setSpecialty(event.target.value)
                      }
                    >
                      <option value="Neurology">Neurology</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="General Medicine">
                        General Medicine
                      </option>
                      <option value="Orthopedics">Orthopedics</option>
                    </select>
                  </label>

                  <label className="select-labeled">
                    <span>Referral priority</span>
                    <select
                      value={referralPriority}
                      disabled={referralSaving}
                      onChange={(event) =>
                        setReferralPriority(
                          event.target.value as ReferralPriority,
                        )
                      }
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="LOW">Low</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>Referral reason</span>
                  <textarea
                    rows={3}
                    value={referralReason}
                    disabled={referralSaving}
                    onChange={(event) =>
                      setReferralReason(event.target.value)
                    }
                    placeholder="Enter the reason for referral..."
                  />
                </label>

                <label className="field">
                  <span>Clinical summary (optional)</span>
                  <textarea
                    rows={3}
                    value={clinicalSummary}
                    disabled={referralSaving}
                    onChange={(event) =>
                      setClinicalSummary(event.target.value)
                    }
                    placeholder="Enter a summary of documented clinical findings..."
                  />
                </label>

                <div className="form-actions">
                  <Button
                    disabled={
                      !backendMode ||
                      referralSaving ||
                      !referralReason.trim()
                    }
                    onClick={() => void submitReferral()}
                  >
                    {referralSaving
                      ? 'Saving referral…'
                      : 'Create specialist referral'}
                  </Button>
                </div>

                {referralMessage && (
                  <div
                    className={
                      createdReferral
                        ? 'success-message'
                        : 'notice-box'
                    }
                    role="status"
                  >
                    {referralMessage}
                  </div>
                )}

               {(savedReferral ?? createdReferral) && (
  <>
    <label className="select-labeled">
      <span>Update referral status</span>
      <select
        value={(savedReferral ?? createdReferral)!.status}
        disabled={!backendMode || referralUpdating}
        onChange={(event) =>
          void updateReferralStatus(
            event.target.value as ReferralStatus,
          )
        }
      >
        <option value="PENDING">Pending</option>
        <option value="ACCEPTED">Accepted</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
    </label>

    {referralUpdating && (
      <p role="status">Updating referral status...</p>
    )}

    <div className="route-detail-grid">
      <Detail
        label="Referral ID"
        value={(savedReferral ?? createdReferral)!.id}
      />
      <Detail
        label="Specialty"
        value={(savedReferral ?? createdReferral)!.destination_specialty}
      />
      <Detail
        label="Status"
        value={(savedReferral ?? createdReferral)!.status}
      />
      <Detail
        label="Priority"
        value={(savedReferral ?? createdReferral)!.priority}
      />
    </div>

<div className="consultation-section">
  <h3>Specialist Consultation</h3>
  <p>Record and save the specialist's consultation details.</p>

  <label className="field">
    <span>Examination findings</span>
    <textarea
      rows={3}
      value={examinationFindings}
      onChange={(e) => setExaminationFindings(e.target.value)}
      placeholder="Enter examination findings..."
    />
  </label>

  <label className="field">
    <span>Consultation notes</span>
    <textarea
      rows={3}
      value={consultationNotes}
      onChange={(e) => setConsultationNotes(e.target.value)}
      placeholder="Enter consultation notes..."
    />
  </label>

  <label className="field">
    <span>Clinical impression</span>
    <textarea
      rows={2}
      value={clinicalImpression}
      onChange={(e) => setClinicalImpression(e.target.value)}
      placeholder="Enter clinical impression..."
    />
  </label>

  <label className="field">
    <span>Recommendations</span>
    <textarea
      rows={2}
      value={recommendations}
      onChange={(e) => setRecommendations(e.target.value)}
      placeholder="Enter recommendations..."
    />
  </label>

  <label className="field">
    <span>Follow-up instructions</span>
    <textarea
      rows={2}
      value={followUpInstructions}
      onChange={(e) => setFollowUpInstructions(e.target.value)}
      placeholder="Enter follow-up instructions..."
    />
  </label>

  <div className="form-actions">
    <Button
      disabled={
        !backendMode ||
        consultationSaving ||
        !(savedReferral ?? createdReferral)
      }
      onClick={() => void saveConsultation()}
    >
      {consultationSaving ? "Saving..." : "Save consultation"}
    </Button>
  </div>

  {consultationMessage && (
    <div className="success-message" role="status">
      {consultationMessage}
    </div>
  )}

  {consultation && (
    <p>Consultation saved. ID: {consultation.id}</p>
  )}
</div>

  </>
)}
              </Card>
            </>
          )}
        </>
      ) : (
        <div className="empty-state">
          <ArrowRight size={24} />
          <strong>No clinician-reviewed visit to route</strong>
          <span>
            Record a doctor review first to enable care routing.
          </span>
          <Link
            to="/doctor-review"
            className="button button-primary"
          >
            Go to doctor review <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </>
  );
}
