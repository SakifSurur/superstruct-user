import { timingSafeEqual } from 'node:crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

// When set, only requests carrying the CloudFront-injected x-origin-verify
// header are served, so the raw execute-api URL bypasses nothing.
const ORIGIN_VERIFY_SECRET = process.env.ORIGIN_VERIFY_SECRET;

const originVerified = (event: APIGatewayProxyEventV2): boolean => {
  if (!ORIGIN_VERIFY_SECRET) return true;
  const header = event.headers['x-origin-verify'];
  if (!header) return false;
  if (header.length !== ORIGIN_VERIFY_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(ORIGIN_VERIFY_SECRET));
};

export const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

// Returns unknown on purpose: callers validate the shape with a zod schema
// (see parseBodyWith in validate.ts) rather than asserting it.
export const parseBody = (event: APIGatewayProxyEventV2): unknown => {
  if (!event.body) throw new HttpError(400, 'Request body is required');
  try {
    return JSON.parse(
      event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body,
    );
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
};

export const withErrorHandling =
  (handler: Handler): Handler =>
  async (event) => {
    try {
      if (!originVerified(event)) return json(403, { message: 'Forbidden' });
      return await handler(event);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(error.statusCode, { message: error.message });
      }
      console.error('Unhandled error', error);
      return json(500, { message: 'Internal server error' });
    }
  };
