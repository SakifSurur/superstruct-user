import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type AuthMode = 'login' | 'register';

export interface AuthFields {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface Props {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (fields: AuthFields) => void;
  busy: boolean;
  notice: string | null;
  error: Error | null;
}

export default function AuthForms({ mode, onModeChange, onSubmit, busy, notice, error }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ email, password, firstName, lastName });
    setPassword('');
  };

  return (
    <Card>
      <CardHeader>
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as AuthMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
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
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
