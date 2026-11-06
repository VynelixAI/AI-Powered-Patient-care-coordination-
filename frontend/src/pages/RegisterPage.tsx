import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileText, Plus, ShieldCheck, UserPlus, Upload, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Patient } from '../types';
import { Button, Badge, Card, PageTitle, Field } from '../components/ui';
import { ageFromDob } from '../utils/clinical';
import { formatSize } from './VisitDetailsPage';

const registrationSchema = z.object({
  name: z.string().min(2, 'Enter the patientâ€™s full name.'),
  dateOfBirth: z.string().min(1, 'Enter the date of birth.'),
  gender: z.string().min(1, 'Select an option.'),
  phone: z.string().min(8, 'Enter a valid contact number.'),
  email: z.string().email('Enter a valid email address.').or(z.literal('')),
  address: z.string(),
  emergencyContact: z.string(),
  allergies: z.string(),
  conditions: z.string(),
  medications: z.string(),
  history: z.string(),
});
type RegistrationValues = z.infer<typeof registrationSchema>;
type RegistrationFile = { key: string; file: File; status: 'Selected' | 'Uploading' | 'Uploaded' | 'Failed' };

export function RegisterPage({
  backendMode,
  onCreate,
  onUpload,
  onSaved,
}: {
  backendMode: boolean;
  onCreate: (input: Omit<Patient, 'id' | 'visits'>) => Promise<{ patientId: string; visitId: string }>;
  onUpload: (visitId: string, file: File) => Promise<unknown>;
  onSaved: (patientId: string, unpersistedDocumentCount: number) => Promise<void>;
}) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegistrationValues>({ resolver: zodResolver(registrationSchema), defaultValues: { name: '', dateOfBirth: '', gender: '', phone: '', email: '', address: '', emergencyContact: '', allergies: '', conditions: '', medications: '', history: '' } });
  const dob = watch('dateOfBirth');
  const [files, setFiles] = useState<RegistrationFile[]>([]);
  const [savedPatient, setSavedPatient] = useState<{ patientId: string; visitId: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const addFiles = (incoming: FileList | File[]) => {
    const selected = Array.from(incoming);
    const accepted: RegistrationFile[] = [];
    const errorsFound: string[] = [];
    selected.forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'jpg', 'jpeg', 'png'].includes(extension ?? '') ||
          !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
        errorsFound.push(`${file.name}: only PDF, JPG, JPEG, and PNG files are supported.`);
      } else if (file.size === 0) {
        errorsFound.push(`${file.name}: the file is empty.`);
      } else if (file.size > 10 * 1024 * 1024) {
        errorsFound.push(`${file.name}: files must be 10 MB or smaller.`);
      } else {
        accepted.push({ key: crypto.randomUUID(), file, status: 'Selected' });
      }
    });
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
    setFormError(errorsFound.join(' '));
    setSaveMessage('');
  };
  const submit = async (values: RegistrationValues) => {
    setFormError('');
    setSaveMessage('');
    let patient = savedPatient;
    try {
      if (!patient) {
        patient = await onCreate({
          name: values.name.trim(),
          dateOfBirth: values.dateOfBirth,
          gender: values.gender,
          phone: values.phone.trim(),
          ...(values.email ? { email: values.email.trim() } : {}),
          ...(values.address ? { address: values.address.trim() } : {}),
          ...(values.emergencyContact ? { emergencyContact: values.emergencyContact.trim() } : {}),
          allergies: values.allergies.split(',').map((value) => value.trim()).filter(Boolean),
          conditions: values.conditions.split(',').map((value) => value.trim()).filter(Boolean),
          medications: values.medications.split(',').map((value) => value.trim()).filter(Boolean),
          history: values.history.trim(),
        });
        setSavedPatient(patient);
        setSaveMessage(`Patient ${patient.patientId} saved.`);
      }
      if (backendMode && files.some((item) => item.status !== 'Uploaded')) {
        if (!patient.visitId) throw new Error('The patient was created, but no initial visit was returned for document upload.');
        for (const item of files) {
          if (item.status === 'Uploaded') continue;
          setFiles((current) => current.map((file) => file.key === item.key ? { ...file, status: 'Uploading' } : file));
          try {
            await onUpload(patient.visitId, item.file);
            setFiles((current) => current.map((file) => file.key === item.key ? { ...file, status: 'Uploaded' } : file));
          } catch (error) {
            setFiles((current) => current.map((file) => file.key === item.key ? { ...file, status: 'Failed' } : file));
            throw new Error(
              `Patient ${patient.patientId} was saved, but "${item.file.name}" could not be uploaded. ` +
              `${error instanceof Error ? error.message : 'Retry Save Patient to upload it.'}`,
            );
          }
        }
      }
      const unpersistedDocumentCount = backendMode ? 0 : files.length;
      await onSaved(patient.patientId, unpersistedDocumentCount);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The patient could not be saved. Please try again.');
    }
  };
  return <>
    <PageTitle eyebrow="PATIENT INTAKE" title="Register a patient" description="Create a patient record and, in backend mode, securely attach their medical reports." />
    <form onSubmit={handleSubmit(submit)} className="registration-layout">
      <div className="form-main">
        <fieldset disabled={Boolean(savedPatient)} className="registration-fields">
        <Card><div className="form-section-heading"><span className="step-number">01</span><div><h2>Patient details</h2><p>Core demographic and contact information</p></div></div><div className="form-grid">
          <Field label="Full name" required error={errors.name?.message}><input {...register('name')} placeholder="e.g. Alex Morgan" /></Field>
          <Field label="Date of birth" required error={errors.dateOfBirth?.message}><input type="date" max={new Date().toISOString().slice(0, 10)} {...register('dateOfBirth')} /></Field>
          <Field label="Age" hint="Calculated from date of birth"><input value={dob ? `${ageFromDob(dob)} years` : ''} disabled placeholder="Calculated automatically" /></Field>
          <Field label="Gender" required error={errors.gender?.message}><select {...register('gender')}><option value="">Select an option</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Self-described</option><option>Prefer not to say</option></select></Field>
          <Field label="Contact number" required error={errors.phone?.message}><input {...register('phone')} placeholder="04XX XXX XXX" /></Field>
          <Field label="Email address" optional error={errors.email?.message}><input type="email" {...register('email')} placeholder="name@example.com" /></Field>
          <Field label="Residential address" optional className="field-full"><input {...register('address')} placeholder="Street, suburb, state" /></Field>
          <Field label="Emergency contact" optional className="field-full"><input {...register('emergencyContact')} placeholder="Name and contact number" /></Field>
        </div></Card>
        <Card><div className="form-section-heading"><span className="step-number">02</span><div><h2>Relevant medical history</h2><p>Information provided for this synthetic demo record</p></div></div><div className="form-grid">
          <Field label="Allergies" optional hint="Separate multiple items with commas" className="field-full"><input {...register('allergies')} placeholder="e.g. Penicillin, latex" /></Field>
          <Field label="Existing medical conditions" optional className="field-full"><input {...register('conditions')} placeholder="e.g. Asthma, hypertension" /></Field>
          <Field label="Current medications" optional className="field-full"><input {...register('medications')} placeholder="Name and dosage, separated by commas" /></Field>
          <Field label="Relevant medical history" optional className="field-full"><textarea rows={4} {...register('history')} placeholder="Add relevant history or context..." /></Field>
        </div></Card>
        </fieldset>
        <Card>
          <div className="form-section-heading"><span className="step-number">03</span><div><h2>Medical Documents &amp; Reports</h2><p>Attach reports to the patient's initial visit. File contents are stored privately and not analysed.</p></div></div>
          <div
            className={`medical-upload-zone ${dragging ? 'medical-upload-zone-active' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
          >
            <Upload size={22} />
            <strong>Upload Medical Documents</strong>
            <span>Blood tests, scans, prescriptions, discharge summaries, and previous records.</span>
            <label className="button button-secondary upload-button">
              <Plus size={15} /> Choose files
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                multiple
                disabled={isSubmitting}
                onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }}
                hidden
              />
            </label>
            <small>PDF, JPG, JPEG, or PNG Â· up to 10 MB each Â· multiple files allowed</small>
          </div>
          {files.length > 0 && <div className="registration-file-list" aria-live="polite">
            {files.map((item) => <div className="registration-file-row" key={item.key}>
              <FileText size={17} />
              <span><strong>{item.file.name}</strong><small>{item.file.type || 'Unknown file type'} Â· {formatSize(item.file.size)}</small></span>
              <Badge tone={item.status === 'Uploaded' ? 'green' : item.status === 'Failed' ? 'red' : item.status === 'Uploading' ? 'amber' : 'neutral'}>{item.status}</Badge>
              {item.status !== 'Uploaded' && <button type="button" className="icon-button" aria-label={`Remove ${item.file.name}`} disabled={isSubmitting} onClick={() => setFiles((current) => current.filter((file) => file.key !== item.key))}><X size={16} /></button>}
            </div>)}
          </div>}
          <div className="notice-box medical-upload-note"><ShieldCheck size={16} /><span>{backendMode ? 'Reports upload to the patientâ€™s initial visit after Save Patient. Uploads are authenticated; extraction is not implemented.' : 'Mock mode does not persist file contents. Switch to backend mode in Settings to securely upload reports.'}</span></div>
          {savedPatient && <div className="success-message"><CheckCircle2 size={15} /> Patient {savedPatient.patientId} has been saved. You can retry any failed report upload.</div>}
        </Card>
      </div>
      <div className="registration-submit">
        {formError && <div className="notice-box registration-error" role="alert"><AlertCircle size={16} /><span>{formError}</span></div>}
        <div className="form-actions">
          <Button type="submit" disabled={isSubmitting}><UserPlus size={16} /> {isSubmitting ? 'Saving patientâ€¦' : 'Save Patient'}</Button>
          <Link to="/patients" className="button button-secondary">Cancel</Link>
          {saveMessage && !formError && <span className="success-message"><CheckCircle2 size={15} /> {saveMessage}</span>}
        </div>
        <p className="form-footnote">Demo data only. Do not enter real patient information. Medicare number is not collected.</p>
      </div>
    </form>
  </>;
}
