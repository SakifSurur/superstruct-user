import { captureAWSv3Client } from 'aws-xray-sdk-core';

// Wraps AWS SDK clients with X-Ray subsegment capture. Only inside Lambda —
// locally and in tests there is no trace context. The cast bridges the X-Ray
// SDK's loose client typing back to the concrete client type.
export const traced = <T extends object>(client: T): T =>
  process.env.AWS_LAMBDA_FUNCTION_NAME
    ? (captureAWSv3Client(client as Parameters<typeof captureAWSv3Client>[0]) as T)
    : client;
