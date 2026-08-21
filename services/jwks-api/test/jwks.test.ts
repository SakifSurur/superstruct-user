import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { jwks, openidConfiguration } from '../src/handler';

describe('GET /.well-known/jwks.json', () => {
  it('serves the RS256 public key with the configured kid', async () => {
    const result = await jwks();
    expect(result.statusCode).toBe(200);
    const doc = JSON.parse(result.body ?? '') as { keys: Record<string, string>[] };
    expect(doc.keys).toHaveLength(1);
    expect(doc.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig', kid: 'test-kid' });
    expect(doc.keys[0]?.n).toBeTruthy();
    expect(doc.keys[0]?.e).toBeTruthy();
  });

  it('never exposes private key material', async () => {
    const result = await jwks();
    const key = (JSON.parse(result.body ?? '') as { keys: Record<string, unknown>[] }).keys[0];
    for (const field of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      expect(key).not.toHaveProperty(field);
    }
  });
});

describe('GET /.well-known/openid-configuration', () => {
  it('serves a discovery document pointing at the JWKS', async () => {
    const event = {
      requestContext: { domainName: 'abc123.execute-api.eu-central-1.amazonaws.com' },
    } as APIGatewayProxyEventV2;
    const result = await openidConfiguration(event);
    expect(result.statusCode).toBe(200);
    const doc = JSON.parse(result.body ?? '') as Record<string, unknown>;
    expect(doc.issuer).toBe('https://abc123.execute-api.eu-central-1.amazonaws.com');
    expect(doc.jwks_uri).toBe(
      'https://abc123.execute-api.eu-central-1.amazonaws.com/.well-known/jwks.json',
    );
  });
});
