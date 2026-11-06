import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, ArrowRight, Plus, Search, X } from 'lucide-react';
import type { DemoState } from '../types';
import { Button, Badge, Card, PageTitle } from '../components/ui';
import { formatDate } from '../utils/clinical';
import { searchPatients } from '../services/backendApi';

export function PatientSearchPage({ state, backendMode, backendError, backendLoading }: { state: DemoState; backendMode: boolean; backendError: string; backendLoading: boolean }) {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [condition, setCondition] = useState('All conditions');
  const [matchedPatientIds, setMatchedPatientIds] = useState<string[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  useEffect(() => {
    if (!backendMode || !query.trim()) {
      setMatchedPatientIds(null);
      setSearchError('');
      setSearchLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError('');
      searchPatients(query.trim())
        .then((ids) => { if (active) setMatchedPatientIds(ids); })
        .catch((error: unknown) => {
          if (active) setSearchError(error instanceof Error ? error.message : 'Patient search failed.');
        })
        .finally(() => { if (active) setSearchLoading(false); });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [backendMode, query]);
  const patients = state.patients.filter((patient) => {
    const matches = backendMode
      ? (!query.trim() || matchedPatientIds?.includes(patient.id) === true)
      : `${patient.name} ${patient.id} ${patient.phone}`.toLowerCase().includes(query.toLowerCase());
    return matches && (condition === 'All conditions' || patient.conditions.includes(condition));
  });
  const conditions = [...new Set(state.patients.flatMap((patient) => patient.conditions))];
  return <>
    <PageTitle eyebrow="PATIENT DIRECTORY" title="Patient records" description="Find a returning patient and continue their care journey." action={<Link className="button button-primary" to="/register"><Plus size={17} /> Register patient</Link>} />
    <Card>
      <div className="filters-row"><div className="search-field"><Search size={17} /><input aria-label="Search by patient name, ID or phone" placeholder="Search by name, Hospital Patient ID or phone..." value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}</div><select aria-label="Filter by condition" value={condition} onChange={(event) => setCondition(event.target.value)}><option>All conditions</option>{conditions.map((item) => <option key={item}>{item}</option>)}</select><span className="result-count">{patients.length} patients</span></div>
      {searchError || backendError ? <div className="notice-box registration-error" role="alert"><AlertCircle size={16} /><span>{searchError || backendError}</span></div> : searchLoading || backendLoading ? <div className="empty-state" role="status"><Activity size={22} /><strong>{searchLoading ? 'Searching patient recordsâ€¦' : 'Loading patient recordsâ€¦'}</strong></div> : patients.length ? <div className="table-scroll"><table><thead><tr><th>Patient</th><th>Hospital Patient ID</th><th>Date of birth</th><th>Conditions</th><th>Last visit</th><th /></tr></thead><tbody>{patients.map((patient) => <tr key={patient.id}><td><Link className="patient-cell" to={`/patients/${patient.id}`}><span className="avatar avatar-small">{patient.name.split(' ').map((part) => part[0]).join('')}</span><span><strong>{patient.name}</strong><small>{patient.gender}</small></span></Link></td><td className="mono">{patient.id}</td><td>{formatDate(patient.dateOfBirth)}</td><td>{patient.conditions.length ? patient.conditions.slice(0, 2).map((conditionItem) => <Badge key={conditionItem} tone="neutral">{conditionItem}</Badge>) : <span className="muted">None recorded</span>}</td><td>{patient.visits[0] ? formatDate(patient.visits[0].date) : 'â€”'}</td><td><Link className="button button-quiet button-small" to={`/patients/${patient.id}`}>Open record <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div> : <div className="empty-state"><Search size={25} /><strong>No matching patients</strong><span>Try another name or Hospital Patient ID.</span><Button variant="secondary" onClick={() => { setQuery(''); setCondition('All conditions'); }}>Clear filters</Button></div>}
    </Card>
    <div className="notice-box notice-wide"><AlertCircle size={17} /><span>A Hospital Patient ID is a synthetic demo identifier and does not verify a real person's identity.</span></div>
  </>;
}
