import { createPrivateKey, createPublicKey } from 'node:crypto';
import { exportJWK } from 'jose';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const privateKeyPem = process.env.JWT_PRIVATE_KEY;
if (!privateKeyPem) {
  throw new Error('JWT_PRIVATE_KEY environment variable is not set');
}

const PUBLIC_KEY = createPublicKey(createPrivateKey(privateKeyPem));
const KID = process.env.JWT_KID ?? 'jwt-1';

let cached: string | undefined;

export const jwks = async (): Promise<APIGatewayProxyResultV2> => {
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

// Minimal OIDC discovery document — API Gateway JWT authorizers validate the
// issuer by fetching this and reading jwks_uri. The issuer is derived from
// the request's own domain to avoid a circular stack reference.
export const openidConfiguration = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const issuer = `https://${event.requestContext.domainName}`;
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
    body: JSON.stringify({
      issuer,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      id_token_signing_alg_values_supported: ['RS256'],
      response_types_supported: ['token'],
      subject_types_supported: ['public'],
    }),
  };
};
