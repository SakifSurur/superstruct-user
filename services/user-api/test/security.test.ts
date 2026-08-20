import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  GetFindingsCommand,
  SecurityHubClient,
  type SeverityLabel,
} from '@aws-sdk/client-securityhub';
import { findings } from '../src/handlers/security';
import { signToken } from '../src/lib/auth';
import { invoke, makeEvent } from './helpers';

const securityHubMock = mockClient(SecurityHubClient);

const finding = (severity: SeverityLabel, controlId: string, title: string) => ({
  SchemaVersion: '2018-10-08',
  Id: `finding/${controlId}/${severity}`,
  ProductArn: 'arn:aws:securityhub:eu-central-1::product/aws/securityhub',
  GeneratorId: controlId,
  CreatedAt: '2026-08-20T00:00:00.000Z',
  UpdatedAt: '2026-08-20T00:00:00.000Z',
  Description: title,
  Severity: { Label: severity },
  Compliance: { SecurityControlId: controlId },
  Title: title,
  // fields the handler must NOT forward
  AwsAccountId: '076899628449',
  Resources: [{ Id: 'arn:aws:s3:::very-secret-bucket', Type: 'AwsS3Bucket' }],
});

const authedEvent = async () =>
  makeEvent({ headers: { authorization: `Bearer ${await signToken('u1', 'a@b.co')}` } });

describe('GET /security/findings', () => {
  beforeEach(() => {
    securityHubMock.reset();
  });

  it('returns 401 without a token and never calls Security Hub', async () => {
    const result = await invoke(findings, makeEvent());
    expect(result.statusCode).toBe(401);
    expect(securityHubMock.commandCalls(GetFindingsCommand)).toHaveLength(0);
  });

  it('aggregates severity counts and top failed controls', async () => {
    securityHubMock.on(GetFindingsCommand).resolves({
      Findings: [
        finding('CRITICAL', 'Config.1', 'AWS Config should be enabled'),
        finding('HIGH', 'EC2.2', 'Default SGs should not allow traffic'),
        finding('HIGH', 'EC2.2', 'Default SGs should not allow traffic'), // duplicate control
        finding('MEDIUM', 'S3.1', 'S3 BPA should be enabled'),
        finding('LOW', 'Account.1', 'Security contact should be provided'),
      ],
    });

    const result = await invoke(findings, await authedEvent());

    expect(result.statusCode).toBe(200);
    const body = result.body as {
      counts: Record<string, number>;
      topFailedControls: { id: string; severity: string }[];
    };
    expect(body.counts).toEqual({ critical: 1, high: 2, medium: 1, low: 1 });
    expect(body.topFailedControls.map((c) => c.id)).toEqual([
      'Config.1',
      'EC2.2',
      'S3.1',
      'Account.1',
    ]);
  });

  it('never leaks resource identifiers or account ids', async () => {
    const result = await invoke(findings, await authedEvent());
    const raw = JSON.stringify(result.body);
    expect(raw).not.toContain('076899628449');
    expect(raw).not.toContain('arn:');
  });

  it('serves from cache without re-calling Security Hub', async () => {
    await invoke(findings, await authedEvent());
    // cache was primed by earlier tests; the mock reset proves no new call
    expect(securityHubMock.commandCalls(GetFindingsCommand)).toHaveLength(0);
  });
});
