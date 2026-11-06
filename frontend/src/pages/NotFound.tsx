import { Link } from 'react-router-dom';

export function NotFound() { return <div className="not-found"><span>404</span><h1>We couldnâ€™t find that record.</h1><p>The page may have moved or the demo record may not exist.</p><Link to="/" className="button button-primary">Return to dashboard</Link></div>; }
