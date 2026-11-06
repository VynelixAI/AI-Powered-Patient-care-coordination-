import type { DemoState, Priority } from '../types';
export function ageFromDob(dob: string) { const birth = new Date(dob); const now = new Date(); return now.getFullYear() - birth.getFullYear() - (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0); }
export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) { return new Intl.DateTimeFormat('en-AU', options).format(new Date(value)); }
export function patientForVisit(state: DemoState, visitId?: string) { if (!visitId) return undefined; return state.patients.find((patient) => patient.visits.some((visit) => visit.id === visitId)); }
export function latestVisits(state: DemoState) { return state.patients.flatMap((patient) => patient.visits.map((visit) => ({ patient, visit }))).sort((a, b) => new Date(b.visit.date).getTime() - new Date(a.visit.date).getTime()); }
export function priorityTone(priority: Priority) { return priority === 'Urgent' || priority === 'High' ? 'red' : priority === 'Standard' ? 'blue' : 'neutral'; }
export function statusTone(status: string) { if (status === 'Completed' || status === 'Routed' || status === 'Approved') return 'green'; if (status === 'Awaiting review' || status === 'Ready to route' || status === 'In progress') return 'amber'; return 'neutral'; }

