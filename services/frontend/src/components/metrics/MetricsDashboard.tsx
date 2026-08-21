import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { metrics, stats } from '@/api';
import { compact } from '@/lib/format';
import { getToken } from '@/lib/session';
import LatencyChart from './LatencyChart';
import MetricsSkeleton from './MetricsSkeleton';
import RequestsChart from './RequestsChart';
import StatTile from './StatTile';
import { toChartRows } from './chart-data';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MetricsDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setToken(getToken());
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
          Could not load metrics — your session may have expired.{' '}
          <a className="underline" href="/">
            Log in again
          </a>
          .
        </AlertDescription>
      </Alert>
    );
  }

  const m = metricsQuery.data;
  if (!m) return <MetricsSkeleton />;

  const rows = toChartRows(m);

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
          <CardDescription>
            {compact(m.totals.requests)} total in the last {m.windowHours}h
          </CardDescription>
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
        Source: CloudWatch · updated {new Date(m.fetchedAt).toLocaleTimeString()} · refreshes every
        minute
      </p>
    </div>
  );
}
