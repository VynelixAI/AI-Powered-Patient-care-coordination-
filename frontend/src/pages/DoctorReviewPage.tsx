import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Stethoscope } from 'lucide-react';
import type { DemoState, Priority } from '../types';
import { Button, Badge, Card, Detail, Field, PageTitle } from '../components/ui';
import { ageFromDob, latestVisits, patientForVisit, priorityTone } from '../utils/clinical';
import { saveClinicalDecision } from '../services/backendApi';
import { addAudit, priorities, updateVisit } from '../services/mockApi';

const destinations = ['Emergency Department', 'General Medicine', 'Cardiology', 'Neurology', 'Respiratory Medicine', 'Endocrinology', 'General Practice / GP', 'Other Specialist'];

export function DoctorReviewPage({ state, setState, backendMode, onRefresh, onError }: {
  state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; backendMode: boolean;
  onRefresh: () => Promise<void>; onError: (error: unknown) => void;
}) {
  const navigate = useNavigate();
  const candidates = latestVisits(state).filter(({ visit }) => visit.status !== 'Completed');
  const [visitId, setVisitId] = useState(candidates[0]?.visit.id ?? '');
  const [decision, setDecision] = useState<'Approved' | 'Modified' | 'Overridden'>('Approved');
  const [priority, setPriority] = useState<Priority>('Standard');
  const [destination, setDestination] = useState('General Medicine');
  const [rationale, setRationale] = useState('');
  const [impression, setImpression] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const patient = patientForVisit(state, visitId);
  const visit = patient?.visits.find((item) => item.id === visitId);

  useEffect(() => { const ids = candidates.map(({ visit: item }) => item.id); setVisitId((current) => ids.includes(current) ? current : ids[0] ?? ''); }, [state.patients]);
  useEffect(() => { if (visit) { setPriority(visit.doctorReview?.priority ?? visit.priority); setDestination(visit.doctorReview?.destination ?? 'General Medicine'); setRationale(visit.doctorReview?.reason ?? ''); } }, [visitId]);
  const save = async () => {
    if (!visit || !patient || saving) return;
    if (decision !== 'Approved' && rationale.trim().length < 5) { setMessage('Provide a rationale when modifying or overriding a decision.'); return; }
    try {
      setSaving(true); setMessage('');
      if (backendMode) { await saveClinicalDecision(visit.id, decision, priority, destination, rationale.trim(), impression.trim(), treatmentPlan.trim()); await onRefresh(); }
      else {
        const review = { decision, priority, destination, ...(rationale.trim() ? { reason: rationale.trim() } : {}), reviewedAt: new Date().toISOString() };
        setState((current) => addAudit(updateVisit(current, visit.id, { doctorReview: review, priority, status: 'In progress' }), 'Clinical decision saved', 'Clinician', 'Manual clinical decision and treatment plan were saved.', visit.id));
      }
      setMessage('Clinical decision saved. You can now create a referral or continue to care routing.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save the clinical decision.'); onError(error); } finally { setSaving(false); }
  };
  if (!visit || !patient) return <><PageTitle eyebrow="CLINICIAN WORKSPACE" title="Doctor review" description="Record an independent manual clinical decision." /><div className="empty-state"><Stethoscope /><strong>No active visits</strong><span>Open a patient visit before recording a decision.</span></div></>;
  return <>
    <PageTitle eyebrow="CLINICIAN WORKSPACE" title="Doctor review" description="Record an independent clinical decision; no AI assessment is required." />
    <div className="assessment-toolbar"><label className="select-labeled"><span>Visit for review</span><select value={visitId} onChange={(event) => setVisitId(event.target.value)}>{candidates.map(({ patient: person, visit: item }) => <option value={item.id} key={item.id}>{person.name} · {item.complaint} ({item.id})</option>)}</select></label></div>
    <div className="review-grid"><div className="review-evidence"><Card><div className="card-heading"><div><h2>Patient and visit</h2><p>{patient.name} · {patient.id} · {ageFromDob(patient.dateOfBirth)} years</p></div><Link to={`/visits/${visit.id}`} className="text-link">Open visit <ArrowRight size={14} /></Link></div><Detail label="Complaint" value={visit.complaint} /><Detail label="Symptoms" value={visit.symptoms} /><Detail label="Examination" value={visit.examinationFindings || 'Not recorded'} /><Detail label="Consultation notes" value={visit.consultationNotes || 'Not recorded'} /></Card><Card><h2>Relevant history</h2><Detail label="Conditions" value={patient.conditions.join(', ') || 'None recorded'} /><Detail label="Allergies" value={patient.allergies.join(', ') || 'None recorded'} /><Detail label="Current medications" value={patient.medications.join(', ') || 'None recorded'} /></Card></div>
      <Card className="decision-card"><span className="eyebrow">MANUAL CLINICAL DECISION</span><h2>Decision and treatment plan</h2><div className="decision-options">{(['Approved', 'Modified', 'Overridden'] as const).map((value) => <button key={value} className={`decision-option ${decision === value ? 'decision-active' : ''}`} onClick={() => setDecision(value)}><span className="radio-indicator">{decision === value && <i />}</span><strong>{value}</strong></button>)}</div><div className="form-grid"><Field label="Final priority"><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Care destination"><select value={destination} onChange={(event) => setDestination(event.target.value)}>{destinations.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Clinical impression" optional className="field-full"><textarea rows={2} value={impression} onChange={(event) => setImpression(event.target.value)} /></Field><Field label="Rationale" required={decision !== 'Approved'} className="field-full"><textarea rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} /></Field><Field label="Treatment / management plan" optional className="field-full"><textarea rows={3} value={treatmentPlan} onChange={(event) => setTreatmentPlan(event.target.value)} /></Field></div><Button disabled={saving} onClick={() => void save()}><CheckCircle2 size={16} />{saving ? 'Saving…' : 'Save clinical decision'}</Button>{message && <div className="notice-box" role="status">{message}</div>}{visit.doctorReview && <Badge tone={priorityTone(visit.doctorReview.priority)}>Previously saved: {visit.doctorReview.destination}</Badge>}{visit.doctorReview && <Button variant="secondary" onClick={() => navigate('/care-routing')}>Continue to referral and routing <ArrowRight size={16} /></Button>}</Card></div>
  </>;
}
