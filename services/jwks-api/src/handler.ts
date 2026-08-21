import { createPrivateKey, createPublicKey } from 'node:crypto';
import { exportJWK } from 'jose';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { z } from 'zod';

const env = z
  .object({
    JWT_PRIVATE_KEY: z.string().min(1, 'JWT_PRIVATE_KEY environment variable is not set'),
    JWT_KID: z.string().min(1).default('jwt-1'),
  })
  .parse(process.env);

const PUBLIC_KEY = createPublicKey(createPrivateKey(env.JWT_PRIVATE_KEY));

const CACHE_HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'public, max-age=3600',
};

let cached: string | undefined;

export const jwks = async (): Promise<APIGatewayProxyStructuredResultV2> => {
  if (!cached) {
    const jwk = await exportJWK(PUBLIC_KEY);
    cached = JSON.stringify({ keys: [{ ...jwk, alg: 'RS256', use: 'sig', kid: env.JWT_KID }] });
  }
  return { statusCode: 200, headers: CACHE_HEADERS, body: cached };
};

// Minimal OIDC discovery document — API Gateway JWT authorizers validate the
// issuer by fetching this and reading jwks_uri. The issuer is derived from
// the request's own domain to avoid a circular stack reference.
export const openidConfiguration = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const issuer = `https://${event.requestContext.domainName}`;
  return {
    statusCode: 200,
    headers: CACHE_HEADERS,
    body: JSON.stringify({
      issuer,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      id_token_signing_alg_values_supported: ['RS256'],
      response_types_supported: ['token'],
      subject_types_supported: ['public'],
    }),
  };
};
