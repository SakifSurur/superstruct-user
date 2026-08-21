import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { activity, login, me, register, securityFindings, type ActivityItem } from '../api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ACTIVITY_LABELS: Record<ActivityItem['type'], string> = {
  'user.registered': 'Account created',
  'user.login.succeeded': 'Signed in',
  'user.login.failed': 'Failed sign-in attempt',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-700 text-white',
  high: 'bg-orange-600 text-white',
  medium: 'bg-amber-600 text-white',
  low: 'bg-muted text-muted-foreground',
};

const TOKEN_KEY = 'superstruct-user.token';

function Panel() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    queryClient.removeQueries();
  }, [queryClient]);

  const meQuery = useQuery({
    queryKey: ['me', token],
    queryFn: () => me(token as string),
    enabled: token !== null,
  });

  // Expired or invalid token — drop the session.
  useEffect(() => {
    if (meQuery.isError) logout();
  }, [meQuery.isError, logout]);

  const postureQuery = useQuery({
    queryKey: ['security-findings', token],
    queryFn: () => securityFindings(token as string),
    enabled: token !== null,
  });

  const activityQuery = useQuery({
    queryKey: ['activity', token],
    queryFn: () => activity(token as string),
    enabled: token !== null,
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setPassword('');
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: () => {
      setNotice('Account created — log in to continue.');
      setMode('login');
      setPassword('');
    },
  });

  const busy = loginMutation.isPending || registerMutation.isPending;
  const mutationError = mode === 'login' ? loginMutation.error : registerMutation.error;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (mode === 'register') {
      registerMutation.mutate({ email, password, firstName, lastName });
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  const profile = token !== null ? meQuery.data : undefined;
  const posture = token !== null ? postureQuery.data : undefined;
  const events = token !== null ? (activityQuery.data?.items ?? []) : [];

  if (profile) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {profile.firstName} {profile.lastName}
            </CardTitle>
            <CardDescription>{profile.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">User ID</dt>
              <dd>
                <code className="font-mono text-xs">{profile.id}</code>
              </dd>
              <dt className="text-muted-foreground">Registered</dt>
              <dd>{new Date(profile.createdAt).toLocaleString()}</dd>
            </dl>

            {events.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-medium">Recent activity</h3>
                  <ul className="space-y-1.5 text-sm">
                    {events.map((e) => (
                      <li key={`${e.at}-${e.type}`} className="flex flex-wrap items-baseline gap-x-2">
                        <span
                          className={
                            e.type === 'user.login.failed'
                              ? 'font-medium text-destructive'
                              : 'font-medium'
                          }
                        >
                          {ACTIVITY_LABELS[e.type] ?? e.type}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(e.at).toLocaleString()}
                          {e.sourceIp && ` · from ${e.sourceIp}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {posture && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-medium">Platform security posture</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
                      <Badge key={sev} className={SEVERITY_STYLES[sev]}>
                        {posture.counts[sev]} {sev}
                      </Badge>
                    ))}
                  </div>
                  <ul className="space-y-1 text-sm">
                    {posture.topFailedControls.map((c) => (
                      <li key={c.id}>
                        <code className="font-mono text-xs">{c.id}</code> {c.title}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Open findings from AWS Security Hub (FSBP + NIST 800-53), updated{' '}
                    {new Date(posture.fetchedAt).toLocaleTimeString()}
                  </p>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <a href="/docs" className={buttonVariants()}>
              API documentation
            </a>
            <Button variant="outline" onClick={logout}>
              Log out
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'register')}>
          <TabsList className="w-full">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === 'register' ? 'Create account' : 'Log in'}
          </Button>
        </form>

        {notice && (
          <Alert className="mt-4">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {mutationError && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{mutationError.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// The island owns its QueryClient — created lazily inside the component so
// nothing stateful exists at SSR module-evaluation time.
export default function AuthPanel() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Panel />
    </QueryClientProvider>
  );
}
