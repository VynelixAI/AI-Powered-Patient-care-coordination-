import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, AlertCircle, ArrowRight, ChevronRight, ClipboardList, Clock3, FileText, Sparkles } from 'lucide-react';
import type { DemoState, Patient, Visit } from '../types';
import { Button, Badge, Card, PageTitle, Detail } from '../components/ui';
import { formatDate, patientForVisit, latestVisits } from '../utils/clinical';
import { generateVisitAssessment } from '../services/backendApi';
import { addAudit, updateVisit } from '../services/mockApi';

export function AssessmentPage({
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
  const location = useLocation();
  const requestedVisit = new URLSearchParams(location.search).get('visit');
  const initialVisit = latestVisits(state).find(({ visit }) => visit.id === requestedVisit)
    ?? latestVisits(state).find(({ visit }) => visit.status !== 'Completed')
    ?? latestVisits(state)[0];
  const [selectedId, setSelectedId] = useState(initialVisit?.visit.id ?? '');
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    const availableVisitIds = latestVisits(state).map(({ visit: item }) => item.id);
    if (requestedVisit && availableVisitIds.includes(requestedVisit)) {
      setSelectedId(requestedVisit);
      return;
    }
    setSelectedId((current) => availableVisitIds.includes(current) ? current : availableVisitIds[0] ?? '');
  }, [requestedVisit, state.patients]);
  const visitPatient = patientForVisit(state, selectedId);
  const visit = visitPatient?.visits.find((item) => item.id === selectedId);
  const process = async () => {
    if (!visit || !visitPatient) return;
    setProcessing(true);
    if (backendMode) {
      try {
        const assessment = await generateVisitAssessment(visit.id);
        setState((current) => updateVisit(current, visit.id, { assessment }));
        await onRefresh();
      } catch (error) {
        onError(error);
      } finally {
        setProcessing(false);
      }
      return;
    }
    window.setTimeout(() => {
      const updated = updateVisit(state, visit.id, { assessment: {
        summary: `Simulated review of ${visit.complaint.toLowerCase()}. Clinician assessment is required before any care decision.`,
        historicalContext: `${visitPatient.conditions.length ? visitPatient.conditions.join(', ') : 'No ongoing conditions recorded'} in the available demo history. ${visitPatient.visits.length - 1} prior visit(s) are available for context.`,
        riskIndicators: visitPatient.allergies.length ? [`Recorded allergy: ${visitPatient.allergies.join(', ')}`, 'Confirm current medication and allergy information with the patient'] : ['Confirm current medication and allergy information with the patient'],
        recommendedPathway: visit.priority === 'High' || visit.priority === 'Urgent' ? 'Clinician review is recommended promptly based on the recorded visit priority.' : 'Clinician review to determine the appropriate next step.',
        createdAt: new Date().toISOString(), status: 'Simulated — clinician review required', evidenceReferences: [],
      } });
      setState(addAudit(updated, 'AI assessment generated', 'Simulated decision support', 'A mock assessment summary was generated for clinician review.', visit.id));
      setProcessing(false);
    }, 900);
  };
  return <>
    <PageTitle eyebrow="CLINICAL DECISION SUPPORT" title="AI clinical assessment" description="Bring current visit information together with available patient history." action={<Badge tone="blue"><Sparkles size={13} /> SIMULATED DECISION SUPPORT</Badge>} />
    <div className="assessment-toolbar"><label className="select-labeled"><span>Assessment visit</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{latestVisits(state).map(({ patient, visit: item }) => <option key={item.id} value={item.id}>{patient.name} Â· {item.complaint} ({item.id})</option>)}</select></label>{visit && <Link to={`/visits/${visit.id}`} className="text-link">Visit details <ArrowRight size={14} /></Link>}</div>
    {visit && visitPatient ? <>
      <div className="evidence-grid"><EvidenceCard title="Current visit evidence" icon={<Activity size={18} />}><Detail label="Presenting problem" value={visit.complaint} /><Detail label="Symptoms" value={visit.symptoms} /><Detail label="Onset" value={visit.onset} /><Detail label="Clinician notes" value={visit.notes || 'None recorded'} /><div className="evidence-subhead">Current observations</div>{visit.observations.length ? visit.observations.map((observation) => <div className="observation-row" key={observation.id}><span>{observation.label}</span><strong>{observation.value} <small>{observation.unit}</small></strong></div>) : <div className="empty-inline">No observations provided for this visit.</div>}<div className="evidence-subhead">Current reports</div>{visit.documents.length ? visit.documents.map((doc) => <div className="evidence-doc" key={doc.id}><FileText size={15} /><span>{doc.name}</span><Badge tone="neutral">Selected Â· not analysed</Badge></div>) : <div className="empty-inline">No reports attached to this visit.</div>}</EvidenceCard>
      <EvidenceCard title="Historical evidence" icon={<Clock3 size={18} />}><Detail label="Medical conditions" value={visitPatient.conditions.join(', ') || 'None recorded'} /><Detail label="Allergies" value={visitPatient.allergies.join(', ') || 'None recorded'} /><Detail label="Current medications" value={visitPatient.medications.join(', ') || 'None recorded'} /><div className="evidence-subhead">Previous visits</div>{visitPatient.visits.filter((item) => item.id !== visit.id).length ? visitPatient.visits.filter((item) => item.id !== visit.id).map((item) => <div className="history-row" key={item.id}><span className="history-date">{formatDate(item.date, { day: 'numeric', month: 'short' })}</span><span><strong>{item.complaint}</strong><small>{item.outcome || item.status}</small></span><Link to={`/visits/${item.id}`} aria-label={`Open previous visit ${item.id}`}><ChevronRight size={15} /></Link></div>) : <div className="empty-inline">No previous visits are available.</div>}<div className="evidence-subhead">Compare current and previous</div><p className="evidence-note">Only equivalent recorded measures can be compared. Current visit values are shown alongside prior observations where available.</p><ComparisonRows patient={visitPatient} visit={visit} /></EvidenceCard></div>
      <Card className="assessment-card"><div className="card-heading"><div><span className="eyebrow">ASSESSMENT SUMMARY</span><h2>Simulated clinical assessment</h2><p>This demonstration does not diagnose, establish clinical validity, or replace clinician judgement.</p></div><Button disabled={processing || (backendMode && visit.status === 'Completed')} onClick={() => void process()}><Sparkles size={16} />{processing ? 'Processing demoâ€¦' : visit.assessment ? 'Run again' : 'Generate assessment'}</Button></div>
        <div className="process-steps">{['Collect current visit', 'Retrieve available history', 'Compare recorded measures', 'Summarise for clinician'].map((step, index) => <div className="process-step" key={step}><span>{processing && index < 3 ? <span className="loader" /> : index + 1}</span><small>{step}</small></div>)}</div>
            {visit.assessment ? <div className="assessment-result"><div className="result-header"><Badge tone="blue">{visit.assessment.status}</Badge><span>Generated {formatDate(visit.assessment.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></div><div className="result-grid"><div><h3>Presenting problem</h3><p>{visit.assessment.summary}</p></div><div><h3>Historical context</h3><p>{visit.assessment.historicalContext}</p></div><div><h3>Potential considerations</h3><ul>{visit.assessment.riskIndicators.map((risk) => <li key={risk}>{risk}</li>)}</ul></div><div><h3>Care pathway for clinician consideration</h3><p>{visit.assessment.recommendedPathway}</p></div></div>{visit.assessment.evidenceReferences.length > 0 && <div className="assessment-evidence"><h3>Evidence references</h3>{visit.assessment.evidenceReferences.map((reference) => <div className="observation-row" key={reference.sourceRecordId}><span>{reference.sourceRecordId}{reference.visitId ? ` Â· ${reference.visitId}` : ''}</span><strong>{reference.verificationStatus} Â· {formatDate(reference.date)}</strong></div>)}</div>}<div className="notice-box notice-wide"><AlertCircle size={17} /><span>No confidence score is provided. Uploaded document contents have not been extracted or analysed. Verify all information with the patient and source records.</span></div><Link to="/doctor-review" className="button button-primary">Continue to doctor review <ArrowRight size={15} /></Link></div> : <div className="empty-state assessment-empty"><Sparkles size={26} /><strong>Ready to bring the evidence together?</strong><span>Generate a simulated summary based on recorded visit and history fields. It is not a diagnosis.</span></div>}
      </Card>
    </> : <div className="empty-state"><ClipboardList /><strong>No visit available</strong><span>Open a patient visit before starting an assessment.</span><Link to="/patients" className="button button-secondary">Find a patient</Link></div>}
  </>;
}
function EvidenceCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <Card className="evidence-card"><div className="card-heading"><div className="evidence-title-icon">{icon}</div><div><h2>{title}</h2><p>Only available demo record information</p></div></div>{children}</Card>; }
function ComparisonRows({ patient, visit }: { patient: Patient; visit: Visit }) {
  const past = patient.visits.filter((item) => item.id !== visit.id).flatMap((item) => item.observations);
  const current = visit.observations;
  const paired = current.map((item) => ({ current: item, previous: past.find((candidate) => candidate.label === item.label && candidate.unit === item.unit) })).filter((item) => item.previous);
  return paired.length ? paired.map(({ current: now, previous }) => <div className="comparison-row" key={now.id}><span>{now.label}</span><strong>{now.value} {now.unit}</strong><small>Previous: {previous?.value} {previous?.unit}</small></div>) : <div className="empty-inline">No equivalent current and previous measurements are available for comparison.</div>;
}
