// Runs before each test file, ahead of module imports — the lib modules read
// these at import time and throw if they are missing.
process.env.USERS_TABLE_NAME = 'users-test';
process.env.JWT_SECRET = 'test-jwt-signing-key-0123456789abcdef0123456789abcdef';
process.env.ORIGIN_VERIFY_SECRET = 'test-origin-verify-secret';
process.env.AUDIT_BUS_NAME = 'audit-bus-test';
process.env.AUDIT_TABLE_NAME = 'audit-test';
