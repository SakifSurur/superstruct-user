import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const tableName = process.env.USERS_TABLE_NAME;
if (!tableName) {
  throw new Error('USERS_TABLE_NAME environment variable is not set');
}

export const USERS_TABLE = tableName;

const auditTableName = process.env.AUDIT_TABLE_NAME;
if (!auditTableName) {
  throw new Error('AUDIT_TABLE_NAME environment variable is not set');
}

export const AUDIT_TABLE = auditTableName;
