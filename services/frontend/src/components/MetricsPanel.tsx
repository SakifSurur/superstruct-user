import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { metrics, stats, type MetricsResponse } from '../api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const TOKEN_KEY = 'superstruct-user.token';

// Chart hues validated against the white card surface (dataviz palette slots
// 1 and 2); text stays in ink tokens, never the series color.
const SERIES_REQUESTS = '#2a78d6';
const SERIES_LATENCY = '#eb6834';

const compact = (n: number): string =>
  Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

const hourLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-3xl font-semibold ${tone === 'bad' ? 'text-red-700' : ''}`}>
          {tone === 'bad' && <span aria-hidden="true">⚠ </span>}
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function BarChart({ data, timestamps, color }: { data: number[]; timestamps: string[]; color: string }) {
  const w = 640;
  const h = 120;
  const max = Math.max(...data, 1);
  const gap = 2;
  const barW = Math.max((w - gap * data.length) / Math.max(data.length, 1), 2);
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full" role="img" aria-label="Hourly values">
      {data.map((v, i) => {
        const bh = Math.max((v / max) * h, v > 0 ? 2 : 0);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={h - bh}
            width={barW}
            height={bh}
            rx={2}
            fill={color}
          >
            <title>{`${hourLabel(timestamps[i] ?? '')} — ${v}`}</title>
          </rect>
        );
      })}
      <line x1="0" y1={h + 0.5} x2={w} y2={h + 0.5} stroke="currentColor" opacity="0.15" />
      <text x="0" y={h + 14} className="fill-current" opacity="0.55" fontSize="11">
        {timestamps[0] ? hourLabel(timestamps[0]) : ''}
      </text>
      <text x={w} y={h + 14} textAnchor="end" className="fill-current" opacity="0.55" fontSize="11">
        {timestamps.at(-1) ? hourLabel(timestamps.at(-1)!) : ''}
      </text>
    </svg>
  );
}

function LineChart({ data, timestamps, color }: { data: number[]; timestamps: string[]; color: string }) {
  const w = 640;
  const h = 120;
  const max = Math.max(...data, 1);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((v, i) => `${i * step},${h - (v / max) * (h - 6) - 3}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full" role="img" aria-label="Hourly p99 latency">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - (v / max) * (h - 6) - 3} r="8" fill="transparent">
          <title>{`${hourLabel(timestamps[i] ?? '')} — ${Math.round(v)} ms`}</title>
        </circle>
      ))}
      <line x1="0" y1={h + 0.5} x2={w} y2={h + 0.5} stroke="currentColor" opacity="0.15" />
      <text x="0" y={h + 14} className="fill-current" opacity="0.55" fontSize="11">
        {timestamps[0] ? hourLabel(timestamps[0]) : ''}
      </text>
      <text x={w} y={h + 14} textAnchor="end" className="fill-current" opacity="0.55" fontSize="11">
        {timestamps.at(-1) ? hourLabel(timestamps.at(-1)!) : ''}
      </text>
    </svg>
  );
}

function Panel() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setChecked(true);
  }, []);

  const metricsQuery = useQuery({
    queryKey: ['metrics', token],
    queryFn: () => metrics(token as string),
    enabled: token !== null,
    refetchInterval: 60_000,
  });

  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: stats });

  if (!checked) return null;

  if (token === null) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Alert>
            <AlertDescription>The metrics dashboard is available after logging in.</AlertDescription>
          </Alert>
          <a href="/" className={buttonVariants()}>
            Go to login
          </a>
        </CardContent>
      </Card>
    );
  }

  if (metricsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Could not load metrics — your session may have expired. <a className="underline" href="/">Log in again</a>.
        </AlertDescription>
      </Alert>
    );
  }

  const m: MetricsResponse | undefined = metricsQuery.data;

  if (!m) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-2 pt-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="Registered users"
          value={statsQuery.data ? compact(statsQuery.data.totalUsers) : '—'}
        />
        <StatTile label={`Requests · ${m.windowHours}h`} value={compact(m.totals.requests)} />
        <StatTile
          label={`5xx errors · ${m.windowHours}h`}
          value={compact(m.totals.errors5xx)}
          tone={m.totals.errors5xx > 0 ? 'bad' : undefined}
        />
        <StatTile
          label={`Lambda errors · ${m.windowHours}h`}
          value={compact(m.totals.lambdaErrors)}
          tone={m.totals.lambdaErrors > 0 ? 'bad' : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API requests per hour</CardTitle>
          <CardDescription>{compact(m.totals.requests)} total in the last {m.windowHours}h</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart data={m.series.requests} timestamps={m.timestamps} color={SERIES_REQUESTS} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API p99 latency (ms)</CardTitle>
          <CardDescription>hourly, CloudWatch p99</CardDescription>
        </CardHeader>
        <CardContent>
          <LineChart data={m.series.latencyP99Ms} timestamps={m.timestamps} color={SERIES_LATENCY} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Source: CloudWatch · updated {new Date(m.fetchedAt).toLocaleTimeString()} · refreshes every minute
      </p>
    </div>
  );
}

export default function MetricsPanel() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <Panel />
    </QueryClientProvider>
  );
}
