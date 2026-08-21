import type { ActivityItem } from '@/api';

const ACTIVITY_LABELS: Record<ActivityItem['type'], string> = {
  'user.registered': 'Account created',
  'user.login.succeeded': 'Signed in',
  'user.login.failed': 'Failed sign-in attempt',
};

export default function RecentActivity({ events }: { events: ActivityItem[] }) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Recent activity</h3>
      <ul className="space-y-1.5 text-sm">
        {events.map((e) => (
          <li key={`${e.at}-${e.type}`} className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={
                e.type === 'user.login.failed' ? 'font-medium text-destructive' : 'font-medium'
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
  );
}
