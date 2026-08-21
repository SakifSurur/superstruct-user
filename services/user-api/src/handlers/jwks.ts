import { exportJWK } from 'jose';
import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { KID, PUBLIC_KEY } from '../lib/auth';

let cached: string | undefined;

// Public JWKS document so any consumer (edge validators, API Gateway JWT
// authorizers, third parties) can verify our RS256 tokens.
export const handler = async (): Promise<APIGatewayProxyResultV2> => {
  if (!cached) {
    const jwk = await exportJWK(PUBLIC_KEY);
    cached = JSON.stringify({ keys: [{ ...jwk, alg: 'RS256', use: 'sig', kid: KID }] });
  }
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
    body: cached,
  };
};
