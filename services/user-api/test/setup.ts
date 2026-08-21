import { generateKeyPairSync } from 'node:crypto';

// Runs before test files import the lib modules, which read these at import time.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

process.env.USERS_TABLE_NAME = 'users-test';
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.JWT_KID = 'test-kid';
process.env.AUDIT_BUS_NAME = 'audit-bus-test';
process.env.AUDIT_TABLE_NAME = 'audit-test';
process.env.ORIGIN_VERIFY_SECRET = 'test-origin-secret';
