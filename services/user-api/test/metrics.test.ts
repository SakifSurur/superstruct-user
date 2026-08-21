import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { metrics } from '../src/handlers/metrics';
import { authedEvent, invoke, makeEvent } from './helpers';

const cw = mockClient(CloudWatchClient);

const t = (h: number) => new Date(Date.UTC(2026, 7, 22, h));

beforeEach(() => {
  cw.reset();
  cw.on(GetMetricDataCommand).resolves({
    MetricDataResults: [
      { Id: 'requests', Timestamps: [t(0), t(1)], Values: [10, 20] },
      { Id: 'errors4xx', Timestamps: [t(1)], Values: [2] },
      { Id: 'errors5xx', Timestamps: [], Values: [] },
      { Id: 'latency', Timestamps: [t(0), t(1)], Values: [120, 340] },
      { Id: 'lambdaErrors', Timestamps: [t(0)], Values: [1] },
    ],
  });
});

describe('GET /api/v1/metrics', () => {
  it('returns 401 without authorizer claims and never calls CloudWatch', async () => {
    const result = await invoke(metrics, makeEvent());
    expect(result.statusCode).toBe(401);
    expect(cw.commandCalls(GetMetricDataCommand)).toHaveLength(0);
  });

  it('aligns series on the request timestamps and sums totals', async () => {
    const result = await invoke(metrics, authedEvent('u1'));
    expect(result.statusCode).toBe(200);
    const body = result.body as {
      timestamps: string[];
      series: Record<string, number[]>;
      totals: Record<string, number>;
    };
    expect(body.timestamps).toHaveLength(2);
    expect(body.series.requests).toEqual([10, 20]);
    expect(body.series.errors4xx).toEqual([0, 2]); // gap filled with zero
    expect(body.series.errors5xx).toEqual([0, 0]);
    expect(body.totals).toMatchObject({ requests: 30, errors4xx: 2, errors5xx: 0, lambdaErrors: 1 });
  });

  it('serves from cache without re-calling CloudWatch', async () => {
    await invoke(metrics, authedEvent('u1'));
    expect(cw.commandCalls(GetMetricDataCommand)).toHaveLength(0);
  });
});
