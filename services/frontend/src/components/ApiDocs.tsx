import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const BASE_URL: string = import.meta.env.PUBLIC_API_URL ?? '';

interface Endpoint {
  method: string;
  path: string;
  auth: boolean;
  description: string;
  example?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/v1/register',
    auth: false,
    description: 'Create an account. Password must be at least 8 characters.',
    example: '{ "email": "...", "password": "...", "firstName": "...", "lastName": "..." }',
  },
  {
    method: 'POST',
    path: '/api/v1/login',
    auth: false,
    description: 'Exchange credentials for a JWT (HS256, valid 1 hour).',
    example: '{ "email": "...", "password": "..." }',
  },
  {
    method: 'GET',
    path: '/api/v1/me',
    auth: true,
    description: 'Profile of the authenticated user.',
  },
  {
    method: 'GET',
    path: '/api/v1/me/activity',
    auth: true,
    description: 'Your last 20 audit events (registration, sign-ins, failed attempts).',
  },
  {
    method: 'GET',
    path: '/api/v1/stats',
    auth: false,
    description: 'Total number of registered users.',
  },
  {
    method: 'GET',
    path: '/api/v1/security/findings',
    auth: true,
    description: 'Aggregated AWS Security Hub posture (severity counts, top failed controls).',
  },
];

export default function ApiDocs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API reference</CardTitle>
        <CardDescription>
          Base URL <code className="font-mono text-xs">{BASE_URL}</code> — JSON in, JSON out.
          Authenticated endpoints expect{' '}
          <code className="font-mono text-xs">Authorization: Bearer &lt;token&gt;</code> from{' '}
          <code className="font-mono text-xs">/api/v1/login</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Endpoint</TableHead>
              <TableHead>Auth</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ENDPOINTS.map((e) => (
              <TableRow key={`${e.method} ${e.path}`}>
                <TableCell className="align-top whitespace-nowrap">
                  <code className="font-mono text-xs">
                    {e.method} {e.path}
                  </code>
                </TableCell>
                <TableCell className="align-top">
                  {e.auth ? <Badge variant="secondary">JWT</Badge> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="align-top">
                  {e.description}
                  {e.example && (
                    <div className="mt-1">
                      <code className="font-mono text-xs text-muted-foreground">{e.example}</code>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Errors are JSON: <code className="font-mono">{'{ "message": "..." }'}</code> with 400
          (validation), 401 (bad or missing token/credentials), 409 (email already registered).
        </p>
      </CardContent>
    </Card>
  );
}
