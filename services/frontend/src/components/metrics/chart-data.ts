import type { MetricsResponse } from '@/api';
import { hourLabel } from '@/lib/format';

// Chart hues validated against the white card surface (dataviz palette slots
// 1 and 2); text stays in ink tokens, never the series color.
export const SERIES_REQUESTS = '#2a78d6';
export const SERIES_LATENCY = '#eb6834';

export interface ChartRow {
  time: string;
  requests: number;
  latency: number;
}

export const toChartRows = (m: MetricsResponse): ChartRow[] =>
  m.timestamps.map((t, i) => ({
    time: hourLabel(t),
    requests: m.series.requests[i] ?? 0,
    latency: Math.round(m.series.latencyP99Ms[i] ?? 0),
  }));
