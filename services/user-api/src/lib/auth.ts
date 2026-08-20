import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { HttpError } from './http';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is not set');
}
const SIGNING_KEY = new TextEncoder().encode(jwtSecret);

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
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(SIGNING_KEY);

// Throws a detail-free 401 on any failure.
export const requireAuth = async (event: APIGatewayProxyEventV2): Promise<{ userId: string }> => {
  const token = event.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Missing bearer token');
  try {
    const { payload } = await jwtVerify(token, SIGNING_KEY, { issuer: ISSUER });
    if (!payload.sub) throw new Error('token has no subject');
    return { userId: payload.sub };
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
};
