import { describe, expect, it } from 'vitest';
import { HttpError, json, parseBody, withErrorHandling } from '../src/lib/http';
import { invoke, jsonEvent, makeEvent } from './helpers';

describe('parseBody', () => {
  it('parses a JSON body', () => {
    expect(parseBody(jsonEvent({ a: 1 }))).toEqual({ a: 1 });
  });

  it('decodes base64-encoded bodies', () => {
    const event = makeEvent({
      body: Buffer.from('{"a":1}').toString('base64'),
      isBase64Encoded: true,
    });
    expect(parseBody(event)).toEqual({ a: 1 });
  });

  it('throws 400 on a missing body', () => {
    expect(() => parseBody(makeEvent())).toThrowError(HttpError);
    expect(() => parseBody(makeEvent())).toThrowError('Request body is required');
  });

  it('throws 400 on invalid JSON', () => {
    expect(() => parseBody(makeEvent({ body: 'not json' }))).toThrowError(
      'Request body must be valid JSON',
    );
  });
});

describe('withErrorHandling', () => {
  it('passes through the handler result', async () => {
    const handler = withErrorHandling(() => Promise.resolve(json(200, { ok: true })));
    await expect(invoke(handler, makeEvent())).resolves.toEqual({
      statusCode: 200,
      body: { ok: true },
    });
  });

  it('maps HttpError to its status code and message', async () => {
    const handler = withErrorHandling(() => Promise.reject(new HttpError(418, 'teapot')));
    await expect(invoke(handler, makeEvent())).resolves.toEqual({
      statusCode: 418,
      body: { message: 'teapot' },
    });
  });

  it('maps unknown errors to 500 without leaking detail', async () => {
    const handler = withErrorHandling(() => Promise.reject(new Error('secret internal detail')));
    await expect(invoke(handler, makeEvent())).resolves.toEqual({
      statusCode: 500,
      body: { message: 'Internal server error' },
    });
  });

  it('rejects requests without the origin-verify header with 403', async () => {
    const handler = withErrorHandling(() => Promise.resolve(json(200, { ok: true })));
    const event = makeEvent();
    delete event.headers['x-origin-verify'];
    await expect(invoke(handler, event)).resolves.toMatchObject({ statusCode: 403 });
  });

  it('rejects requests with a wrong origin-verify header with 403', async () => {
    const handler = withErrorHandling(() => Promise.resolve(json(200, { ok: true })));
    const event = makeEvent({ headers: { 'x-origin-verify': 'wrong-value' } });
    await expect(invoke(handler, event)).resolves.toMatchObject({ statusCode: 403 });
  });
});
