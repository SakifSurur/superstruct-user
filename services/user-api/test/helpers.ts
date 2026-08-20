import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { Handler } from '../src/lib/http';

export const makeEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {},
): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'ANY /',
  rawPath: '/',
  rawQueryString: '',
  isBase64Encoded: false,
  requestContext: {} as APIGatewayProxyEventV2['requestContext'],
  headers: {},
  ...overrides,
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
