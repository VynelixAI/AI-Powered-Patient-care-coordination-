import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, CheckCircle2, FileText, Plus, Stethoscope, X } from 'lucide-react';
import type { DemoState } from '../types';
import { Button, Badge, Card, PageTitle, Field, Detail } from '../components/ui';
import { ageFromDob, formatDate, patientForVisit, statusTone } from '../utils/clinical';
import { createVisitObservation, saveVisitDetails, uploadVisitDocument } from '../services/backendApi';
import { addAudit, updateVisit } from '../services/mockApi';
import { NotFound } from './NotFound';

export function VisitDetailsPage({
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
  const { visitId = '' } = useParams();
  const patient = patientForVisit(state, visitId);
  const visit = patient?.visits.find((item) => item.id === visitId);
  const [symptoms, setSymptoms] = useState(visit?.symptoms ?? '');
  const [complaint, setComplaint] = useState(visit?.complaint ?? '');
  const [notes, setNotes] = useState(visit?.notes ?? '');
  const [onset, setOnset] = useState(visit?.onset ?? '');
  const [measurementType, setMeasurementType] = useState('weight');
  const [measurementValue, setMeasurementValue] = useState('');
  const [measurementUnit, setMeasurementUnit] = useState('kg');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    if (!visit) return;
    setSymptoms(visit.symptoms);
    setComplaint(visit.complaint);
    setNotes(visit.notes);
    setOnset(visit.onset);
  }, [visit?.id, visit?.complaint, visit?.symptoms, visit?.notes, visit?.onset]);
  if (!patient || !visit) return <NotFound />;
  const saveDetails = async () => {
    try {
      setSaving(true);
      if (backendMode) {
        await saveVisitDetails(visit, { complaint, symptoms, onset, notes });
        await onRefresh();
        setMessage('Visit details saved to the backend.');
      } else {
        setState((current) => addAudit(updateVisit(current, visit.id, { symptoms, complaint, notes, onset }), 'Visit details updated', 'Triage team', 'Current visit details were updated.', visit.id));
        setMessage('Visit details saved in this browser.');
      }
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };
  const sendToDoctorReview = async () => {
  try {
    setSaving(true);

    if (backendMode) {
      await saveVisitDetails(visit, {
        complaint,
        symptoms,
        onset,
        notes,
      });
      await onRefresh();
    } else {
      setState((current) =>
        addAudit(
          updateVisit(current, visit.id, {
            complaint,
            symptoms,
            onset,
            notes,
            status: 'Awaiting review',
          }),
          'Visit sent to doctor review',
          'Triage team',
          'Saved visit details were sent to the doctor review workspace.',
          visit.id,
        ),
      );
    }

    navigate(`/consultation/${encodeURIComponent(visit.id)}`);
  } catch (error) {
    onError(error);
  } finally {
    setSaving(false);
  }
};
  const attachFiles = async (files: FileList | null) => {
    if (!files) return;
    const allowed = [...files].filter((file) => ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    if (allowed.length !== files.length) { setMessage('Only PDF, JPEG, PNG and WebP files are supported.'); return; }
    if (allowed.some((file) => file.size > 10 * 1024 * 1024)) { setMessage('Each file must be 10 MB or smaller.'); return; }
    if (backendMode) {
      try {
        setSaving(true);
        for (const file of allowed) await uploadVisitDocument(visit.id, file);
        await onRefresh();
        setMessage(`${allowed.length} document(s) uploaded to the backend. Extraction is not implemented.`);
      } catch (error) {
        try { await onRefresh(); } catch (refreshError) { onError(refreshError); }
        onError(error);
      } finally {
        setSaving(false);
      }
      return;
    }
    const documents = [...visit.documents, ...allowed.map((file) => ({ id: `doc-${crypto.randomUUID()}`, name: file.name, kind: 'Visit document', uploadedAt: new Date().toISOString(), size: file.size, status: 'Available' as const }))];
    setState((current) => addAudit(updateVisit(current, visit.id, { documents }), 'Document uploaded', 'Triage team', `${allowed.length} document(s) selected for the visit. File processing is simulated.`, visit.id));
    setMessage('Document added to the demo visit. Processing is simulated; file contents are not analysed.');
  };
  const addObservation = async () => {
    if (!measurementValue.trim() || !measurementUnit.trim()) {
      setMessage('Enter both a measurement value and unit.');
      return;
    }
    try {
      setSaving(true);
      if (backendMode) {
        await createVisitObservation(visit.id, measurementType, measurementValue.trim(), measurementUnit.trim());
        await onRefresh();
        setMessage('Observation saved to the backend as unverified.');
      } else {
        const observation = {
          id: `obs-${crypto.randomUUID()}`,
          label: measurementType.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
          value: measurementValue.trim(),
          unit: measurementUnit.trim(),
          date: new Date().toISOString(),
          visitId: visit.id,
        };
        setState((current) => addAudit(
          updateVisit(current, visit.id, { observations: [...visit.observations, observation] }),
          'Observation recorded', 'Triage team', 'A structured observation was recorded.', visit.id,
        ));
        setMessage('Observation recorded in this browser.');
      }
      setMeasurementValue('');
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };
  return <>
    <div className="back-link"><Link to={`/patients/${patient.id}`}><ArrowDownRight size={15} /> {patient.name}</Link><span>/</span> Visit details</div>
    <PageTitle eyebrow={`VISIT ${visit.id}`} title={visit.complaint} description={`${patient.name} Â· ${formatDate(visit.date, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`} action={<Badge tone={statusTone(visit.status)}>{visit.status}</Badge>} />
    <div className="visit-grid"><div className="form-main">
      <Card><div className="card-heading"><div><h2>Current visit information</h2><p>Symptoms and context for this encounter</p></div></div><div className="form-grid"><Field label="Presenting complaint"><input value={complaint} onChange={(event) => setComplaint(event.target.value)} /></Field><Field label="Symptom onset / duration"><input value={onset} onChange={(event) => setOnset(event.target.value)} /></Field><Field label="Current symptoms" className="field-full"><textarea rows={4} value={symptoms} onChange={(event) => setSymptoms(event.target.value)} /></Field><Field label="Clinician-entered notes" optional className="field-full"><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes for this visit..." /></Field></div><div className="form-actions"><Button variant="secondary" disabled={saving} onClick={saveDetails}>Save visit details</Button>{message && <span className="success-message"><CheckCircle2 size={15} /> {message}</span>}</div>
      <Button
  disabled={saving}
  onClick={() => void sendToDoctorReview()}
>
  <Stethoscope size={16} />
  {saving ? 'Sendingâ€¦' : 'Send to Doctor Review'}
</Button></Card>
      <Card><div className="card-heading"><div><h2>Documents</h2><p>PDF and image uploads Â· extraction is not implemented</p></div><label className={`button button-secondary upload-button ${saving ? 'disabled' : ''}`}><Plus size={16} /> Add document<input type="file" accept=".pdf,image/jpeg,image/png,image/webp" multiple disabled={saving} onChange={(event) => { void attachFiles(event.target.files); event.target.value = ''; }} hidden /></label></div>{visit.documents.length ? <div className="document-list">{visit.documents.map((doc) => <div className="document-row" key={doc.id}><span className="document-icon"><FileText size={18} /></span><span><strong>{doc.name}</strong><small>{doc.kind} Â· {formatSize(doc.size)} Â· Added {formatDate(doc.uploadedAt)}</small></span><Badge tone={statusTone(doc.status)}>{doc.status}</Badge>{!backendMode && <button aria-label={`Remove ${doc.name}`} className="icon-button" onClick={() => setState((current) => updateVisit(current, visit.id, { documents: visit.documents.filter((item) => item.id !== doc.id) }))}><X size={16} /></button>}</div>)}</div> : <div className="dropzone"><FileText size={22} /><strong>No documents attached</strong><span>Select PDF or image files to add metadata to this visit.</span></div>}</Card>
      <Card><div className="card-heading"><div><h2>Observations</h2><p>Record values from this visit; backend entries are marked unverified until confirmed by a clinician.</p></div></div><div className="form-grid"><Field label="Measurement"><select value={measurementType} onChange={(event) => setMeasurementType(event.target.value)}><option value="blood_pressure">Blood pressure</option><option value="blood_glucose">Blood glucose</option><option value="weight">Weight</option><option value="heart_rate">Heart rate</option><option value="oxygen_saturation">Oxygen saturation</option><option value="temperature">Temperature</option></select></Field><Field label="Value"><input value={measurementValue} onChange={(event) => setMeasurementValue(event.target.value)} placeholder="e.g. 72" /></Field><Field label="Unit"><input value={measurementUnit} onChange={(event) => setMeasurementUnit(event.target.value)} placeholder="e.g. kg" /></Field></div><Button variant="secondary" disabled={saving} onClick={() => void addObservation()}><Plus size={15} /> Record observation</Button>{visit.observations.length ? visit.observations.map((obs) => <div className="observation-row" key={obs.id}><span>{obs.label}</span><strong>{obs.value} <small>{obs.unit}</small></strong></div>) : <div className="empty-inline">No observations recorded for this visit.</div>}</Card>
    </div><div className="visit-aside"><Card><div className="card-heading"><div><h2>Patient context</h2><p>Relevant existing record</p></div><Link to={`/patients/${patient.id}`} className="text-link">Profile <ArrowRight size={13} /></Link></div><div className="patient-mini"><div className="avatar avatar-small">{patient.name.split(' ').map((part) => part[0]).join('')}</div><span><strong>{patient.name}</strong><small>{patient.id} Â· {ageFromDob(patient.dateOfBirth)} years</small></span></div><Detail label="Allergies" value={patient.allergies.join(', ') || 'None recorded'} /><Detail label="Conditions" value={patient.conditions.join(', ') || 'None recorded'} /><Detail label="Medications" value={patient.medications.join(', ') || 'None recorded'} /><Link to={`/patients/${patient.id}`} className="secondary-link">View full medical history <ArrowRight size={14} /></Link></Card><Card><div className="card-heading"><div><h2>Observations</h2><p>Recorded for this visit</p></div></div>{visit.observations.length ? visit.observations.map((obs) => <div className="observation-row" key={obs.id}><span>{obs.label}</span><strong>{obs.value} <small>{obs.unit}</small></strong></div>) : <div className="empty-inline">No observations recorded for this visit.</div>}</Card></div></div>
  </>;
}
export function formatSize(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`; }
