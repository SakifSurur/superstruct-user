import { generateKeyPairSync } from 'node:crypto';

// Runs before test files import the handler, which reads these at import time.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.JWT_KID = 'test-kid';
