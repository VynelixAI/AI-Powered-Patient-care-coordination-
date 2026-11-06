import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { DemoState } from '../types';
import { Button, Card, PageTitle, Field, Detail } from '../components/ui';
import { patientForVisit } from '../utils/clinical';
import { saveVisitConsultation } from '../services/backendApi';
import { addAudit, updateVisit } from '../services/mockApi';
import { NotFound } from './NotFound';

export function DoctorConsultationPage({
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
  const navigate = useNavigate();

  const patient = patientForVisit(state, visitId);
  const visit = patient?.visits.find((item) => item.id === visitId);

  const [examination, setExamination] = useState('');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!visit) return;

    if (visit.examinationFindings !== undefined || visit.consultationNotes !== undefined) {
      setExamination(visit.examinationFindings ?? '');
      setConsultationNotes(visit.consultationNotes ?? '');
      return;
    }

    const savedNotes = visit.notes ?? '';
    const examinationMatch = savedNotes.match(
      /Clinical examination:\n([\s\S]*?)(?=\n\nDoctor consultation notes:\n|$)/
    );
    const consultationMatch = savedNotes.match(
      /Doctor consultation notes:\n([\s\S]*)$/
    );

    setExamination(examinationMatch?.[1] ?? '');
    setConsultationNotes(consultationMatch?.[1] ?? '');
  }, [visit?.id]);

  if (!patient || !visit) {
    return <NotFound />;
  }

  const saveConsultation = async (): Promise<boolean> => {
    setMessage('');
    const combinedNotes =
      `Clinical examination:\n${examination.trim()}\n\n` +
      `Doctor consultation notes:\n${consultationNotes.trim()}`;

    try {
      setSaving(true);
      if (backendMode) {
        await saveVisitConsultation(visit.id, examination.trim(), consultationNotes.trim());
        await onRefresh();
        setMessage('Consultation saved to the backend.');
      } else {
        setState((current) =>
          addAudit(
            updateVisit(current, visit.id, {
              notes: combinedNotes,
              examinationFindings: examination.trim(),
              consultationNotes: consultationNotes.trim(),
            }),
            'Doctor consultation saved',
            'Clinician',
            'Clinical examination findings and consultation notes were saved.',
            visit.id,
          ),
        );
        setMessage('Consultation saved successfully in this browser.');
      }
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to save the consultation.';
      setMessage(`Consultation was not saved: ${detail}`);
      onError(error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const continueToDoctorReview = async () => {
    if (await saveConsultation()) {
      navigate(`/doctor-review?visit=${encodeURIComponent(visit.id)}`);
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="CLINICIAN WORKSPACE"
        title="Doctor Consultation"
        description="Record clinical examination and consultation findings."
      />

      <Card>
        <h2>Patient Details</h2>
        <Detail label="Patient Name" value={patient.name} />
        <Detail label="Patient ID" value={patient.id} />
        <Detail label="Visit ID" value={visit.id} />
        <Detail label="Complaint" value={visit.complaint} />
        <Detail label="Symptoms" value={visit.symptoms} />
        <Detail label="Duration" value={visit.onset} />
      </Card>

      <Card>
        <h2>Clinical Examination</h2>

        <Field label="Examination Findings">
          <textarea
            rows={4}
            value={examination}
            onChange={(event) => setExamination(event.target.value)}
            placeholder="Enter examination findings..."
          />
        </Field>

        <Field label="Doctor Consultation Notes">
          <textarea
            rows={4}
            value={consultationNotes}
            onChange={(event) => setConsultationNotes(event.target.value)}
            placeholder="Enter consultation notes..."
          />
        </Field>

        {message && (
          <div className="notice-box" role={message.startsWith('Consultation was not saved') ? 'alert' : 'status'}>
            {message}
          </div>
        )}

        <div className="form-actions">
          <Button type="button" variant="secondary" disabled={saving} onClick={() => void saveConsultation()}>
            {saving ? 'Saving…' : 'Save Consultation'}
          </Button>

          <Button
            type="button"
            disabled={saving}
            onClick={() => void continueToDoctorReview()}
          >
            {saving ? 'Saving…' : 'Continue to Doctor Review'}
            <ArrowRight size={16} />
          </Button>
        </div>
      </Card>
    </>
  );
}
