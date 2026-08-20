import { GetFindingsCommand, SecurityHubClient } from '@aws-sdk/client-securityhub';
import { json, withErrorHandling } from '../lib/http';
import { requireAuth } from '../lib/auth';

const securityHub = new SecurityHubClient({});

export interface FindingsSummary {
  counts: { critical: number; high: number; medium: number; low: number };
  topFailedControls: { id: string; title: string; severity: string }[];
  fetchedAt: string;
}

// Aggregate only — resource ARNs and account IDs must never leave this endpoint.
const summarize = (
  findings: { severity?: string; controlId?: string; title?: string }[],
): FindingsSummary => {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const controls = new Map<string, { id: string; title: string; severity: string }>();

  for (const f of findings) {
    const severity = (f.severity ?? '').toLowerCase();
    if (severity in counts) counts[severity as keyof typeof counts] += 1;
    const id = f.controlId ?? f.title;
    if (id && f.title && !controls.has(id)) {
      controls.set(id, { id, title: f.title, severity: f.severity ?? 'UNKNOWN' });
    }
  }

  const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const topFailedControls = [...controls.values()]
    .sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
    .slice(0, 5);

  return { counts, topFailedControls, fetchedAt: new Date().toISOString() };
};

// Security Hub throttles GetFindings hard; cache per warm Lambda instance.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { summary: FindingsSummary; expires: number } | null = null;

export const findings = withErrorHandling(async (event) => {
  await requireAuth(event);

  if (cache && cache.expires > Date.now()) {
    return json(200, cache.summary);
  }

  const result = await securityHub.send(
    new GetFindingsCommand({
      Filters: {
        RecordState: [{ Value: 'ACTIVE', Comparison: 'EQUALS' }],
        ComplianceStatus: [{ Value: 'FAILED', Comparison: 'EQUALS' }],
        WorkflowStatus: [
          { Value: 'NEW', Comparison: 'EQUALS' },
          { Value: 'NOTIFIED', Comparison: 'EQUALS' },
        ],
      },
      MaxResults: 100,
    }),
  );

  const summary = summarize(
    (result.Findings ?? []).map((f) => ({
      severity: f.Severity?.Label,
      controlId: f.Compliance?.SecurityControlId,
      title: f.Title,
    })),
  );

  cache = { summary, expires: Date.now() + CACHE_TTL_MS };
  return json(200, summary);
});
