import type { ZodType } from 'zod';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { HttpError, parseBody } from './http';

// Parses the JSON body and validates it against a zod schema, mapping the
// first validation issue to a 400 with a field-scoped message.
export const parseBodyWith = <T>(schema: ZodType<T>, event: APIGatewayProxyEventV2): T => {
  const result = schema.safeParse(parseBody(event));
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.');
    const message = issue?.message ?? 'Invalid request body';
    throw new HttpError(400, field ? `"${field}" ${message}` : message);
  }
  return result.data;
};
