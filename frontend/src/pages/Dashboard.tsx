import { Link } from 'react-router-dom';
import { Activity, AlertCircle, ArrowRight, ArrowUpRight, Check, ChevronRight, ClipboardList, Clock3, Plus, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';
import type { DemoState, Patient, Visit } from '../types';
import { Badge, Card, PageTitle } from '../components/ui';
import { formatDate, latestVisits, priorityTone, statusTone } from '../utils/clinical';

export function Dashboard({ state, backendMode }: { state: DemoState; backendMode: boolean }) {
  const visits = latestVisits(state);
  const today = visits.filter(({ visit }) => new Date(visit.date).toDateString() === new Date().toDateString());
  const awaiting = visits.filter(({ visit }) => visit.status === 'Awaiting review');
  const urgent = visits.filter(({ visit }) => visit.priority === 'Urgent' || visit.priority === 'High');
  return <>
    <PageTitle eyebrow="AI-POWERED PATIENT CARE COORDINATION" title="Welcome to VynelixAI Health" description="Coordinate patient registration, clinical assessments, doctor reviews, care routing, and prescriptions in one connected healthcare workflow." action={<Link className="button button-primary" to="/register"><Plus size={17} /> Register patient</Link>} />
    <div className="stat-grid">
      <Stat icon={<Users />} label="Registered patients" value={state.patients.length.toString()} note="Across this demo workspace" trend="+12%" />
      <Stat icon={<ClipboardList />} label="Today's visits" value={today.length.toString()} note="Visit records opened today" />
      <Stat icon={<Clock3 />} label="Awaiting review" value={awaiting.length.toString()} note="Ready for clinician review" />
      <Stat icon={<AlertCircle />} label="Priority attention" value={urgent.length.toString()} note="High or urgent priority" risk />
    </div>
    <div className="dashboard-grid">
      <Card className="visits-card">
        <div className="card-heading"><div><h2>Recent patient visits</h2><p>Latest activity across your patient list</p></div><Link className="text-link" to="/visits">View all <ArrowRight size={15} /></Link></div>
        <VisitTable visits={visits.slice(0, 5)} />
      </Card>
      <Card className="quick-card">
        <div className="card-heading"><div><h2>Quick actions</h2><p>Common tasks, right at hand</p></div></div>
        <Link className="quick-action" to="/register"><div className="quick-icon sage"><UserPlus size={18} /></div><span><strong>Register a patient</strong><small>Create a new synthetic patient record</small></span><ChevronRight size={17} /></Link>
        <Link className="quick-action" to="/patients"><div className="quick-icon lilac"><Search size={18} /></div><span><strong>Find a patient</strong><small>Search existing patient records</small></span><ChevronRight size={17} /></Link>
        {/* <Link className="quick-action" to="/assessment"><div className="quick-icon blue"><Sparkles size={18} /></div><span><strong>Review an assessment</strong><small>Open simulated decision support</small></span><ChevronRight size={17} /></Link> */}
        <div className="notice-box"><ShieldCheck size={17} /><span>{backendMode ? 'Records are loaded from the authenticated backend. Use synthetic data only.' : 'All records in this workspace are synthetic and stored locally in your browser.'}</span></div>
      </Card>
    </div>
    <div className="lower-grid">
      <Card><div className="card-heading"><div><h2>Recent activity</h2><p>Latest updates in the workspace</p></div><Link to="/audit" className="text-link">Audit trail <ArrowRight size={15} /></Link></div><ActivityList events={state.audit.slice(0, 4)} /></Card>
      <Card className="insight-card"><div className="insight-top"><span className="soft-icon"><Activity size={19} /></span><span className="eyebrow">WORKFLOW SNAPSHOT</span></div><h3>Care begins with context.</h3><p>Bring current visit details together with patient history to support a more informed clinician review.</p></Card>
    </div>
  </>;
}

function Stat({ icon, label, value, note, trend, risk = false }: { icon: React.ReactNode; label: string; value: string; note: string; trend?: string; risk?: boolean }) {
  return <Card className={`stat-card ${risk ? 'stat-risk' : ''}`}><div className="stat-top"><span className="stat-icon">{icon}</span>{trend && <span className="stat-trend"><ArrowUpRight size={13} />{trend}</span>}</div><div className="stat-number">{value}</div><div className="stat-label">{label}</div><div className="stat-note">{note}</div></Card>;
}

export function VisitTable({ visits }: { visits: { patient: Patient; visit: Visit }[] }) {
  if (!visits.length) return <div className="empty-state"><ClipboardList size={24} /><strong>No visits to show</strong><span>New visit records will appear here.</span></div>;
  return <div className="table-scroll"><table><thead><tr><th>Patient</th><th>Presenting complaint</th><th>Date</th><th>Priority</th><th>Status</th><th /></tr></thead><tbody>{visits.map(({ patient, visit }) => <tr key={visit.id}>
    <td><Link className="patient-cell" to={`/patients/${patient.id}`}><span className="avatar avatar-small">{patient.name.split(' ').map((part) => part[0]).join('')}</span><span><strong>{patient.name}</strong><small>{patient.id}</small></span></Link></td>
    <td className="complaint-cell">{visit.complaint}</td><td>{formatDate(visit.date, { day: 'numeric', month: 'short' })}</td><td><Badge tone={priorityTone(visit.priority)}>{visit.priority}</Badge></td><td><Badge tone={statusTone(visit.status)}>{visit.status}</Badge></td><td><Link className="row-open" aria-label={`Open visit ${visit.id}`} to={`/visits/${visit.id}`}><ChevronRight size={17} /></Link></td>
  </tr>)}</tbody></table></div>;
}

export function ActivityList({ events }: { events: DemoState['audit'] }) {
  return <div className="activity-list">{events.map((event) => <div className="activity-item" key={event.id}><span className="activity-dot"><Check size={13} /></span><div><strong>{event.action}</strong><p>{event.description}</p><small>{event.actor} <span>Â·</span> {formatDate(event.date, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small></div></div>)}</div>;
}
