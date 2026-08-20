import type { EventBridgeEvent } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { AUDIT_TABLE, ddb } from '../lib/dynamo';
import type { AuditEventType } from '../lib/audit';

interface AuditDetail {
  userId?: string;
  email?: string;
  at?: string;
  sourceIp?: string;
  userAgent?: string;
  reason?: string;
}

const RETENTION_SECONDS = 90 * 24 * 3600;

// Materializes bus events into the per-user view; events without a userId exist only in the S3 archive.
export const handler = async (
  event: EventBridgeEvent<AuditEventType, AuditDetail>,
): Promise<void> => {
  const { userId, at, email, sourceIp, userAgent, reason } = event.detail;
  if (!userId) return;

  const timestamp = at ?? event.time;
  await ddb.send(
    new PutCommand({
      TableName: AUDIT_TABLE,
      Item: {
        userId,
        // event.id makes the key unique when two events share a timestamp
        sk: `${timestamp}#${event.id}`,
        type: event['detail-type'],
        at: timestamp,
        email,
        sourceIp,
        userAgent,
        reason,
        expiresAt: Math.floor(Date.now() / 1000) + RETENTION_SECONDS,
      },
    }),
  );
};
