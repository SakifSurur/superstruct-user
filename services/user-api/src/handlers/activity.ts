import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { AUDIT_TABLE, ddb } from '../lib/dynamo';
import { json, withErrorHandling } from '../lib/http';
import { requireAuth } from '../lib/auth';

const auditItemSchema = z.object({
  type: z.string(),
  at: z.string(),
  sourceIp: z.string().optional(),
  userAgent: z.string().optional(),
  reason: z.string().optional(),
});

// The partition key is the verified JWT subject — a user can only read their own trail.
export const list = withErrorHandling(async (event) => {
  const { userId } = requireAuth(event);

  const result = await ddb.send(
    new QueryCommand({
      TableName: AUDIT_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ScanIndexForward: false,
      Limit: 20,
    }),
  );

  // Rows that fail the schema are dropped rather than surfaced malformed.
  const items = (result.Items ?? []).flatMap((item) => {
    const parsed = auditItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });

  return json(200, { items });
});
