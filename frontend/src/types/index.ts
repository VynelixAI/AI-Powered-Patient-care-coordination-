export type Priority = 'Urgent' | 'High' | 'Standard' | 'Low';
export type VisitStatus = 'Awaiting review' | 'In progress' | 'Routed' | 'Completed';

export interface MedicalDocument {
  id: string;
  visitId?: string;
  name: string;
  kind: string;
  contentType?: string;
  uploadedAt: string;
  size: number;
  status: 'Available' | 'Processing';
}

export interface HealthObservation {
  id: string;
  label: string;
  value: string;
  unit: string;
  date: string;
  visitId: string;
}

export interface ClinicalAssessment {
  id?: string;
  summary: string;
  historicalContext: string;
  riskIndicators: string[];
  recommendedPathway: string;
  createdAt: string;
  status: 'Simulated — clinician review required';
  evidenceReferences: {
    sourceRecordId: string;
    visitId?: string;
    date: string;
    value?: string;
    unit?: string;
    verificationStatus: string;
  }[];
}

export interface DoctorReview {
  decision: 'Approved' | 'Modified' | 'Overridden';
  priority: Priority;
  destination: string;
  reason?: string;
  reviewedAt: string;
}

export interface CareRoute {
  destination: string;
  priority: Priority;
  status: 'Ready to route' | 'Routed';
  assignedClinician: string;
  routedAt?: string;
}

export interface Visit {
  id: string;
  patientId: string;
  date: string;
  complaint: string;
  symptoms: string;
  onset: string;
  status: VisitStatus;
  priority: Priority;
  clinician: string;
  notes: string;
  examinationFindings?: string;
  consultationNotes?: string;
  documents: MedicalDocument[];
  observations: HealthObservation[];
  assessment?: ClinicalAssessment;
  doctorReview?: DoctorReview;
  careRoute?: CareRoute;
  outcome?: string;
}

export interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  history: string;
  visits: Visit[];
}

export interface AuditEvent {
  id: string;
  date: string;
  action: string;
  actor: string;
  actorRole?: string;
  patientId?: string;
  visitId?: string;
  resourceReference?: string;
  description: string;
}

export interface DemoState {
  patients: Patient[];
  audit: AuditEvent[];
}
