export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface LoginResult {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

const BASE_URL: string = import.meta.env.PUBLIC_API_URL ?? '';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};

export const register = (input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<User> => request('/api/v1/register', { method: 'POST', body: JSON.stringify(input) });

export const login = (input: { email: string; password: string }): Promise<LoginResult> =>
  request('/api/v1/login', { method: 'POST', body: JSON.stringify(input) });

export const me = (token: string): Promise<User> =>
  request('/api/v1/me', { headers: { authorization: `Bearer ${token}` } });

export interface FindingsSummary {
  counts: { critical: number; high: number; medium: number; low: number };
  topFailedControls: { id: string; title: string; severity: string }[];
  fetchedAt: string;
}

export const securityFindings = (token: string): Promise<FindingsSummary> =>
  request('/api/v1/security/findings', { headers: { authorization: `Bearer ${token}` } });

export interface ActivityItem {
  type: 'user.registered' | 'user.login.succeeded' | 'user.login.failed';
  at: string;
  sourceIp?: string;
  userAgent?: string;
  reason?: string;
}

export const activity = (token: string): Promise<{ items: ActivityItem[] }> =>
  request('/api/v1/me/activity', { headers: { authorization: `Bearer ${token}` } });
