import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, ArrowRight, Bell, ChevronRight, ClipboardList, HeartPulse, LayoutDashboard, Menu, MoreHorizontal, Search, Settings, ShieldCheck, Stethoscope, UserPlus, Users } from 'lucide-react';
import type { DemoState } from './types';
import { createPatient as createBackendPatient, createVisit as createBackendVisit, apiHealth, apiReady, getBackendToken, isBackendMode, loadBackendState, setBackendMode, uploadVisitDocument } from './services/backendApi';
import { loadDemoState, registerPatient, saveDemoState, startVisit } from './services/mockApi';
import { AssessmentPage } from './pages/AssessmentPage';
import { AuditPage } from './pages/AuditPage';
import { CareRoutingPage } from './pages/CareRoutingPage';
import { Dashboard } from './pages/Dashboard';
import { DoctorConsultationPage } from './pages/DoctorConsultationPage';
import { DoctorReviewPage } from './pages/DoctorReviewPage';
import { NotFound } from './pages/NotFound';
import { PatientProfilePage } from './pages/PatientProfilePage';
import { PatientSearchPage } from './pages/PatientSearchPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { TrendsPage } from './pages/TrendsPage';
import { VisitDetailsPage } from './pages/VisitDetailsPage';
import { VisitsPage } from './pages/VisitsPage';
import PrescriptionPage from './pages/PrescriptionPage';
import PharmacyPage from './pages/PharmacyPage';
import {  useLocation } from 'react-router-dom';
const navigation = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Register patient', to: '/register', icon: UserPlus },
  { label: 'Patient records', to: '/patients', icon: Users },
  { label: 'Visit management', to: '/visits', icon: ClipboardList },
  { label: 'Doctor review', to: '/doctor-review', icon: Stethoscope },
  { label: 'Care routing', to: '/care-routing', icon: ArrowRight },
  { label: 'Audit trail', to: '/audit', icon: ShieldCheck },
  { label: 'Prescriptions', to: '/prescriptions', icon: HeartPulse },
  { label: 'Pharmacy', to: '/pharmacy', icon: HeartPulse },
];


function App() {
  const [backendMode, setBackendModeState] = useState(() => isBackendMode());
  const [state, setState] = useState<DemoState>(() => backendMode ? { patients: [], audit: [] } : loadDemoState());
  const [backendError, setBackendError] = useState('');
  const [backendLoading, setBackendLoading] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (backendMode) return;
    try { saveDemoState(state); } catch (error) { console.error(error); }
  }, [state, backendMode]);

  useEffect(() => {
    if (!backendMode) return;
    setBackendLoading(true);
    apiHealth()
      .then(() => {
        if (!getBackendToken()) {
          throw new Error('Backend is reachable. Add a valid bearer token in Settings to load patient records.');
        }
        return apiReady().then(loadBackendState);
      })
      .then((backendState) => {
        setState(backendState);
        setBackendError('');
      })
      .catch((error: unknown) => {
        setBackendError(error instanceof Error ? error.message : 'Unable to load backend records.');
      })
      .finally(() => setBackendLoading(false));
  }, [backendMode]);

  const refreshBackendState = async () => {
    const next = await loadBackendState();
    setState(next);
    setBackendError('');
  };

  const handleAsyncError = (error: unknown) => {
    setBackendError(error instanceof Error ? error.message : 'The backend request could not be completed.');
  };

  const switchDataMode = (enabled: boolean) => {
    setBackendMode(enabled);
    setBackendModeState(enabled);
    setBackendError('');
    setState(enabled ? { patients: [], audit: [] } : loadDemoState());
  };

  const searchResults = globalSearch.trim()
    ? state.patients.filter((patient) => `${patient.name} ${patient.id}`.toLowerCase().includes(globalSearch.toLowerCase()))
    : [];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <Link className="brand" to="/" onClick={() => setMobileNav(false)}>
  <img
    className="brand-logo"
    src="/vynelix-logo-2.png"
    alt="VynelixAI logo"
  />
  <span className="brand-title">
    {/* <strong>VynelixAI</strong> */}
    <strong>AI-Powered Patient care coordination
 </strong>
  </span>
</Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileNav(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === 'AI clinical assessment' && <span className="nav-new">AI</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-link settings-link" onClick={() => navigate('/settings')}><Settings size={18} /><span>Settings</span></button>
          <div className="sidebar-profile"><div className="avatar">HL</div><div><strong>Hannah Lee</strong><span>Triage clinician</span></div><MoreHorizontal size={18} /></div>
        </div>
      </aside>
      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>AI-Powered Patient Care Coordination</strong></div>
          <div className="topbar-right">
            <div className="global-search"><Search size={17} /><input aria-label="Search patients" placeholder="Search patients..." value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && navigate(`/patients?q=${encodeURIComponent(globalSearch)}`)} /><kbd>âŒ˜ K</kbd>
              {searchResults.length > 0 && <div className="search-popover">{searchResults.slice(0, 5).map((patient) => <button key={patient.id} onClick={() => { navigate(`/patients/${patient.id}`); setGlobalSearch(''); }}><div className="avatar avatar-small">{patient.name.split(' ').map((part) => part[0]).join('')}</div><span><strong>{patient.name}</strong><small>{patient.id}</small></span><ChevronRight size={16} /></button>)}</div>}
            </div>
            <div className="demo-tag"><span /> {backendMode ? 'Backend mode' : 'Demo environment'}</div>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <button className="top-avatar" aria-label="Staff profile">HL</button>
          </div>
        </header>
        <div className="page-content">
          {backendError && location.pathname !== "/pharmacy" && (
  <div className="notice-box notice-wide" role="alert">
    <AlertCircle size={17} />
    <span>{backendError}</span>
  </div>
)}
          {backendLoading && <div className="notice-box notice-wide" role="status"><Activity size={17} /><span>Loading records from the backendâ€¦</span></div>}
          <Routes>
            <Route path="/" element={<Dashboard state={state} backendMode={backendMode} />} />
            <Route path="/register" element={<RegisterPage backendMode={backendMode} onCreate={async (input) => {
              if (backendMode) {
                return await createBackendPatient(input);
              }
              const result = registerPatient(state, input);
              setState(result.state);
              return { patientId: result.patient.id, visitId: result.patient.visits[0]?.id ?? '' };
            }} onUpload={uploadVisitDocument} onSaved={async (patientId, unpersistedDocumentCount) => {
              if (backendMode) await refreshBackendState();
              navigate(`/patients/${patientId}`, { state: { registered: true, unpersistedDocumentCount } });
            }} />} />
            <Route path="/patients" element={<PatientSearchPage state={state} backendMode={backendMode} backendError={backendError} backendLoading={backendLoading} />} />
            <Route path="/patients/:patientId" element={<PatientProfilePage state={state} backendMode={backendMode} onError={handleAsyncError} onStartVisit={async (id) => {
              try {
                if (backendMode) {
                  const visitId = await createBackendVisit(id);
                  await refreshBackendState();
                  navigate(`/visits/${visitId}`);
                } else {
                  const next = startVisit(state, id);
                  setState(next);
                  const visit = next.patients.find((patient) => patient.id === id)?.visits[0];
                  if (visit) navigate(`/visits/${visit.id}`);
                }
              } catch (error) { handleAsyncError(error); }
            }} />} />
            <Route path="/visits" element={<VisitsPage state={state} backendMode={backendMode} backendError={backendError} />} />
            <Route path="/visits/:visitId" element={<VisitDetailsPage state={state} setState={setState} backendMode={backendMode} onRefresh={refreshBackendState} onError={handleAsyncError} />} />
            <Route
  path="/consultation/:visitId"
  element={<DoctorConsultationPage state={state}   setState={setState}
      backendMode={backendMode} onRefresh={refreshBackendState} onError={handleAsyncError}/>}
/>
            <Route path="/assessment" element={<AssessmentPage state={state} setState={setState} backendMode={backendMode} onRefresh={refreshBackendState} onError={handleAsyncError} />} />
            <Route path="/trends" element={<TrendsPage state={state} />} />
            <Route path="/doctor-review" element={<DoctorReviewPage state={state} setState={setState} backendMode={backendMode} onRefresh={refreshBackendState} onError={handleAsyncError} />} />
            <Route path="/care-routing" element={<CareRoutingPage state={state} setState={setState} backendMode={backendMode} onRefresh={refreshBackendState} onError={handleAsyncError} />} />
            <Route path="/audit" element={<AuditPage state={state} backendMode={backendMode} />} />
            <Route path="/settings" element={<SettingsPage backendMode={backendMode} onModeChange={switchDataMode} onRefresh={refreshBackendState} onError={handleAsyncError} />} />
            <Route path="*" element={<NotFound />} />
            <Route
  path="/prescriptions"
  element={<PrescriptionPage />}
/>
<Route path="/pharmacy" element={<PharmacyPage />} />
          </Routes>
          <footer className="page-footer">Â© 2026 VynelixAI Health <span>â€¢</span> Demonstration only Â· Synthetic data Â· Not for clinical use</footer>
        </div>
      </main>
    </div>
  );
}

export default App;

