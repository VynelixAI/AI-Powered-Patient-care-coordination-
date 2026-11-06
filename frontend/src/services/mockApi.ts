import { initialDemoState } from '../data/mockData';
import type { AuditEvent, DemoState, Patient, Priority, Visit } from '../types';

const STORAGE_KEY = 'vynelixai-demo-state-v1';

export function loadDemoState(): DemoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as DemoState) : structuredClone(initialDemoState);
  } catch (error) {
    console.error('Unable to load demo workflow state from local storage.', error);
    return structuredClone(initialDemoState);
  }
}

export function saveDemoState(state: DemoState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Unable to save demo workflow state to local storage.', error);
    throw new Error('The demo changes could not be saved in this browser.');
  }
}

export function addAudit(state: DemoState, action: string, actor: string, description: string, visitId?: string): DemoState {
  const event: AuditEvent = { id: `audit-${crypto.randomUUID()}`, date: new Date().toISOString(), action, actor, description, visitId };
  return { ...state, audit: [event, ...state.audit] };
}

export function registerPatient(state: DemoState, input: Omit<Patient, 'id' | 'visits'>): { state: DemoState; patient: Patient } {
  const patientNumber = Math.max(100243, ...state.patients.map((patient) => Number(patient.id.slice(-6)))) + 1;
  const id = `VYX-P-${patientNumber}`;
  const visitId = `VYX-V-${Date.now().toString().slice(-6)}`;
  const visit: Visit = {
    id: visitId,
    patientId: id,
    date: new Date().toISOString(),
    complaint: 'Initial assessment',
    symptoms: 'Initial visit — details to be recorded.',
    onset: 'Not recorded',
    status: 'In progress',
    priority: 'Standard',
    clinician: 'Unassigned',
    notes: '',
    documents: [],
    observations: [],
  };
  const patient: Patient = { ...input, id, visits: [visit] };
  let updated = { ...state, patients: [patient, ...state.patients] };
  updated = addAudit(updated, 'Patient registered', 'Triage team', `${patient.name} was registered with a synthetic Hospital Patient ID.`, visitId);
  updated = addAudit(updated, 'Visit created', 'Triage team', 'An initial visit was opened.', visitId);
  return { state: updated, patient };
}

export function startVisit(state: DemoState, patientId: string): DemoState {
  const visitId = `VYX-V-${Date.now().toString().slice(-6)}`;
  const visit: Visit = {
    id: visitId, patientId, date: new Date().toISOString(), complaint: 'New visit',
    symptoms: 'Symptoms to be recorded.', onset: 'Not recorded', status: 'In progress',
    priority: 'Standard', clinician: 'Unassigned', notes: '', documents: [], observations: [],
  };
  const updated = {
    ...state,
    patients: state.patients.map((patient) => patient.id === patientId ? { ...patient, visits: [visit, ...patient.visits] } : patient),
  };
  return addAudit(updated, 'Visit created', 'Triage team', 'A new visit was opened for a returning patient.', visitId);
}

export function updateVisit(state: DemoState, visitId: string, update: Partial<Visit>): DemoState {
  return {
    ...state,
    patients: state.patients.map((patient) => ({
      ...patient,
      visits: patient.visits.map((visit) => visit.id === visitId ? { ...visit, ...update } : visit),
    })),
  };
}

export const priorities: Priority[] = ['Urgent', 'High', 'Standard', 'Low'];
