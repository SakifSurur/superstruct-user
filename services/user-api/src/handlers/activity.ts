import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { AUDIT_TABLE, ddb } from '../lib/dynamo';
import { json, withErrorHandling } from '../lib/http';
import { requireAuth } from '../lib/auth';

interface AuditItem {
  type: string;
  at: string;
  sourceIp?: string;
  userAgent?: string;
  reason?: string;
}

// Returns the caller's own audit trail, newest first. The JWT subject is the
// partition key, so a user can never read anyone else's activity.
export const list = withErrorHandling(async (event) => {
  const { userId } = await requireAuth(event);

  const result = await ddb.send(
    new QueryCommand({
      TableName: AUDIT_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ScanIndexForward: false,
      Limit: 20,
    }),
  );

  const items: AuditItem[] = (result.Items ?? []).map((item) => ({
    type: item.type as string,
    at: item.at as string,
    sourceIp: item.sourceIp as string | undefined,
    userAgent: item.userAgent as string | undefined,
    reason: item.reason as string | undefined,
  }));

  return json(200, { items });
});
