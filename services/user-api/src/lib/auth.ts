import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
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

const ISSUER = 'superstruct-user-api';
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
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(PRIVATE_KEY);

// Throws a detail-free 401 on any failure.
export const requireAuth = async (event: APIGatewayProxyEventV2): Promise<{ userId: string }> => {
  const token = event.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Missing bearer token');
  try {
    const { payload } = await jwtVerify(token, PUBLIC_KEY, {
      issuer: ISSUER,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('token has no subject');
    return { userId: payload.sub };
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
};
