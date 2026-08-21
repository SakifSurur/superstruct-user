import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT } from 'jose';
import type { APIGatewayProxyEventV2, APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { HttpError } from './http';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const privateKeyPem = process.env.JWT_PRIVATE_KEY;
if (!privateKeyPem) {
  throw new Error('JWT_PRIVATE_KEY environment variable is not set');
}

export const PRIVATE_KEY = createPrivateKey(privateKeyPem);
export const PUBLIC_KEY = createPublicKey(PRIVATE_KEY);
export const KID = process.env.JWT_KID ?? 'jwt-1';
export const ISSUER = process.env.JWT_ISSUER ?? 'superstruct-user-api';
export const AUDIENCE = 'superstruct-user-api';

export const TOKEN_TTL_SECONDS = 3600;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [saltB64, hashB64] = stored.split(':');
  if (!saltB64 || !hashB64) return false;
  const hash = await scrypt(password, Buffer.from(saltB64, 'base64'), 64);
  const expected = Buffer.from(hashB64, 'base64');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
};

export const signToken = (userId: string, email: string): Promise<string> =>
  new SignJWT({ email })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(PRIVATE_KEY);

// Token verification happens in API Gateway's native JWT authorizer; the
// handler only reads the validated claims it forwarded.
export const requireAuth = (event: APIGatewayProxyEventV2): { userId: string } => {
  const claims = (event as APIGatewayProxyEventV2WithJWTAuthorizer).requestContext.authorizer?.jwt
    ?.claims;
  const sub = claims?.sub;
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new HttpError(401, 'Missing authorizer claims');
  }
  return { userId: sub };
};
