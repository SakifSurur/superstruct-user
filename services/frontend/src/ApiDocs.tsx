const BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

interface Endpoint {
  method: string;
  path: string;
  auth: boolean;
  description: string;
  example?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST',
    path: '/v1/register',
    auth: false,
    description: 'Create an account. Password must be at least 8 characters.',
    example: '{ "email": "...", "password": "...", "firstName": "...", "lastName": "..." }',
  },
  {
    method: 'POST',
    path: '/v1/login',
    auth: false,
    description: 'Exchange credentials for a JWT (HS256, valid 1 hour).',
    example: '{ "email": "...", "password": "..." }',
  },
  {
    method: 'GET',
    path: '/v1/me',
    auth: true,
    description: 'Profile of the authenticated user.',
  },
  {
    method: 'GET',
    path: '/v1/me/activity',
    auth: true,
    description: 'Your last 20 audit events (registration, sign-ins, failed attempts).',
  },
  {
    method: 'GET',
    path: '/v1/stats',
    auth: false,
    description: 'Total number of registered users.',
  },
  {
    method: 'GET',
    path: '/v1/security/findings',
    auth: true,
    description: 'Aggregated AWS Security Hub posture (severity counts, top failed controls).',
  },
];

export default function ApiDocs() {
  return (
    <details className="card docs">
      <summary>API reference</summary>
      <p className="muted">
        Base URL: <code>{BASE_URL}</code> — JSON in, JSON out. Authenticated endpoints expect{' '}
        <code>Authorization: Bearer &lt;token&gt;</code> from <code>/v1/login</code>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Auth</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {ENDPOINTS.map((e) => (
            <tr key={`${e.method} ${e.path}`}>
              <td>
                <code>
                  {e.method} {e.path}
                </code>
              </td>
              <td>{e.auth ? 'JWT' : '—'}</td>
              <td>
                {e.description}
                {e.example && (
                  <div className="muted">
                    <code>{e.example}</code>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Errors are JSON: <code>{'{ "message": "..." }'}</code> with 400 (validation), 401 (bad or
        missing token/credentials), 409 (email already registered).
      </p>
    </details>
  );
}
