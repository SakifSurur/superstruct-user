import { describe, expect, it } from 'vitest';
import { jwtVerify } from 'jose';
import {
  AUDIENCE,
  ISSUER,
  KID,
  PUBLIC_KEY,
  hashPassword,
  requireAuth,
  signToken,
  verifyPassword,
} from '../src/lib/auth';
import { HttpError } from '../src/lib/http';
import { authedEvent, makeEvent } from './helpers';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const stored = await hashPassword('hunter2hunter2');
    await expect(verifyPassword('hunter2hunter2', stored)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('hunter2hunter2');
    await expect(verifyPassword('not-the-password', stored)).resolves.toBe(false);
  });

  it('salts each hash so identical passwords produce different hashes', async () => {
    const [a, b] = await Promise.all([hashPassword('same-pass'), hashPassword('same-pass')]);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    await expect(verifyPassword('anything', 'no-separator')).resolves.toBe(false);
    await expect(verifyPassword('anything', '')).resolves.toBe(false);
  });
});

describe('JWT', () => {
  it('mints RS256 tokens with issuer, audience, subject, and kid', async () => {
    const token = await signToken('user-123', 'a@b.co');
    const { payload, protectedHeader } = await jwtVerify(token, PUBLIC_KEY, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    expect(protectedHeader).toMatchObject({ alg: 'RS256', kid: KID });
    expect(payload.sub).toBe('user-123');
    expect(payload.email).toBe('a@b.co');
  });

  it('reads the authenticated user from authorizer claims', () => {
    expect(requireAuth(authedEvent('user-123'))).toEqual({ userId: 'user-123' });
  });

  it('rejects requests without authorizer claims with 401', () => {
    expect(() => requireAuth(makeEvent())).toThrowError(HttpError);
  });
});
