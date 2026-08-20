// OpenAPI 3 description of the user API, rendered by the embedded Swagger UI.
// The server URL is injected at build time so "Try it out" hits the real API.

const BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'superstruct-user API',
    version: '1.0.0',
    description:
      'JWT-authenticated user API served via CloudFront + WAF. ' +
      'Obtain a token from `POST /v1/login`, then click **Authorize** and paste it to try the secured endpoints.',
  },
  servers: [{ url: BASE_URL }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      LoginResult: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', example: 3600 },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      ActivityItem: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['user.registered', 'user.login.succeeded', 'user.login.failed'],
          },
          at: { type: 'string', format: 'date-time' },
          sourceIp: { type: 'string' },
          userAgent: { type: 'string' },
          reason: { type: 'string', enum: ['unknown_email', 'wrong_password'] },
        },
      },
      FindingsSummary: {
        type: 'object',
        properties: {
          counts: {
            type: 'object',
            properties: {
              critical: { type: 'integer' },
              high: { type: 'integer' },
              medium: { type: 'integer' },
              low: { type: 'integer' },
            },
          },
          topFailedControls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'S3.1' },
                title: { type: 'string' },
                severity: { type: 'string', example: 'HIGH' },
              },
            },
          },
          fetchedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/v1/register': {
      post: {
        tags: ['auth'],
        summary: 'Create an account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'firstName', 'lastName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'Email already registered',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/v1/login': {
      post: {
        tags: ['auth'],
        summary: 'Exchange credentials for a JWT (valid 1 hour)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authenticated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/LoginResult' } },
            },
          },
          '401': {
            description: 'Invalid email or password',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/v1/me': {
      get: {
        tags: ['auth'],
        summary: 'Profile of the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'The profile',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          '401': { description: 'Missing or invalid token' },
        },
      },
    },
    '/v1/me/activity': {
      get: {
        tags: ['audit'],
        summary: "The caller's last 20 audit events, newest first",
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Audit events',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ActivityItem' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Missing or invalid token' },
        },
      },
    },
    '/v1/stats': {
      get: {
        tags: ['public'],
        summary: 'Total number of registered users',
        responses: {
          '200': {
            description: 'Counter value',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { totalUsers: { type: 'integer' } } },
              },
            },
          },
        },
      },
    },
    '/v1/security/findings': {
      get: {
        tags: ['audit'],
        summary: 'Aggregated AWS Security Hub posture',
        description: 'Severity counts and top failed controls; never includes resource identifiers.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Findings summary',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/FindingsSummary' } },
            },
          },
          '401': { description: 'Missing or invalid token' },
        },
      },
    },
  },
} as const;
