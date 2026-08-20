import { Suspense, lazy, useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  activity,
  login,
  me,
  register,
  securityFindings,
  type ActivityItem,
  type FindingsSummary,
  type User,
} from '../api';
import ApiDocs from './ApiDocs';

const SwaggerDocs = lazy(() => import('./SwaggerDocs'));

const ACTIVITY_LABELS: Record<ActivityItem['type'], string> = {
  'user.registered': 'Account created',
  'user.login.succeeded': 'Signed in',
  'user.login.failed': 'Failed sign-in attempt',
};

const TOKEN_KEY = 'superstruct-user.token';

export default function AuthPanel() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [profile, setProfile] = useState<User | null>(null);
  const [posture, setPosture] = useState<FindingsSummary | null>(null);
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [swaggerOpen, setSwaggerOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setPosture(null);
      setEvents([]);
      return;
    }
    me(token)
      .then(setProfile)
      .catch(() => logout()); // expired or invalid token
    securityFindings(token)
      .then(setPosture)
      .catch(() => setPosture(null));
    activity(token)
      .then((r) => setEvents(r.items))
      .catch(() => setEvents([]));
  }, [token, logout]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'register') {
        await register({ email, password, firstName, lastName });
        setNotice('Account created — log in to continue.');
        setMode('login');
      } else {
        const result = await login({ email, password });
        localStorage.setItem(TOKEN_KEY, result.token);
        setToken(result.token);
      }
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {profile ? (
        <section className="card">
          <h2>
            {profile.firstName} {profile.lastName}
          </h2>
          <dl>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
            <dt>User ID</dt>
            <dd>
              <code>{profile.id}</code>
            </dd>
            <dt>Registered</dt>
            <dd>{new Date(profile.createdAt).toLocaleString()}</dd>
          </dl>
          <button onClick={logout}>Log out</button>

          {events.length > 0 && (
            <div className="posture">
              <h3>Recent activity</h3>
              <ul className="activity">
                {events.map((e) => (
                  <li key={`${e.at}-${e.type}`}>
                    <span className={e.type === 'user.login.failed' ? 'activity-bad' : ''}>
                      {ACTIVITY_LABELS[e.type] ?? e.type}
                    </span>{' '}
                    — {new Date(e.at).toLocaleString()}
                    {e.sourceIp && <span className="muted"> · from {e.sourceIp}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {posture && (
            <div className="posture">
              <h3>Platform security posture</h3>
              <div className="badges">
                <span className="badge critical">{posture.counts.critical} critical</span>
                <span className="badge high">{posture.counts.high} high</span>
                <span className="badge medium">{posture.counts.medium} medium</span>
                <span className="badge low">{posture.counts.low} low</span>
              </div>
              <ul>
                {posture.topFailedControls.map((c) => (
                  <li key={c.id}>
                    <code>{c.id}</code> {c.title}
                  </li>
                ))}
              </ul>
              <p className="muted">
                Open findings from AWS Security Hub (FSBP + NIST 800-53), updated{' '}
                {new Date(posture.fetchedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </section>
      ) : (
        <section className="card">
          <div className="tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Log in
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="stack">
            {mode === 'register' && (
              <>
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button type="submit" disabled={busy}>
              {mode === 'register' ? 'Create account' : 'Log in'}
            </button>
          </form>

          {notice && <p className="notice">{notice}</p>}
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {profile && (
        <>
          <ApiDocs />

          <details
            className="card docs"
            onToggle={(e) => setSwaggerOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary>Interactive API explorer (Swagger UI)</summary>
            {swaggerOpen && (
              <Suspense fallback={<p className="muted">Loading Swagger UI…</p>}>
                <SwaggerDocs />
              </Suspense>
            )}
          </details>
        </>
      )}
    </>
  );
}
