import { randomUUID } from 'node:crypto';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { omit } from 'es-toolkit';
import { z } from 'zod';
import { audit } from '../lib/audit';
import { ddb, USERS_TABLE } from '../lib/dynamo';
import { HttpError, json, withErrorHandling } from '../lib/http';
import { parseBodyWith } from '../lib/validate';
import {
  TOKEN_TTL_SECONDS,
  hashPassword,
  requireAuth,
  signToken,
  verifyPassword,
} from '../lib/auth';

const userRecordSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  passwordHash: z.string(),
  createdAt: z.string(),
});
type UserRecord = z.infer<typeof userRecordSchema>;

const emailMarkerSchema = z.object({ userId: z.string() });
const statsRecordSchema = z.object({ userCount: z.number() });

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('must be a valid email address')),
  password: z.string('must be at least 8 characters').min(8, 'must be at least 8 characters'),
  firstName: z.string('is required').trim().min(1, 'is required'),
  lastName: z.string('is required').trim().min(1, 'is required'),
});

const loginSchema = z.object({
  email: z.string('is required').trim().toLowerCase().min(1, 'is required'),
  password: z.string('is required').min(1, 'is required'),
});

const STATS_KEY = 'stats#users';
const emailKey = (email: string) => `email#${email}`;

// Unknown emails are verified against this so both login failure paths take equal time.
const DUMMY_HASH =
  'p1DhpzSuXQyIKZzXQGSXUA==:kY8W0Zg2m2wJt0R1nJ0S3v9m5m5nUKq0m8h6b3n0T4t9wS3v9m5m5nUKq0m8h6b3n0T4t9wS3v9m5m5nUKq0m8h6bw==';

const toPublic = (user: UserRecord) => omit(user, ['passwordHash']);

const loadUser = async (id: string): Promise<UserRecord | undefined> => {
  const result = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { id } }));
  return result.Item ? userRecordSchema.parse(result.Item) : undefined;
};

export const register = withErrorHandling(async (event) => {
  const input = parseBodyWith(registerSchema, event);

  const user: UserRecord = {
    id: randomUUID(),
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };

  try {
    // One transaction: user, email-uniqueness marker, stats counter.
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
              Item: { id: emailKey(input.email), userId: user.id },
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

export const login = withErrorHandling(async (event) => {
  const input = parseBodyWith(loginSchema, event);

  const result = await ddb.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { id: emailKey(input.email) },
      ConsistentRead: true,
    }),
  );
  const marker = emailMarkerSchema.safeParse(result.Item);

  if (!marker.success) {
    await verifyPassword(input.password, DUMMY_HASH);
    await audit('user.login.failed', { email: input.email, reason: 'unknown_email' }, event);
    throw new HttpError(401, 'Invalid email or password');
  }

  const { userId } = marker.data;
  const user = await loadUser(userId);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    await audit('user.login.failed', { userId, email: input.email, reason: 'wrong_password' }, event);
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
  const { userId } = requireAuth(event);

  const user = await loadUser(userId);
  if (!user) throw new HttpError(404, 'User no longer exists');

  return json(200, toPublic(user));
});

export const stats = withErrorHandling(async () => {
  const result = await ddb.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { id: STATS_KEY } }),
  );
  const record = statsRecordSchema.safeParse(result.Item);

  return json(200, { totalUsers: record.success ? record.data.userCount : 0 });
});
