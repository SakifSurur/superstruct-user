import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { json, withErrorHandling } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { traced } from '../lib/tracing';

const cloudwatch = traced(new CloudWatchClient({}));

const HOURS = 24;
const PERIOD_SECONDS = 3600;

export interface MetricsResponse {
  windowHours: number;
  timestamps: string[];
  series: {
    requests: number[];
    errors4xx: number[];
    errors5xx: number[];
    latencyP99Ms: number[];
    lambdaErrors: number[];
  };
  totals: {
    requests: number;
    errors4xx: number;
    errors5xx: number;
    lambdaErrors: number;
  };
  fetchedAt: string;
}

const CACHE_TTL_MS = 60 * 1000;
let cache: { response: MetricsResponse; expires: number } | null = null;

const apiMetric = (apiId: string, metricName: string, stat: string) => ({
  Metric: {
    Namespace: 'AWS/ApiGateway',
    MetricName: metricName,
    Dimensions: [{ Name: 'ApiId', Value: apiId }],
  },
  Period: PERIOD_SECONDS,
  Stat: stat,
});

export const metrics = withErrorHandling(async (event) => {
  requireAuth(event);

  if (cache && cache.expires > Date.now()) {
    return json(200, cache.response);
  }

  const apiId = event.requestContext.apiId;
  const end = new Date();
  const start = new Date(end.getTime() - HOURS * 3600 * 1000);

  const result = await cloudwatch.send(
    new GetMetricDataCommand({
      StartTime: start,
      EndTime: end,
      ScanBy: 'TimestampAscending',
      MetricDataQueries: [
        { Id: 'requests', MetricStat: apiMetric(apiId, 'Count', 'Sum') },
        { Id: 'errors4xx', MetricStat: apiMetric(apiId, '4xx', 'Sum') },
        { Id: 'errors5xx', MetricStat: apiMetric(apiId, '5xx', 'Sum') },
        { Id: 'latency', MetricStat: apiMetric(apiId, 'Latency', 'p99') },
        {
          Id: 'lambdaErrors',
          MetricStat: {
            // Account-level aggregate (no dimension).
            Metric: { Namespace: 'AWS/Lambda', MetricName: 'Errors' },
            Period: PERIOD_SECONDS,
            Stat: 'Sum',
          },
        },
      ],
    }),
  );

  const byId = new Map(result.MetricDataResults?.map((r) => [r.Id, r]) ?? []);
  // Buckets with traffic exist per metric; align all series on the request
  // series' timestamps, defaulting gaps to zero.
  const requestsResult = byId.get('requests');
  const timestamps = (requestsResult?.Timestamps ?? []).map((t) => t.toISOString());

  const aligned = (id: string): number[] => {
    const r = byId.get(id);
    const index = new Map(
      (r?.Timestamps ?? []).map((t, i) => [t.toISOString(), r?.Values?.[i] ?? 0]),
    );
    return timestamps.map((t) => index.get(t) ?? 0);
  };

  const series = {
    requests: aligned('requests'),
    errors4xx: aligned('errors4xx'),
    errors5xx: aligned('errors5xx'),
    latencyP99Ms: aligned('latency'),
    lambdaErrors: aligned('lambdaErrors'),
  };

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const response: MetricsResponse = {
    windowHours: HOURS,
    timestamps,
    series,
    totals: {
      requests: sum(series.requests),
      errors4xx: sum(series.errors4xx),
      errors5xx: sum(series.errors5xx),
      lambdaErrors: sum(series.lambdaErrors),
    },
    fetchedAt: new Date().toISOString(),
  };

  cache = { response, expires: Date.now() + CACHE_TTL_MS };
  return json(200, response);
});
