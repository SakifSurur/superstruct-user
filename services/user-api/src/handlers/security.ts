import { GetFindingsCommand, SecurityHubClient } from '@aws-sdk/client-securityhub';
import { countBy, sortBy, take, uniqBy } from 'es-toolkit';
import { json, withErrorHandling } from '../lib/http';
import { traced } from '../lib/tracing';
import { requireAuth } from '../lib/auth';

const securityHub = traced(new SecurityHubClient({}));

interface Finding {
  severity?: string;
  controlId?: string;
  title?: string;
}

export interface FindingsSummary {
  counts: { critical: number; high: number; medium: number; low: number };
  topFailedControls: { id: string; title: string; severity: string }[];
  fetchedAt: string;
}

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Aggregate only — resource ARNs and account IDs must never leave this endpoint.
const summarize = (findings: Finding[]): FindingsSummary => {
  const bySeverity = countBy(findings, (f) => (f.severity ?? '').toLowerCase());
  const counts = {
    critical: bySeverity.critical ?? 0,
    high: bySeverity.high ?? 0,
    medium: bySeverity.medium ?? 0,
    low: bySeverity.low ?? 0,
  };

  const controls = findings.flatMap((f) =>
    f.title ? [{ id: f.controlId ?? f.title, title: f.title, severity: f.severity ?? 'UNKNOWN' }] : [],
  );
  const topFailedControls = take(
    sortBy(uniqBy(controls, (c) => c.id), [(c) => SEVERITY_ORDER[c.severity] ?? 9]),
    5,
  );

  return { counts, topFailedControls, fetchedAt: new Date().toISOString() };
};

// Security Hub throttles GetFindings hard; cache per warm Lambda instance.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { summary: FindingsSummary; expires: number } | null = null;

export const findings = withErrorHandling(async (event) => {
  requireAuth(event);

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
