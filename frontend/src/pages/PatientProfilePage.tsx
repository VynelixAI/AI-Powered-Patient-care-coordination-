import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Activity, AlertCircle, ArrowRight, CheckCircle2, FileText, HeartPulse, Plus, Sparkles, Download } from 'lucide-react';
import type { DemoState, Patient } from '../types';
import { Button, Badge, Card, Detail } from '../components/ui';
import { ageFromDob, formatDate, priorityTone, statusTone } from '../utils/clinical';
import { downloadMedicalDocument, fetchPatientDocuments } from '../services/backendApi';
import { NotFound } from './NotFound';
import { ActivityList } from './Dashboard';
import { TrendsPanel } from './TrendsPage';
import { formatSize } from './VisitDetailsPage';

export function PatientProfilePage({
  state,
  backendMode,
  onError,
  onStartVisit,
}: {
  state: DemoState;
  backendMode: boolean;
  onError: (error: unknown) => void;
  onStartVisit: (id: string) => void;
}) {
  const location = useLocation();
  const { patientId = '' } = useParams();
  const patient = state.patients.find((item) => item.id === patientId);
  const [tab, setTab] = useState('Overview');
  const [backendDocuments, setBackendDocuments] = useState<Patient['visits'][number]['documents']>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState('');
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [documentsReloadKey, setDocumentsReloadKey] = useState(0);
  useEffect(() => {
    if (!backendMode || tab !== 'Medical documents' || !patientId) return;
    let active = true;
    setDocumentsLoading(true);
    setDocumentsError('');
    setDocumentsLoaded(false);
    fetchPatientDocuments(patientId)
      .then((items) => {
        if (active) {
          setBackendDocuments(items);
          setDocumentsLoaded(true);
        }
      })
      .catch((error: unknown) => {
        if (active) setDocumentsError(error instanceof Error ? error.message : 'Unable to load patient documents.');
      })
      .finally(() => {
        if (active) setDocumentsLoading(false);
      });
    return () => { active = false; };
  }, [backendMode, documentsReloadKey, patientId, tab]);
  if (!patient) return <NotFound />;
  const routeState = location.state as { unpersistedDocumentCount?: unknown } | null;
  const unpersistedDocumentCount = typeof routeState?.unpersistedDocumentCount === 'number'
    ? routeState.unpersistedDocumentCount
    : 0;
  const tabs = ['Overview', 'Visit history', 'Medical documents', 'Health trends', 'AI insights', 'Treatments & follow-up', 'Audit history'];
  const documents = backendMode
    ? backendDocuments
    : patient.visits.flatMap((visit) => visit.documents.map((document) => ({ ...document, visitId: visit.id })));
  return <>
    <div className="profile-banner"><div className="profile-identity"><div className="avatar avatar-large">{patient.name.split(' ').map((part) => part[0]).join('')}</div><div><div className="eyebrow">PATIENT PROFILE <span className="profile-divider">/</span> {patient.id}</div><h1>{patient.name}</h1><p>{ageFromDob(patient.dateOfBirth)} years <span>Â·</span> {patient.gender} <span>Â·</span> DOB {formatDate(patient.dateOfBirth)}</p><div className="allergy-line"><AlertCircle size={15} /> Allergies: {patient.allergies.length ? patient.allergies.join(', ') : 'None recorded'}</div></div></div><Button onClick={() => onStartVisit(patient.id)}><Plus size={17} /> Start new visit</Button></div>
    {unpersistedDocumentCount > 0 && <div className="notice-box notice-wide" role="status"><AlertCircle size={17} /><span>Patient saved successfully, but {unpersistedDocumentCount} selected {unpersistedDocumentCount === 1 ? 'report was' : 'reports were'} not saved because mock mode does not store file contents. Switch to backend mode in Settings to upload reports securely.</span></div>}
    <div className="profile-tabs" role="tablist">{tabs.map((item) => <button className={tab === item ? 'selected' : ''} onClick={() => setTab(item)} key={item} role="tab" aria-selected={tab === item}>{item}</button>)}</div>
    {tab === 'Overview' && <div className="profile-grid">
      <div className="profile-main"><Card><div className="card-heading"><div><h2>Medical history</h2><p>Relevant information recorded in this demo</p></div></div><p className="body-copy">{patient.history || 'No relevant history has been recorded.'}</p><div className="data-columns"><DataGroup label="Known conditions" values={patient.conditions} /><DataGroup label="Current medications" values={patient.medications} /><DataGroup label="Allergies" values={patient.allergies} /></div></Card><Card><div className="card-heading"><div><h2>Recent visits</h2><p>Longitudinal visit history</p></div><button className="text-link button-link" onClick={() => setTab('Visit history')}>View history <ArrowRight size={15} /></button></div><VisitTimeline patient={patient} /></Card></div>
      <div className="profile-side"><Card><div className="card-heading"><div><h2>Contact details</h2></div></div><Detail label="Phone" value={patient.phone} /><Detail label="Email" value={patient.email || 'Not provided'} /><Detail label="Address" value={patient.address || 'Not provided'} /><Detail label="Emergency contact" value={patient.emergencyContact || 'Not provided'} /></Card><Card><div className="card-heading"><div><h2>Follow-up</h2><p>Open actions from recent visits</p></div></div>{patient.visits.some((visit) => visit.status !== 'Completed') ? patient.visits.filter((visit) => visit.status !== 'Completed').map((visit) => <div className="followup-row" key={visit.id}><span className="followup-dot" /><span><strong>{visit.complaint}</strong><small>{visit.status} Â· {formatDate(visit.date)}</small></span></div>) : <div className="empty-inline">No outstanding follow-up actions.</div>}</Card></div>
    </div>}
    {tab === 'Visit history' && <Card><div className="card-heading"><div><h2>Visit timeline</h2><p>{patient.visits.length} visits recorded</p></div></div><VisitTimeline patient={patient} /></Card>}
    {tab === 'Medical documents' && <Card><div className="card-heading"><div><h2>Medical documents</h2><p>Documents attached to this patientâ€™s visits</p></div></div>{documentsLoading ? <div className="empty-state" role="status"><Activity size={22} /><strong>Loading medical documentsâ€¦</strong></div> : documentsError ? <div className="notice-box registration-error" role="alert"><AlertCircle size={16} /><span>{documentsError}</span><Button variant="secondary" onClick={() => setDocumentsReloadKey((value) => value + 1)}>Retry</Button></div> : documentsLoaded || !backendMode ? documents.length ? <div className="document-list">{documents.map((doc) => <div className="document-row" key={doc.id}><span className="document-icon"><FileText size={18} /></span><span><strong>{doc.name}</strong><small>{doc.contentType || doc.kind} Â· {formatDate(doc.uploadedAt)} Â· {formatSize(doc.size)}</small></span>{doc.visitId && <Link className="text-link" to={`/visits/${doc.visitId}`}>Open visit <ArrowRight size={14} /></Link>}{backendMode && <button className="button button-quiet button-small" onClick={() => void downloadMedicalDocument(doc.id, doc.name).catch(onError)}><Download size={14} /> Download</button>}</div>)}</div> : <div className="empty-state"><FileText size={24} /><strong>No documents yet</strong><span>Uploaded visit documents will appear here.</span></div> : <div className="empty-state" role="status"><Activity size={22} /><strong>Loading medical documentsâ€¦</strong></div>}</Card>}
    {tab === 'Health trends' && <TrendsPanel patient={patient} />}
    {tab === 'AI insights' && <Card><div className="card-heading"><div><h2>Simulated AI insights</h2><p>Decision support is illustrative and requires clinician review.</p></div></div>{patient.visits.filter((visit) => visit.assessment).map((visit) => <div className="assessment-summary" key={visit.id}><Badge tone="blue">{visit.assessment?.status}</Badge><h3>{visit.assessment?.summary}</h3><p>{visit.assessment?.historicalContext}</p><Link to={`/visits/${visit.id}`} className="text-link">View visit evidence <ArrowRight size={14} /></Link></div>)}{!patient.visits.some((visit) => visit.assessment) && <div className="empty-state"><Sparkles size={24} /><strong>No assessment generated</strong><span>Assessments appear here after a visit is processed.</span></div>}</Card>}
    {tab === 'Treatments & follow-up' && <Card><div className="card-heading"><div><h2>Treatments & follow-up</h2><p>Recorded outcomes and next steps</p></div></div>{patient.visits.filter((visit) => visit.outcome || visit.doctorReview).map((visit) => <div className="followup-record" key={visit.id}><strong>{visit.complaint}</strong><small>{formatDate(visit.date)} Â· {visit.id}</small><p>{visit.outcome || `${visit.doctorReview?.decision} recommendation for ${visit.doctorReview?.destination}.`}</p></div>)}{!patient.visits.some((visit) => visit.outcome || visit.doctorReview) && <div className="empty-state"><HeartPulse size={24} /><strong>No treatment records yet</strong><span>Documented outcomes will be listed here.</span></div>}</Card>}
    {tab === 'Audit history' && <Card><div className="card-heading"><div><h2>Patient audit history</h2><p>{backendMode ? 'Authenticated events associated with this record' : 'Demo activity associated with this record'}</p></div></div><ActivityList events={state.audit.filter((event) => event.patientId === patient.id || Boolean(event.visitId && patient.visits.some((visit) => visit.id === event.visitId)))} /></Card>}
  </>;
}
function DataGroup({ label, values }: { label: string; values: string[] }) { return <div className="data-group"><span>{label}</span>{values.length ? values.map((value) => <Badge key={value} tone="neutral">{value}</Badge>) : <small>None recorded</small>}</div>; }
function VisitTimeline({ patient }: { patient: Patient }) {
  return patient.visits.length ? <div className="timeline">{[...patient.visits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((visit) => <div className="timeline-item" key={visit.id}><div className="timeline-marker" /><div className="timeline-card"><div className="timeline-top"><strong>{visit.complaint}</strong><span>{formatDate(visit.date)}</span></div><p>{visit.symptoms}</p><div className="timeline-meta"><Badge tone={statusTone(visit.status)}>{visit.status}</Badge><Badge tone={priorityTone(visit.priority)}>{visit.priority}</Badge><span>{visit.documents.length} documents</span><Link className="text-link" to={`/visits/${visit.id}`}>Details <ArrowRight size={13} /></Link></div>{visit.outcome && <div className="timeline-outcome"><CheckCircle2 size={14} /> {visit.outcome}</div>}</div></div>)}</div> : <div className="empty-inline">No visits recorded.</div>;
}
