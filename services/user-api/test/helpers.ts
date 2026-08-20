import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { Handler } from '../src/lib/http';

// Minimal HTTP API v2 event. Carries the origin-verify header by default so
// tests exercise the handler body; pass headers to override.
export const makeEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {},
): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'ANY /',
  rawPath: '/',
  rawQueryString: '',
  isBase64Encoded: false,
  requestContext: {} as APIGatewayProxyEventV2['requestContext'],
  ...overrides,
  headers: {
    'x-origin-verify': process.env.ORIGIN_VERIFY_SECRET,
    ...overrides.headers,
  },
});

export const jsonEvent = (
  body: unknown,
  overrides: Partial<APIGatewayProxyEventV2> = {},
): APIGatewayProxyEventV2 => makeEvent({ body: JSON.stringify(body), ...overrides });

export const invoke = async (
  handler: Handler,
  event: APIGatewayProxyEventV2,
): Promise<{ statusCode: number; body: unknown }> => {
  const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
  return {
    statusCode: result.statusCode ?? 0,
    body: result.body ? JSON.parse(result.body) : undefined,
  };
};
