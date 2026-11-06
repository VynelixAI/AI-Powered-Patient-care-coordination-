import type { AuditEvent, DemoState, Patient, Visit } from '../types';

const date = (daysAgo: number) => {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  return value.toISOString();
};

const visits: Visit[] = [
  {
    id: 'VYX-V-240518',
    patientId: 'VYX-P-100241',
    date: date(0),
    complaint: 'Shortness of breath and fatigue',
    symptoms: 'Breathlessness on exertion, increased fatigue over the past two days.',
    onset: '2 days',
    status: 'Awaiting review',
    priority: 'High',
    clinician: 'Dr Hannah Lee',
    notes: 'Patient reports symptoms are more noticeable when walking uphill.',
    documents: [{ id: 'doc-1', name: 'Referral summary.pdf', kind: 'Referral', uploadedAt: date(0), size: 284000, status: 'Available' }],
    observations: [
      { id: 'obs-1', label: 'Blood pressure', value: '142/88', unit: 'mmHg', date: date(0), visitId: 'VYX-V-240518' },
      { id: 'obs-2', label: 'Heart rate', value: '96', unit: 'bpm', date: date(0), visitId: 'VYX-V-240518' },
      { id: 'obs-3', label: 'Oxygen saturation', value: '96', unit: '%', date: date(0), visitId: 'VYX-V-240518' },
    ],
  },
  {
    id: 'VYX-V-240102',
    patientId: 'VYX-P-100241',
    date: date(32),
    complaint: 'Routine medication review',
    symptoms: 'Routine review; no new symptoms reported.',
    onset: 'Not applicable',
    status: 'Completed',
    priority: 'Standard',
    clinician: 'Dr Michael Chen',
    notes: 'Medication plan reviewed. Follow-up with GP recommended.',
    documents: [{ id: 'doc-2', name: 'Pathology summary.pdf', kind: 'Pathology', uploadedAt: date(32), size: 192000, status: 'Available' }],
    observations: [
      { id: 'obs-4', label: 'Blood pressure', value: '136/84', unit: 'mmHg', date: date(32), visitId: 'VYX-V-240102' },
      { id: 'obs-5', label: 'Weight', value: '78.4', unit: 'kg', date: date(32), visitId: 'VYX-V-240102' },
    ],
    outcome: 'Discharged with GP follow-up.',
  },
  {
    id: 'VYX-V-231115',
    patientId: 'VYX-P-100242',
    date: date(4),
    complaint: 'Persistent cough',
    symptoms: 'Dry cough and mild chest discomfort for several days.',
    onset: '5 days',
    status: 'In progress',
    priority: 'Standard',
    clinician: 'Dr Oliver Grant',
    notes: 'Review symptoms and recent respiratory history.',
    documents: [],
    observations: [{ id: 'obs-6', label: 'Temperature', value: '37.3', unit: '°C', date: date(4), visitId: 'VYX-V-231115' }],
  },
  {
    id: 'VYX-V-231116',
    patientId: 'VYX-P-100243',
    date: date(1),
    complaint: 'Medication follow-up',
    symptoms: 'Follow-up appointment after medication adjustment.',
    onset: 'One week',
    status: 'Awaiting review',
    priority: 'Low',
    clinician: 'Dr Amelia Ward',
    notes: 'Patient would like to discuss medication side effects.',
    documents: [],
    observations: [],
  },
];

const patients: Patient[] = [
  {
    id: 'VYX-P-100241',
    name: 'Amelia Thompson',
    dateOfBirth: '1968-04-19',
    gender: 'Female',
    phone: '04 12 345 678',
    email: 'amelia.t@example.test',
    address: '18 Harbour Street, Sydney NSW',
    emergencyContact: 'James Thompson · 04 98 765 432',
    allergies: ['Penicillin'],
    conditions: ['Hypertension', 'Asthma'],
    medications: ['Amlodipine 5 mg daily', 'Salbutamol inhaler as needed'],
    history: 'History of hypertension and asthma. GP follow-up documented at previous visit.',
    visits: visits.filter((visit) => visit.patientId === 'VYX-P-100241'),
  },
  {
    id: 'VYX-P-100242',
    name: 'Noah Williams',
    dateOfBirth: '1984-11-02',
    gender: 'Male',
    phone: '04 21 456 789',
    email: 'noah.w@example.test',
    allergies: [],
    conditions: ['Seasonal allergic rhinitis'],
    medications: ['Cetirizine 10 mg as needed'],
    history: 'Seasonal allergic rhinitis recorded in patient history.',
    visits: visits.filter((visit) => visit.patientId === 'VYX-P-100242'),
  },
  {
    id: 'VYX-P-100243',
    name: 'Priya Nair',
    dateOfBirth: '1992-07-14',
    gender: 'Non-binary',
    phone: '04 33 567 890',
    allergies: ['Latex'],
    conditions: [],
    medications: [],
    history: 'No ongoing conditions recorded in the available demo history.',
    visits: visits.filter((visit) => visit.patientId === 'VYX-P-100243'),
  },
];

const audit: AuditEvent[] = [
  { id: 'audit-1', date: date(0), action: 'Visit created', actor: 'Triage team', visitId: 'VYX-V-240518', description: 'A new visit was opened for Amelia Thompson.' },
  { id: 'audit-2', date: date(0), action: 'Document uploaded', actor: 'Triage team', visitId: 'VYX-V-240518', description: 'Referral summary.pdf was added to the current visit.' },
  { id: 'audit-3', date: date(1), action: 'Visit completed', actor: 'Dr Michael Chen', visitId: 'VYX-V-240102', description: 'Medication review completed; GP follow-up documented.' },
  { id: 'audit-4', date: date(4), action: 'Visit created', actor: 'Triage team', visitId: 'VYX-V-231115', description: 'A new visit was opened for Noah Williams.' },
];

export const initialDemoState: DemoState = { patients, audit };
