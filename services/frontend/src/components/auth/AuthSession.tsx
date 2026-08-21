import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activity, login, me, register, securityFindings } from '@/api';
import { clearToken, getToken, storeToken } from '@/lib/session';
import AuthForms, { type AuthFields, type AuthMode } from './AuthForms';
import ProfileCard from './ProfileCard';
import ProfileSkeleton from './ProfileSkeleton';

export default function AuthSession() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => getToken());
  const [mode, setMode] = useState<AuthMode>('login');
  const [notice, setNotice] = useState<string | null>(null);

  const logout = useCallback(() => {
    clearToken();
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
      storeToken(result.token);
      setToken(result.token);
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: () => {
      setNotice('Account created — log in to continue.');
      setMode('login');
    },
  });

  const onSubmit = (fields: AuthFields) => {
    setNotice(null);
    if (mode === 'register') {
      registerMutation.mutate(fields);
    } else {
      loginMutation.mutate({ email: fields.email, password: fields.password });
    }
  };

  // A returning visitor has a token but no profile yet — showing the login
  // card here causes a visible jump when /me resolves. Hold a skeleton instead.
  if (token !== null && meQuery.isPending) return <ProfileSkeleton />;

  const profile = token !== null ? meQuery.data : undefined;

  if (profile) {
    return (
      <div className="space-y-6">
        <ProfileCard
          profile={profile}
          events={activityQuery.data?.items ?? []}
          posture={postureQuery.data}
          onLogout={logout}
        />
      </div>
    );
  }

  return (
    <AuthForms
      mode={mode}
      onModeChange={setMode}
      onSubmit={onSubmit}
      busy={loginMutation.isPending || registerMutation.isPending}
      notice={notice}
      error={mode === 'login' ? loginMutation.error : registerMutation.error}
    />
  );
}
