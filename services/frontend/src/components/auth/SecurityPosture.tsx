import type { FindingsSummary } from '@/api';
import { Badge } from '@/components/ui/badge';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-700 text-white',
  high: 'bg-orange-600 text-white',
  medium: 'bg-amber-600 text-white',
  low: 'bg-muted text-muted-foreground',
};

export default function SecurityPosture({ posture }: { posture: FindingsSummary }) {
  return (
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
  );
}
