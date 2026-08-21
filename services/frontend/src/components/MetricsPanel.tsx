import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { metrics, stats, type MetricsResponse } from '../api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

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

const requestsConfig = {
  requests: { label: 'Requests', color: SERIES_REQUESTS },
} satisfies ChartConfig;

const latencyConfig = {
  latency: { label: 'p99 latency (ms)', color: SERIES_LATENCY },
} satisfies ChartConfig;

interface ChartRow {
  time: string;
  requests: number;
  latency: number;
}

function RequestsChart({ rows }: { rows: ChartRow[] }) {
  return (
    <ChartContainer config={requestsConfig} className="h-48 w-full">
      <BarChart data={rows} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.35} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={48} />
        <YAxis width={36} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="requests" fill="var(--color-requests)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function LatencyChart({ rows }: { rows: ChartRow[] }) {
  return (
    <ChartContainer config={latencyConfig} className="h-48 w-full">
      <LineChart data={rows} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.35} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={48} />
        <YAxis width={44} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="latency"
          stroke="var(--color-latency)"
          strokeWidth={2}
          dot={false}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
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

  const rows: ChartRow[] = m.timestamps.map((t, i) => ({
    time: hourLabel(t),
    requests: m.series.requests[i] ?? 0,
    latency: Math.round(m.series.latencyP99Ms[i] ?? 0),
  }));

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
          <RequestsChart rows={rows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API p99 latency (ms)</CardTitle>
          <CardDescription>hourly, CloudWatch p99</CardDescription>
        </CardHeader>
        <CardContent>
          <LatencyChart rows={rows} />
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
