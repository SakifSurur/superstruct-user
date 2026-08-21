import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';
import { hashPassword, requireAuth, signToken, verifyPassword } from '../src/lib/auth';
import { HttpError } from '../src/lib/http';
import { makeEvent } from './helpers';

const SIGNING_KEY = createPrivateKey(process.env.JWT_PRIVATE_KEY!);

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
  it('round-trips: signToken produces a token requireAuth accepts', async () => {
    const token = await signToken('user-123', 'a@b.co');
    const event = makeEvent({ headers: { authorization: `Bearer ${token}` } });
    await expect(requireAuth(event)).resolves.toEqual({ userId: 'user-123' });
  });

  it('rejects a missing Authorization header with 401', async () => {
    await expect(requireAuth(makeEvent())).rejects.toMatchObject(
      new HttpError(401, 'Missing bearer token'),
    );
  });

  it('rejects a tampered token with 401', async () => {
    const token = await signToken('user-123', 'a@b.co');
    const event = makeEvent({ headers: { authorization: `Bearer ${token}x` } });
    await expect(requireAuth(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects an expired token with 401', async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('user-123')
      .setIssuer('superstruct-user-api')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(SIGNING_KEY);
    const event = makeEvent({ headers: { authorization: `Bearer ${expired}` } });
    await expect(requireAuth(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a token from another issuer with 401', async () => {
    const foreign = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('user-123')
      .setIssuer('someone-else')
      .setExpirationTime('1h')
      .sign(SIGNING_KEY);
    const event = makeEvent({ headers: { authorization: `Bearer ${foreign}` } });
    await expect(requireAuth(event)).rejects.toMatchObject({ statusCode: 401 });
  });
});
