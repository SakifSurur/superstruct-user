import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const client = new EventBridgeClient({});

const BUS_NAME = process.env.AUDIT_BUS_NAME;
export const AUDIT_SOURCE = 'superstruct-user.api';

export type AuditEventType = 'user.registered' | 'user.login.succeeded' | 'user.login.failed';

// Requests arrive via CloudFront, so requestContext.http.sourceIp is an edge
// IP; the real client is the first hop in x-forwarded-for.
const clientIp = (event: APIGatewayProxyEventV2): string | undefined =>
  event.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
  event.requestContext?.http?.sourceIp;

// Emits one audit event to the EventBridge bus. Fail-open by design: an audit
// outage must not block registration or login, so errors are logged, not thrown.
export const audit = async (
  type: AuditEventType,
  detail: Record<string, unknown>,
  request: APIGatewayProxyEventV2,
): Promise<void> => {
  if (!BUS_NAME) return; // not configured (e.g. local dev)
  try {
    await client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: BUS_NAME,
            Source: AUDIT_SOURCE,
            DetailType: type,
            Detail: JSON.stringify({
              ...detail,
              at: new Date().toISOString(),
              sourceIp: clientIp(request),
              userAgent: request.headers['user-agent'],
            }),
          },
        ],
      }),
    );
  } catch (error) {
    console.error(`Failed to emit audit event ${type}`, error);
  }
};
