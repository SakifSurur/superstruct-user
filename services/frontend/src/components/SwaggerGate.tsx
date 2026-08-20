import { useEffect, useState } from 'react';
import SwaggerDocs from './SwaggerDocs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const TOKEN_KEY = 'superstruct-user.token';

// Docs stay behind login: render Swagger only when a token is present.
export default function SwaggerGate() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    setHasToken(localStorage.getItem(TOKEN_KEY) !== null);
  }, []);

  if (hasToken === null) return null;

  if (!hasToken) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Alert>
            <AlertDescription>
              The API documentation is available after logging in.
            </AlertDescription>
          </Alert>
          <Button asChild>
            <a href="/">Go to login</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <SwaggerDocs />
      </CardContent>
    </Card>
  );
}
