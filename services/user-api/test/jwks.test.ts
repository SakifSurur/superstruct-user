import { describe, expect, it } from 'vitest';
import { handler } from '../src/handlers/jwks';

describe('GET /.well-known/jwks.json', () => {
  it('serves the RS256 public key with the configured kid', async () => {
    const result = (await handler()) as { statusCode: number; body: string };
    expect(result.statusCode).toBe(200);
    const jwks = JSON.parse(result.body) as { keys: Record<string, string>[] };
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig', kid: 'test-kid' });
    expect(jwks.keys[0]!.n).toBeTruthy();
    expect(jwks.keys[0]!.e).toBeTruthy();
  });

  it('never exposes private key material', async () => {
    const result = (await handler()) as { body: string };
    const key = (JSON.parse(result.body) as { keys: Record<string, unknown>[] }).keys[0]!;
    for (const field of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      expect(key).not.toHaveProperty(field);
    }
  });
});
