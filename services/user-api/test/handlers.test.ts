import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { login, me, register, stats } from '../src/handlers/auth';
import { hashPassword } from '../src/lib/auth';
import { authedEvent, invoke, jsonEvent, makeEvent } from './helpers';

const ddb = mockClient(DynamoDBDocumentClient);
const eventBridge = mockClient(EventBridgeClient);

beforeEach(() => {
  ddb.reset();
  eventBridge.reset();
  eventBridge.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
});

const emittedAuditTypes = () =>
  eventBridge
    .commandCalls(PutEventsCommand)
    .flatMap((c) => c.args[0].input.Entries ?? [])
    .map((e) => e.DetailType);

const registerInput = {
  email: 'jane@example.com',
  password: 'correct-horse',
  firstName: 'Jane',
  lastName: 'Doe',
};

describe('POST /register', () => {
  it('creates a user and returns 201 without the password hash', async () => {
    ddb.on(TransactWriteCommand).resolves({});

    const result = await invoke(register, jsonEvent(registerInput));

    expect(result.statusCode).toBe(201);
    const body = result.body as Record<string, unknown>;
    expect(body.id).toEqual(expect.any(String));
    expect(body.email).toBe('jane@example.com');
    expect(body.firstName).toBe('Jane');
    expect(body.lastName).toBe('Doe');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('password');
  });

  it('writes user, email marker, and stats counter in one transaction', async () => {
    ddb.on(TransactWriteCommand).resolves({});

    await invoke(register, jsonEvent({ ...registerInput, email: ' Jane@Example.COM ' }));

    const calls = ddb.commandCalls(TransactWriteCommand);
    expect(calls).toHaveLength(1);
    const items = calls[0]!.args[0].input.TransactItems!;
    expect(items).toHaveLength(3);
    // email normalized before it becomes the uniqueness key
    expect(items[0]!.Put!.Item!.email).toBe('jane@example.com');
    expect(items[1]!.Put!.Item!.id).toBe('email#jane@example.com');
    expect(items[1]!.Put!.ConditionExpression).toBe('attribute_not_exists(id)');
    expect(items[2]!.Update!.Key!.id).toBe('stats#users');
  });

  it('emits a user.registered audit event with no password material', async () => {
    ddb.on(TransactWriteCommand).resolves({});

    await invoke(register, jsonEvent(registerInput));

    expect(emittedAuditTypes()).toEqual(['user.registered']);
    const entry = eventBridge.commandCalls(PutEventsCommand)[0]!.args[0].input.Entries![0]!;
    expect(entry.Source).toBe('superstruct-user.api');
    expect(entry.EventBusName).toBe('audit-bus-test');
    const detail = JSON.parse(entry.Detail!) as Record<string, unknown>;
    expect(detail.email).toBe('jane@example.com');
    expect(detail.userId).toEqual(expect.any(String));
    expect(entry.Detail).not.toContain('correct-horse');
    expect(entry.Detail).not.toContain('passwordHash');
  });

  it('still registers successfully when the audit emit fails', async () => {
    ddb.on(TransactWriteCommand).resolves({});
    eventBridge.on(PutEventsCommand).rejects(new Error('eventbridge down'));

    const result = await invoke(register, jsonEvent(registerInput));
    expect(result.statusCode).toBe(201);
  });

  it('returns 409 when the email is already registered', async () => {
    ddb.on(TransactWriteCommand).rejects(
      new TransactionCanceledException({
        $metadata: {},
        message: 'Transaction cancelled',
        CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
      }),
    );

    const result = await invoke(register, jsonEvent(registerInput));
    expect(result.statusCode).toBe(409);
  });

  it.each([
    ['invalid email', { ...registerInput, email: 'not-an-email' }],
    ['short password', { ...registerInput, password: 'short' }],
    ['missing firstName', { ...registerInput, firstName: '  ' }],
    ['missing lastName', { ...registerInput, lastName: undefined }],
  ])('returns 400 for %s without touching DynamoDB', async (_label, input) => {
    const result = await invoke(register, jsonEvent(input));
    expect(result.statusCode).toBe(400);
    expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });
});

describe('POST /login', () => {
  const seedUser = async () => {
    const user = {
      id: 'u1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      passwordHash: await hashPassword('correct-horse'),
      createdAt: '2026-08-20T00:00:00.000Z',
    };
    ddb
      .on(GetCommand, { Key: { id: 'email#jane@example.com' } })
      .resolves({ Item: { id: 'email#jane@example.com', userId: 'u1' } });
    ddb.on(GetCommand, { Key: { id: 'u1' } }).resolves({ Item: user });
  };

  it('returns a token and the public profile on valid credentials', async () => {
    await seedUser();

    const result = await invoke(
      login,
      jsonEvent({ email: 'Jane@example.com', password: 'correct-horse' }),
    );

    expect(result.statusCode).toBe(200);
    const body = result.body as {
      token: string;
      tokenType: string;
      expiresIn: number;
      user: Record<string, unknown>;
    };
    expect(body.token.split('.')).toHaveLength(3);
    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(3600);
    expect(body.user.id).toBe('u1');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(emittedAuditTypes()).toEqual(['user.login.succeeded']);
  });

  it('emits user.login.failed audit events for bad credentials', async () => {
    await seedUser();
    await invoke(login, jsonEvent({ email: 'jane@example.com', password: 'wrong-password' }));

    ddb.on(GetCommand).resolves({});
    await invoke(login, jsonEvent({ email: 'nobody@example.com', password: 'whatever-pass' }));

    expect(emittedAuditTypes()).toEqual(['user.login.failed', 'user.login.failed']);
    const details = eventBridge
      .commandCalls(PutEventsCommand)
      .map((c) => JSON.parse(c.args[0].input.Entries![0]!.Detail!) as Record<string, unknown>);
    expect(details[0]!.reason).toBe('wrong_password');
    expect(details[1]!.reason).toBe('unknown_email');
  });

  it('returns 401 on a wrong password', async () => {
    await seedUser();
    const result = await invoke(
      login,
      jsonEvent({ email: 'jane@example.com', password: 'wrong-password' }),
    );
    expect(result.statusCode).toBe(401);
    expect(result.body).toEqual({ message: 'Invalid email or password' });
  });

  it('returns the same 401 for an unknown email', async () => {
    ddb.on(GetCommand).resolves({});
    const result = await invoke(
      login,
      jsonEvent({ email: 'nobody@example.com', password: 'whatever-pass' }),
    );
    expect(result.statusCode).toBe(401);
    expect(result.body).toEqual({ message: 'Invalid email or password' });
  });
});

describe('GET /me', () => {
  const user = {
    id: 'u1',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    passwordHash: 'salt:hash',
    createdAt: '2026-08-20T00:00:00.000Z',
  };

  it('returns the profile for a valid token, without the password hash', async () => {
    ddb.on(GetCommand, { Key: { id: 'u1' } }).resolves({ Item: user });
    const result = await invoke(me, authedEvent('u1'));

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ id: 'u1', email: 'jane@example.com' });
    expect(result.body).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without a token and never touches DynamoDB', async () => {
    const result = await invoke(me, makeEvent());
    expect(result.statusCode).toBe(401);
    expect(ddb.commandCalls(GetCommand)).toHaveLength(0);
  });

  it('returns 404 when the token subject no longer exists', async () => {
    ddb.on(GetCommand).resolves({});
    const result = await invoke(me, authedEvent('ghost'));
    expect(result.statusCode).toBe(404);
  });
});

describe('GET /stats', () => {
  it('returns the counter value', async () => {
    ddb
      .on(GetCommand, { Key: { id: 'stats#users' } })
      .resolves({ Item: { id: 'stats#users', userCount: 42 } });
    await expect(invoke(stats, makeEvent())).resolves.toEqual({
      statusCode: 200,
      body: { totalUsers: 42 },
    });
  });

  it('returns 0 when no counter item exists yet', async () => {
    ddb.on(GetCommand).resolves({});
    await expect(invoke(stats, makeEvent())).resolves.toEqual({
      statusCode: 200,
      body: { totalUsers: 0 },
    });
  });
});
