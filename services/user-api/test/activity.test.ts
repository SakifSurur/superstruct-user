import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { EventBridgeEvent } from 'aws-lambda';
import { list } from '../src/handlers/activity';
import { handler as auditWriter } from '../src/handlers/audit-writer';
import type { AuditEventType } from '../src/lib/audit';
import { signToken } from '../src/lib/auth';
import { invoke, makeEvent } from './helpers';

const ddb = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddb.reset();
});

describe('GET /me/activity', () => {
  it('returns 401 without a token and never queries DynamoDB', async () => {
    const result = await invoke(list, makeEvent());
    expect(result.statusCode).toBe(401);
    expect(ddb.commandCalls(QueryCommand)).toHaveLength(0);
  });

  it('queries only the caller own partition, newest first', async () => {
    ddb.on(QueryCommand).resolves({
      Items: [
        {
          userId: 'u1',
          sk: '2026-08-20T14:28:40.090Z#evt-2',
          type: 'user.login.succeeded',
          at: '2026-08-20T14:28:40.090Z',
          sourceIp: '203.0.113.7',
          userAgent: 'curl/8.7.1',
        },
        {
          userId: 'u1',
          sk: '2026-08-20T14:28:38.630Z#evt-1',
          type: 'user.registered',
          at: '2026-08-20T14:28:38.630Z',
          sourceIp: '203.0.113.7',
          userAgent: 'curl/8.7.1',
        },
      ],
    });
    const token = await signToken('u1', 'a@b.co');

    const result = await invoke(list, makeEvent({ headers: { authorization: `Bearer ${token}` } }));

    expect(result.statusCode).toBe(200);
    const body = result.body as { items: { type: string }[] };
    expect(body.items.map((i) => i.type)).toEqual(['user.login.succeeded', 'user.registered']);

    const query = ddb.commandCalls(QueryCommand)[0]!.args[0].input;
    expect(query.ExpressionAttributeValues).toEqual({ ':userId': 'u1' });
    expect(query.ScanIndexForward).toBe(false);
    // the userId comes from the verified JWT, never from request input
    expect(query.KeyConditionExpression).toBe('userId = :userId');
  });
});

const busEvent = (
  detailType: AuditEventType,
  detail: Record<string, unknown>,
): EventBridgeEvent<AuditEventType, never> =>
  ({
    id: 'evt-123',
    'detail-type': detailType,
    source: 'superstruct-user.api',
    time: '2026-08-20T14:00:00Z',
    detail,
  }) as unknown as EventBridgeEvent<AuditEventType, never>;

describe('audit writer', () => {
  it('materializes a bus event into the audit table with a unique sort key', async () => {
    ddb.on(PutCommand).resolves({});

    await auditWriter(
      busEvent('user.login.succeeded', {
        userId: 'u1',
        email: 'a@b.co',
        at: '2026-08-20T14:28:40.090Z',
        sourceIp: '203.0.113.7',
      }),
    );

    const put = ddb.commandCalls(PutCommand)[0]!.args[0].input;
    expect(put.TableName).toBe('audit-test');
    expect(put.Item).toMatchObject({
      userId: 'u1',
      sk: '2026-08-20T14:28:40.090Z#evt-123',
      type: 'user.login.succeeded',
      sourceIp: '203.0.113.7',
    });
    expect(put.Item!.expiresAt).toEqual(expect.any(Number));
  });

  it('skips events without a userId (unknown-email login attempts)', async () => {
    await auditWriter(busEvent('user.login.failed', { email: 'nobody@example.com' }));
    expect(ddb.commandCalls(PutCommand)).toHaveLength(0);
  });
});
