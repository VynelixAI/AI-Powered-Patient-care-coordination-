import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Search } from 'lucide-react';
import type { DemoState } from '../types';
import { Card, PageTitle } from '../components/ui';
import { latestVisits } from '../utils/clinical';
import { searchVisits } from '../services/backendApi';
import { VisitTable } from './Dashboard';

export function VisitsPage({ state, backendMode, backendError }: { state: DemoState; backendMode: boolean; backendError: string }) {
  const [status, setStatus] = useState('All statuses');
  const [query, setQuery] = useState('');
  const [matchedVisitIds, setMatchedVisitIds] = useState<string[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  useEffect(() => {
    if (!backendMode) {
      setMatchedVisitIds(null);
      setListError('');
      setListLoading(false);
      return;
    }
    let active = true;
    setListLoading(true);
    setListError('');
    searchVisits(query, status === 'All statuses' ? '' : status)
      .then((ids) => { if (active) setMatchedVisitIds(ids); })
      .catch((error: unknown) => {
        if (active) setListError(error instanceof Error ? error.message : 'Visit search failed.');
      })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [backendMode, query, status]);
  const visits = latestVisits(state).filter(({ patient, visit }) => backendMode
    ? matchedVisitIds?.includes(visit.id) === true
    : (status === 'All statuses' || visit.status === status) && `${patient.name} ${patient.id} ${visit.complaint}`.toLowerCase().includes(query.toLowerCase()));
  const error = listError || (backendMode && !state.patients.length ? backendError : '');
  return <><PageTitle eyebrow="WORKFLOW" title="Visit management" description="Review current and historical patient encounters." /><Card><div className="filters-row"><div className="search-field"><Search size={17} /><input placeholder="Search visits or patients..." aria-label="Search visits" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by visit status"><option>All statuses</option><option>Awaiting review</option><option>In progress</option><option>Routed</option><option>Completed</option></select><span className="result-count">{visits.length} visits</span></div>{error ? <div className="notice-box registration-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div> : listLoading ? <div className="empty-state" role="status"><Activity size={22} /><strong>Loading visitsâ€¦</strong></div> : <VisitTable visits={visits} />}</Card></>;
}
