import { randomUUID } from 'node:crypto';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { audit } from '../lib/audit';
import { ddb, USERS_TABLE } from '../lib/dynamo';
import { HttpError, json, parseBody, withErrorHandling } from '../lib/http';
import {
  TOKEN_TTL_SECONDS,
  hashPassword,
  requireAuth,
  signToken,
  verifyPassword,
} from '../lib/auth';

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  createdAt: string;
}

type PublicUser = Omit<UserRecord, 'passwordHash'>;

const STATS_KEY = 'stats#users';
const emailKey = (email: string) => `email#${email}`;

// Valid-format hash of a random password; login verifies against it when the
// email is unknown so both failure paths cost the same wall-clock time.
const DUMMY_HASH =
  'p1DhpzSuXQyIKZzXQGSXUA==:kY8W0Zg2m2wJt0R1nJ0S3v9m5m5nUKq0m8h6b3n0T4t9wS3v9m5m5nUKq0m8h6b3n0T4t9wS3v9m5m5nUKq0m8h6bw==';

const toPublic = (user: UserRecord): PublicUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  createdAt: user.createdAt,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterInput {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

export const register = withErrorHandling(async (event) => {
  const input = parseBody<RegisterInput>(event);
  const email = input.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    throw new HttpError(400, '"email" must be a valid email address');
  }
  if (typeof input.password !== 'string' || input.password.length < 8) {
    throw new HttpError(400, '"password" must be at least 8 characters');
  }
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  if (!firstName || !lastName) {
    throw new HttpError(400, '"firstName" and "lastName" are required');
  }

  const user: UserRecord = {
    id: randomUUID(),
    email,
    firstName,
    lastName,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };

  try {
    // One atomic transaction: the user, an email-uniqueness marker, and the
    // user counter that backs /stats.
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: USERS_TABLE,
              Item: user,
              ConditionExpression: 'attribute_not_exists(id)',
            },
          },
          {
            Put: {
              TableName: USERS_TABLE,
              Item: { id: emailKey(email), userId: user.id },
              ConditionExpression: 'attribute_not_exists(id)',
            },
          },
          {
            Update: {
              TableName: USERS_TABLE,
              Key: { id: STATS_KEY },
              UpdateExpression: 'ADD userCount :one',
              ExpressionAttributeValues: { ':one': 1 },
            },
          },
        ],
      }),
    );
  } catch (error) {
    if (
      error instanceof TransactionCanceledException &&
      error.CancellationReasons?.some((r) => r.Code === 'ConditionalCheckFailed')
    ) {
      throw new HttpError(409, 'An account with this email already exists');
    }
    throw error;
  }

  await audit('user.registered', { userId: user.id, email: user.email }, event);

  return json(201, toPublic(user));
});

interface LoginInput {
  email?: string;
  password?: string;
}

export const login = withErrorHandling(async (event) => {
  const input = parseBody<LoginInput>(event);
  const email = input.email?.trim().toLowerCase();
  if (!email || typeof input.password !== 'string') {
    throw new HttpError(400, '"email" and "password" are required');
  }

  const marker = await ddb.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { id: emailKey(email) }, ConsistentRead: true }),
  );
  const userId = (marker.Item as { userId?: string } | undefined)?.userId;

  if (!userId) {
    await verifyPassword(input.password, DUMMY_HASH);
    await audit('user.login.failed', { email, reason: 'unknown_email' }, event);
    throw new HttpError(401, 'Invalid email or password');
  }

  const result = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { id: userId } }));
  const user = result.Item as UserRecord | undefined;
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    await audit('user.login.failed', { userId, email, reason: 'wrong_password' }, event);
    throw new HttpError(401, 'Invalid email or password');
  }

  await audit('user.login.succeeded', { userId: user.id, email: user.email }, event);

  return json(200, {
    token: await signToken(user.id, user.email),
    tokenType: 'Bearer',
    expiresIn: TOKEN_TTL_SECONDS,
    user: toPublic(user),
  });
});

export const me = withErrorHandling(async (event) => {
  const { userId } = await requireAuth(event);

  const result = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { id: userId } }));
  const user = result.Item as UserRecord | undefined;
  if (!user) throw new HttpError(404, 'User no longer exists');

  return json(200, toPublic(user));
});

export const stats = withErrorHandling(async () => {
  const result = await ddb.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { id: STATS_KEY } }),
  );
  const count = (result.Item as { userCount?: number } | undefined)?.userCount ?? 0;

  return json(200, { totalUsers: count });
});
