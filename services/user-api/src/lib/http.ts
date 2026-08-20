import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

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

export const parseBody = <T>(event: APIGatewayProxyEventV2): T => {
  if (!event.body) throw new HttpError(400, 'Request body is required');
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) as T;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
};

// CloudFront attaches the same value as an origin header; unset (local dev) disables the check.
const ORIGIN_VERIFY_SECRET = process.env.ORIGIN_VERIFY_SECRET;

export const withErrorHandling =
  (handler: Handler): Handler =>
  async (event) => {
    try {
      if (ORIGIN_VERIFY_SECRET && event.headers['x-origin-verify'] !== ORIGIN_VERIFY_SECRET) {
        throw new HttpError(403, 'Forbidden');
      }
      return await handler(event);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(error.statusCode, { message: error.message });
      }
      console.error('Unhandled error', error);
      return json(500, { message: 'Internal server error' });
    }
  };
