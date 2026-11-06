import { useState } from 'react';
import { Activity, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button, Badge, Card, PageTitle, Field, Detail } from '../components/ui';
import { apiReady, getBackendToken, saveBackendToken } from '../services/backendApi';

export function SettingsPage({
  backendMode,
  onModeChange,
  onRefresh,
  onError,
}: {
  backendMode: boolean;
  onModeChange: (enabled: boolean) => void;
  onRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [token, setToken] = useState(getBackendToken());
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const connect = async () => {
    saveBackendToken(token);
    try {
      setChecking(true);
      await apiReady();
      if (backendMode) await onRefresh();
      else onModeChange(true);
      setMessage('Backend database readiness passed. Patient and workflow records loaded from the backend.');
    } catch (error) {
      onError(error);
    } finally {
      setChecking(false);
    }
  };
  const disconnect = () => {
    onModeChange(false);
    setMessage('Switched back to mock mode.');
  };
  return <>
    <PageTitle eyebrow="WORKSPACE" title="Settings" description="Choose local mock data or connect this UI to the authenticated backend." />
    <div className="settings-grid">
      <Card>
        <div className="card-heading"><div><h2>Data source</h2><p>Mock mode remains available at any time.</p></div><Badge tone={backendMode ? 'green' : 'blue'}>{backendMode ? 'Backend mode' : 'Mock mode'}</Badge></div>
        <Detail label="API base URL" value={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'} />
        <Detail label="Current source" value={backendMode ? 'Authenticated FastAPI + MongoDB' : 'Browser local-storage sample data'} />
        <div className="form-grid">
          <Field label="Backend bearer token" hint="Stored in this tabâ€™s session storage only. Do not paste a JWT signing secret here.">
            <input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste a valid access token" />
          </Field>
        </div>
        <div className="form-actions">
          <Button disabled={checking || !token.trim()} onClick={() => void connect()}>{checking ? 'Checkingâ€¦' : backendMode ? 'Save token and reload records' : 'Check backend and connect'}</Button>
          {backendMode && <Button variant="secondary" disabled={checking} onClick={disconnect}>Switch to mock mode</Button>}
        </div>
        {message && <div className="success-message"><CheckCircle2 size={15} /> {message}</div>}
        <p className="body-copy">Create a short-lived development JWT with a trusted issuer and the correct role. The browser cannot create or sign its own token. The token is kept only for this tab and removed when the tab session ends.</p>
      </Card>
      <Card><div className="card-heading"><div><h2>Workflow limitations</h2><p>Prototype behavior</p></div></div><Detail label="AI assessment" value="Simulated; clinician review required" /><Detail label="Document extraction" value="Not implemented; files are not analysed" /><Detail label="Care routing" value="Simulated department route only" /><div className="notice-box"><ShieldCheck size={16} /><span>Do not enter real patient information. This prototype is not a clinical record system or validated decision support.</span></div></Card>
      {!backendMode && <Card className="settings-reset"><div className="card-heading"><div><h2>Reset demo data</h2><p>Clear locally stored workflow changes and restore sample records.</p></div></div><Button variant="secondary" onClick={() => { localStorage.removeItem('vynelixai-demo-state-v1'); window.location.reload(); }}><Activity size={16} /> Reset to sample data</Button></Card>}
    </div>
  </>;
}
