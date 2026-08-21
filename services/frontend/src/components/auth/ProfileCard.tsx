import type { ActivityItem, FindingsSummary, User } from '@/api';
import RecentActivity from './RecentActivity';
import SecurityPosture from './SecurityPosture';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Props {
  profile: User;
  events: ActivityItem[];
  posture: FindingsSummary | undefined;
  onLogout: () => void;
}

export default function ProfileCard({ profile, events, posture, onLogout }: Props) {
  return (
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
            <RecentActivity events={events} />
          </>
        )}

        {posture && (
          <>
            <Separator />
            <SecurityPosture posture={posture} />
          </>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <a href="/metrics" className={buttonVariants()}>
          Metrics
        </a>
        <a href="/docs" className={buttonVariants({ variant: 'outline' })}>
          API documentation
        </a>
        <Button variant="outline" onClick={onLogout}>
          Log out
        </Button>
      </CardFooter>
    </Card>
  );
}
