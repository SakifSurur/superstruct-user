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
  // CloudFront-injected header expected by withErrorHandling; matches setup.ts.
  headers: { 'x-origin-verify': 'test-origin-secret' },
  ...overrides,
});

// Simulates a request that passed the API Gateway JWT authorizer.
export const authedEvent = (
  userId: string,
  overrides: Partial<APIGatewayProxyEventV2> = {},
): APIGatewayProxyEventV2 =>
  makeEvent({
    ...overrides,
    requestContext: {
      authorizer: { jwt: { claims: { sub: userId }, scopes: [] } },
    } as unknown as APIGatewayProxyEventV2['requestContext'],
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
