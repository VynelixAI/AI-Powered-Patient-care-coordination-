import type { AuditEvent, DemoState, MedicalDocument, Patient, Priority, Visit, VisitStatus } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
const TOKEN_KEY = 'vynelixai-api-token';

type ApiRecord = Record<string, unknown>;

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function logApiResponse(method: string, url: string, status: number | string): void {
  if (!import.meta.env.DEV) return;
  const parsedUrl = new URL(url);
  const safePath = parsedUrl.pathname.replace(/\/(?:VYX-[PV]-[^/]+|DOC-[^/]+|ASM-[^/]+)/g, '/:id');
  console.info(`[Vynelix API] ${method} ${parsedUrl.origin}${safePath} -> ${status}`);
}

async function diagnosedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  try {
    const response = await fetch(url, init);
    logApiResponse(method, url, response.status);
    return response;
  } catch (error) {
    logApiResponse(method, url, 'NETWORK/CORS ERROR');
    const reason = error instanceof Error ? error.message : 'Network request failed.';
    throw new Error(`Unable to reach ${new URL(url).origin}${new URL(url).pathname}. Check that the backend is running and allows this frontend origin. ${reason}`);
  }
}

export function getBackendToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) ?? '';
}

export function saveBackendToken(token: string): void {
  const value = token.trim();
  if (value) sessionStorage.setItem(TOKEN_KEY, value);
  else sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = getBackendToken();
  if (!token) throw new Error('Add a valid backend bearer token in Settings before connecting.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await diagnosedFetch(url, { ...init, headers });
  if (!response.ok) {
    let message = `Backend request failed (${response.status}).`;
    try {
      const body = await response.json() as { detail?: string; error?: { message?: string; details?: { message?: string }[] } };
      message = body.detail ?? body.error?.message ?? body.error?.details?.map((item) => item.message).join(', ') ?? message;
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mapPriority(value: unknown): Priority {
  switch (asString(value).toUpperCase()) {
    case 'URGENT': return 'Urgent';
    case 'HIGH': return 'High';
    case 'LOW': return 'Low';
    default: return 'Standard';
  }
}

function mapStatus(value: unknown): VisitStatus {
  switch (asString(value).toUpperCase()) {
    case 'AWAITING_REVIEW': return 'Awaiting review';
    case 'ROUTED': return 'Routed';
    case 'COMPLETED': return 'Completed';
    default: return 'In progress';
  }
}

function mapDocument(document: ApiRecord): MedicalDocument {
  return {
    id: asString(document.id),
    visitId: asString(document.visit_id),
    name: asString(document.original_filename),
    kind: asString(document.category, 'OTHER'),
    contentType: asString(document.content_type) || undefined,
    uploadedAt: asString(document.uploaded_at),
    size: Number(document.file_size ?? 0),
    status: 'Available' as const,
  };
}

function mapObservation(observation: ApiRecord) {
  const labels: Record<string, string> = {
    blood_pressure: 'Blood pressure',
    blood_glucose: 'Blood glucose',
    weight: 'Weight',
    heart_rate: 'Heart rate',
    oxygen_saturation: 'Oxygen saturation',
    temperature: 'Temperature',
  };
  const type = asString(observation.measurement_type);
  return {
    id: asString(observation.id),
    label: labels[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    value: asString(observation.value),
    unit: asString(observation.unit),
    date: asString(observation.recorded_at),
    visitId: asString(observation.visit_id),
  };
}

function mapReview(review: ApiRecord | null) {
  if (!review) return undefined;
  const decisions: Record<string, 'Approved' | 'Modified' | 'Overridden'> = {
    APPROVE: 'Approved',
    MODIFY: 'Modified',
    OVERRIDE: 'Overridden',
  };
  return {
    decision: decisions[asString(review.decision)] ?? 'Approved',
    priority: mapPriority(review.final_priority),
    destination: asString(review.final_destination, 'General Medicine'),
    reason: asString(review.rationale ?? review.comment) || undefined,
    reviewedAt: asString(review.updated_at ?? review.reviewed_at),
  } as const;
}

function mapAssessment(assessment: ApiRecord | null) {
  if (!assessment) return undefined;
  const evidenceReferences = Array.isArray(assessment.evidence_references)
    ? assessment.evidence_references.map((item) => {
      const evidence = item as ApiRecord;
      return {
        sourceRecordId: asString(evidence.source_record_id),
        visitId: asString(evidence.visit_id) || undefined,
        date: asString(evidence.date),
        value: asString(evidence.value) || undefined,
        unit: asString(evidence.unit) || undefined,
        verificationStatus: asString(evidence.verification_status, 'UNKNOWN'),
      };
    })
    : [];
  return {
    id: asString(assessment.id),
    summary: asString(assessment.current_problem_summary),
    historicalContext: asStrings(assessment.relevant_historical_context).join(' ') || 'No historical context was recorded.',
    riskIndicators: asStrings(assessment.potential_risk_indicators),
    recommendedPathway: asString(assessment.suggested_care_pathway),
    createdAt: asString(assessment.created_at),
    status: 'Simulated — clinician review required' as const,
    evidenceReferences,
  };
}

function mapVisit(
  visit: ApiRecord,
  patientId: string,
  timeline: ApiRecord,
  decision: ApiRecord | null,
  route: ApiRecord | null,
): Visit {
  const apiVisit = (timeline.visit ?? visit) as ApiRecord;
  const doctorReview = mapReview(decision);
  const currentRoute = route;
  const routePriority = mapPriority(currentRoute?.approved_priority ?? decision?.final_priority);
  const routeDestination = asString(currentRoute?.destination ?? decision?.final_destination, 'General Medicine');
  return {
    id: asString(apiVisit.id),
    patientId,
    date: asString(apiVisit.created_at),
    complaint: asString(apiVisit.presenting_complaint, asString(apiVisit.presenting_symptoms, 'Visit details not recorded.')),
    symptoms: asString(apiVisit.presenting_symptoms, 'Symptoms not recorded.'),
    onset: [apiVisit.symptom_onset, apiVisit.symptom_duration].filter(Boolean).join(' · ') || 'Not recorded',
    status: mapStatus(apiVisit.status),
    priority: mapPriority(decision?.final_priority),
    clinician: asString(decision?.clinician_id, 'Unassigned'),
    notes: asString(apiVisit.clinician_notes),
    examinationFindings: typeof apiVisit.examination_findings === 'string' ? apiVisit.examination_findings : undefined,
    consultationNotes: typeof apiVisit.consultation_notes === 'string' ? apiVisit.consultation_notes : undefined,
    documents: Array.isArray(timeline.documents) ? timeline.documents.map((item) => mapDocument(item as ApiRecord)) : [],
    observations: Array.isArray(timeline.observations) ? timeline.observations.map((item) => mapObservation(item as ApiRecord)) : [],
    doctorReview,
    careRoute: currentRoute ? {
      destination: routeDestination,
      priority: routePriority,
      status: asString(currentRoute.routing_status) === 'SIMULATED_READY' ? 'Routed' : 'Ready to route',
      assignedClinician: asString(currentRoute.assigned_clinician, 'Unassigned'),
      routedAt: asString(currentRoute.created_at),
    } : undefined,
    outcome: asString(apiVisit.final_outcome) || undefined,
  };
}

async function optionalRecord(path: string): Promise<ApiRecord | null> {
  try {
    return await request<ApiRecord>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function loadBackendState(): Promise<DemoState> {
  const patients: Patient[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = await request<{ items: ApiRecord[]; total: number }>(`/patients?page=${page}&page_size=100`);
    total = result.total;
    for (const record of result.items) {
      const profile = await request<ApiRecord>(`/patients/${encodeURIComponent(asString(record.id))}`);
      const patientId = asString(profile.id);
      const visitRecords: ApiRecord[] = [];
      let visitPage = 1;
      let visitTotal = 0;
      do {
        const visitResult = await request<{ items: ApiRecord[]; total: number }>(
          `/patients/${encodeURIComponent(patientId)}/visits?page=${visitPage}&page_size=100`,
        );
        visitRecords.push(...visitResult.items);
        visitTotal = visitResult.total;
        visitPage += 1;
      } while ((visitPage - 1) * 100 < visitTotal);
      const visits = await Promise.all(visitRecords.map(async (visit) => {
        const visitId = asString(visit.id);
        const [timeline, decisions, route] = await Promise.all([
          request<ApiRecord>(`/visits/${encodeURIComponent(visitId)}/timeline`),
          request<{ items: ApiRecord[] }>(`/visits/${encodeURIComponent(visitId)}/clinical-decisions`),
          optionalRecord(`/visits/${encodeURIComponent(visitId)}/routing`),
        ]);
        return mapVisit(visit, patientId, timeline, decisions.items[0] ?? null, route);
      }));
      patients.push({
        id: patientId,
        name: asString(profile.name),
        dateOfBirth: asString(profile.date_of_birth),
        gender: asString(profile.gender),
        phone: asString(profile.phone),
        email: asString(profile.email) || undefined,
        address: asString(profile.address) || undefined,
        emergencyContact: asString(profile.emergency_contact) || undefined,
        allergies: asStrings(profile.allergies),
        conditions: asStrings(profile.conditions),
        medications: asStrings(profile.medications),
        history: asString(profile.medical_history),
        visits: visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      });
    }
    page += 1;
  } while ((page - 1) * 100 < total);

  const auditEvents: ApiRecord[] = [];
  let auditPage = 1;
  let auditTotal = 0;
  do {
    const result = await request<{ items: ApiRecord[]; total: number }>(
      `/audit?page=${auditPage}&page_size=200`,
    );
    auditEvents.push(...result.items);
    auditTotal = result.total;
    auditPage += 1;
  } while ((auditPage - 1) * 200 < auditTotal);
  return {
    patients,
    audit: auditEvents.map((event): AuditEvent => ({
      id: asString(event.id),
      date: asString(event.timestamp),
      action: asString(event.action).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
      actor: asString(event.actor_id),
      actorRole: asString(event.actor_role) || undefined,
      patientId: asString(event.patient_id) || undefined,
      visitId: asString(event.visit_id) || undefined,
      resourceReference: asString(event.resource_reference) || undefined,
      description: asString(event.safe_summary),
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}

export async function searchPatients(query: string): Promise<string[]> {
  const result = await request<{ items: ApiRecord[] }>(
    `/patients/search?q=${encodeURIComponent(query)}&page=1&page_size=100`,
  );
  return result.items.map((item) => asString(item.id));
}

const visitStatusValues: Record<string, string> = {
  'Awaiting review': 'AWAITING_REVIEW',
  'In progress': 'IN_PROGRESS',
  Routed: 'ROUTED',
  Completed: 'COMPLETED',
};

export async function searchVisits(query: string, status: string): Promise<string[]> {
  const params = new URLSearchParams({ page: '1', page_size: '100' });
  if (query.trim()) params.set('q', query.trim());
  const apiStatus = visitStatusValues[status];
  if (apiStatus) params.set('status', apiStatus);
  const result = await request<{ items: ApiRecord[] }>(`/visits?${params.toString()}`);
  return result.items.map((item) => asString(item.id));
}

export async function fetchPendingReviewVisitIds(): Promise<string[]> {
  const result = await request<{ items: ApiRecord[] }>('/doctor-reviews/pending?page=1&page_size=100');
  return result.items.map((item) => asString(item.visit_id)).filter(Boolean);
}

export async function createPatient(input: Omit<Patient, 'id' | 'visits'>): Promise<{ patientId: string; visitId: string }> {
  const patient = await request<ApiRecord>('/patients', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      date_of_birth: input.dateOfBirth,
      gender: input.gender,
      phone: input.phone,
      email: input.email || null,
      address: input.address || null,
      emergency_contact: input.emergencyContact || null,
      allergies: input.allergies,
      conditions: input.conditions,
      medications: input.medications,
      medical_history: input.history,
    }),
  });
  const visits = Array.isArray(patient.visits) ? patient.visits as ApiRecord[] : [];
  return { patientId: asString(patient.id), visitId: asString(visits[0]?.id) };
}

export async function fetchPatientDocuments(patientId: string): Promise<MedicalDocument[]> {
  const documents: MedicalDocument[] = [];
  let page = 1;
  let total = 0;
  do {
    const response = await request<{ items: ApiRecord[]; total: number }>(
      `/patients/${encodeURIComponent(patientId)}/documents?page=${page}&page_size=100`,
    );
    documents.push(...response.items.map(mapDocument));
    total = response.total;
    page += 1;
  } while (documents.length < total);
  return documents;
}

export async function createVisit(patientId: string): Promise<string> {
  const visit = await request<ApiRecord>(`/patients/${encodeURIComponent(patientId)}/visits`, {
    method: 'POST',
    body: JSON.stringify({
      presenting_complaint: 'New visit',
      presenting_symptoms: 'Symptoms to be recorded.',
    }),
  });
  return asString(visit.id);
}

export async function saveVisitDetails(visit: Visit, update: { complaint: string; symptoms: string; onset: string; notes: string }): Promise<void> {
  const onsetParts = update.onset.split('·').map((part) => part.trim()).filter(Boolean);
  await request(`/visits/${encodeURIComponent(visit.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      presenting_complaint: update.complaint,
      presenting_symptoms: update.symptoms,
      symptom_onset: onsetParts[0] || null,
      symptom_duration: onsetParts[1] || null,
      clinician_notes: update.notes,
    }),
  });
}

export interface SavedConsultation {
  visitId: string;
  patientId: string;
  examinationFindings: string;
  consultationNotes: string;
  updatedAt: string;
}

export async function saveVisitConsultation(
  visitId: string,
  examinationFindings: string,
  consultationNotes: string,
): Promise<SavedConsultation> {
  const response = await request<{ visit_id: string; patient_id: string; consultation: ApiRecord }>(
    `/visits/${encodeURIComponent(visitId)}/consultation`,
    {
      method: 'PUT',
      body: JSON.stringify({
        examination_findings: examinationFindings,
        consultation_notes: consultationNotes,
      }),
    },
  );
  return {
    visitId: response.visit_id,
    patientId: response.patient_id,
    examinationFindings: asString(response.consultation.examination_findings),
    consultationNotes: asString(response.consultation.consultation_notes),
    updatedAt: asString(response.consultation.updated_at),
  };
}

export async function uploadVisitDocument(visitId: string, file: File): Promise<MedicalDocument> {
  const data = new FormData();
  data.set('file', file);
  data.set('category', 'OTHER');
  const document = await request<ApiRecord>(`/visits/${encodeURIComponent(visitId)}/documents`, { method: 'POST', body: data });
  return mapDocument(document);
}

export async function downloadMedicalDocument(documentId: string, filename: string): Promise<void> {
  const token = getBackendToken();
  if (!token) throw new Error('Add a valid backend bearer token in Settings before downloading documents.');
  const url = `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/download`;
  const response = await diagnosedFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  logApiResponse('GET', url, response.status);
  if (!response.ok) {
    let message = `Document download failed (${response.status}).`;
    try {
      const body = await response.json() as { detail?: string };
      message = body.detail ?? message;
    } catch {
      // Preserve the status-based message if the server response is not JSON.
    }
    throw new ApiError(message, response.status);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function generateVisitAssessment(visitId: string): Promise<NonNullable<Visit['assessment']>> {
  const assessment = await request<ApiRecord>(`/visits/${encodeURIComponent(visitId)}/assessments`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const mapped = mapAssessment(assessment);
  if (!mapped) throw new Error('The backend returned an empty assessment response.');
  return mapped;
}

export async function submitDoctorReview(
  assessmentId: string,
  decision: 'Approved' | 'Modified' | 'Overridden',
  priority: Priority,
  destination: string,
  reason: string,
): Promise<void> {
  const destinations: Record<string, string> = { 'General Practice / GP': 'General Practice' };
  const decisions = { Approved: 'APPROVE', Modified: 'MODIFY', Overridden: 'OVERRIDE' };
  await request(`/assessments/${encodeURIComponent(assessmentId)}/review`, {
    method: 'POST',
    body: JSON.stringify({
      decision: decisions[decision],
      final_priority: priority.toUpperCase(),
      final_destination: destinations[destination] ?? destination,
      comment: reason || null,
    }),
  });
}

export async function saveClinicalDecision(
  visitId: string,
  decision: 'Approved' | 'Modified' | 'Overridden',
  priority: Priority,
  destination: string,
  rationale: string,
  clinicalImpression: string,
  treatmentPlan: string,
): Promise<void> {
  const decisions = { Approved: 'APPROVE', Modified: 'MODIFY', Overridden: 'OVERRIDE' };
  await request(`/visits/${encodeURIComponent(visitId)}/clinical-decision`, {
    method: 'PUT',
    body: JSON.stringify({
      decision: decisions[decision],
      final_priority: priority.toUpperCase(),
      final_destination: destination === 'General Practice / GP' ? 'General Practice' : destination,
      rationale: rationale || null,
      clinical_impression: clinicalImpression || null,
      treatment_plan: treatmentPlan || null,
    }),
  });
}

export async function createVisitRoute(visitId: string, destination: string): Promise<void> {
  const destinations: Record<string, string> = { 'General Practice / GP': 'General Practice' };
  await request(`/visits/${encodeURIComponent(visitId)}/routing`, {
    method: 'POST',
    body: JSON.stringify({ destination: destinations[destination] ?? destination }),
  });
}

export type ReferralStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CreateReferralInput {
  destination_specialty: string;
  reason: string;
  clinical_summary?: string | null;
  priority: 'LOW' | 'STANDARD' | 'HIGH' | 'URGENT';
  assigned_specialist_id?: string | null;
}

export interface ReferralRecord {
  id: string;
  visit_id?: string;
  patient_id?: string;
  destination_specialty: string;
  reason: string;
  clinical_summary?: string | null;
  priority: string;
  status: ReferralStatus;
  assigned_specialist_id?: string | null;
}

export async function createSpecialistReferral(
  visitId: string,
  payload: CreateReferralInput,
): Promise<ReferralRecord> {
  return request<ReferralRecord>(
    `/visits/${encodeURIComponent(visitId)}/referrals`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchReferrals(
  patientId?: string,
): Promise<ReferralRecord[]> {
  const query = patientId
    ? `?patient_id=${encodeURIComponent(patientId)}`
    : '';

  const result = await request<ReferralRecord[] | { items: ReferralRecord[] }>(
    `/referrals${query}`,
  );

  return Array.isArray(result) ? result : result.items;
}

export async function changeReferralStatus(
  referralId: string,
  status: ReferralStatus,
): Promise<ReferralRecord> {
  return request<ReferralRecord>(
    `/referrals/${encodeURIComponent(referralId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export async function createVisitObservation(
  visitId: string,
  measurementType: string,
  value: string,
  unit: string,
): Promise<void> {
  await request(`/visits/${encodeURIComponent(visitId)}/observations`, {
    method: 'POST',
    body: JSON.stringify({
      measurement_type: measurementType,
      value,
      unit,
      verification_status: 'UNVERIFIED',
    }),
  });
}

export async function apiReady(): Promise<void> {
  const result = await request<{ status: string }>('/health/ready');
  if (result.status !== 'ready') throw new Error('The backend database is not ready.');
}

export async function apiHealth(): Promise<void> {
  const url = `${API_BASE_URL.replace(/\/api\/v1$/, '')}/health`;
  const response = await diagnosedFetch(url);
  if (!response.ok) throw new Error(`Backend health check failed (${response.status}).`);
  const result = await response.json() as { status?: string };
  if (result.status !== 'ok') throw new Error('The backend health endpoint returned an unexpected response.');
}

export function isBackendMode(): boolean {
  const savedMode = localStorage.getItem('vynelixai-data-mode');
  if (savedMode === 'backend') return true;
  if (savedMode === 'mock') return false;
  return import.meta.env.VITE_DATA_MODE === 'backend';
}

export function setBackendMode(enabled: boolean): void {
  if (enabled) localStorage.setItem('vynelixai-data-mode', 'backend');
  else localStorage.setItem('vynelixai-data-mode', 'mock');
}



export interface SpecialistConsultation {
  id: string;
  referral_id: string;
  patient_id: string;
  visit_id: string;
  clinician_id: string;
  specialty: string;
  examination_findings: string;
  consultation_notes: string;
  clinical_impression: string;
  recommendations: string;
  follow_up_instructions: string;
  created_at: string;
  updated_at: string;
}

// Fetch saved specialist consultations for a referral
export async function fetchSpecialistConsultations(
  referralId: string,
): Promise<SpecialistConsultation[]> {
  const result = await request<
    SpecialistConsultation[] | { items: SpecialistConsultation[] }
  >(
    `/referrals/${encodeURIComponent(referralId)}/specialist-consultations`,
  );

  return Array.isArray(result) ? result : result.items;
}

// Save a specialist consultation
export async function saveSpecialistConsultation(
  referralId: string,
  payload: {
    examination_findings: string;
    consultation_notes: string;
    clinical_impression: string;
    recommendations: string;
    follow_up_instructions: string;
  },
): Promise<SpecialistConsultation> {
  return request<SpecialistConsultation>(
    `/referrals/${encodeURIComponent(referralId)}/specialist-consultation`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}


export interface PrescriptionItem {
  medication_name: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
  refills: number;
}

export interface PrescriptionRecord {
  id: string;
  patient_id: string;
  visit_id: string;
  prescribing_clinician_id: string;
  items: PrescriptionItem[];
  pharmacy_id: string;
  clinical_notes: string;
  expires_on: string;
  status: string;
  created_at: string;
  authorized_at?: string | null;
  dispenses?: {
    pharmacy_id: string;
    items: { medication_name: string; quantity: number }[];
    dispensed_at: string;
  }[];
}

export async function fetchPrescriptions(
  patientId?: string,
): Promise<PrescriptionRecord[]> {
  const query = patientId
    ? `?patient_id=${encodeURIComponent(patientId)}`
    : '';

  const result = await request<
    PrescriptionRecord[] | { items: PrescriptionRecord[] }
  >(`/prescriptions${query}`);

  return Array.isArray(result) ? result : result.items;
}

export async function createPrescription(
  visitId: string,
  payload: {
    items: PrescriptionItem[];
    pharmacy_id: string;
    clinical_notes: string;
    expires_on: string;
  },
): Promise<PrescriptionRecord> {
  return request<PrescriptionRecord>(
    `/visits/${encodeURIComponent(visitId)}/prescriptions`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function authorizePrescription(
  prescriptionId: string,
): Promise<PrescriptionRecord> {
  return request<PrescriptionRecord>(
    `/prescriptions/${encodeURIComponent(prescriptionId)}/authorize`,
    { method: 'POST' },
  );
}

export async function fetchPharmacyPrescriptions(): Promise<
  PrescriptionRecord[]
> {
  const result = await request<
    PrescriptionRecord[] | { items: PrescriptionRecord[] }
  >('/pharmacy/prescriptions');

  return Array.isArray(result) ? result : result.items;
}

export async function dispensePrescription(
  prescriptionId: string,
  items: { medication_name: string; quantity: number }[],
): Promise<PrescriptionRecord> {
  return request<PrescriptionRecord>(
    `/pharmacy/prescriptions/${encodeURIComponent(prescriptionId)}/dispense`,
    {
      method: 'POST',
      body: JSON.stringify({ items }),
    },
  );
}
