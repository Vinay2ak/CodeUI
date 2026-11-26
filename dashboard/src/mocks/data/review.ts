import {
  AutomatedRun,
  AiVerificationReport,
  CurrentSubmission,
  ProjectPayment,
  DockerTestResult,
} from '../../features/review/types';

export type ReviewScenario = 'pass' | 'mixed' | 'fail';

export const BASE_COMMIT_SHA = 'e316aae746098bc129038234fedcba0987654321';
export const BASE_SUBMISSION_ID = 'sub-webhook-2026';
export const BASE_DEVELOPER_NAME = 'Ravi Freelancer';

function generateLogLines(count: number, prefix: string, extraLines: string[] = []): string[] {
  const lines: string[] = [];
  for (let i = 1; i <= count; i++) {
    lines.push(`[${new Date().toISOString()}] ${prefix} step ${i}: operation running smoothly...`);
  }
  lines.push(...extraLines);
  return lines;
}

const installLogLines = generateLogLines(45, 'poetry', [
  'Creating virtualenv in /root/.cache/pypoetry/virtualenvs/webhooks-py3.11',
  'Installing dependencies from lock file',
  'Package operations: 24 installs, 0 updates, 0 removals',
  'Writing lock file',
  'Installation complete. Virtual environment ready.',
]);

const buildLogLines = generateLogLines(50, 'docker-build', [
  'Step 1/8 : FROM python:3.11-slim',
  'Step 2/8 : WORKDIR /app',
  'Step 3/8 : COPY poetry.lock pyproject.toml ./',
  'Step 4/8 : RUN poetry install --no-dev',
  'Step 5/8 : COPY . .',
  'Step 6/8 : EXPOSE 8000',
  'Step 7/8 : USER appuser',
  'Step 8/8 : CMD ["uvicorn", "app.webhooks:app", "--host", "0.0.0.0"]',
  'Successfully built e316aae74609',
  'Successfully tagged app:latest',
]);

const lintLogLines = generateLogLines(42, 'flake8', [
  'Scanning 18 python source files in app/...',
  'Checking PEP 8 style conventions and import ordering',
  'Checking docstrings and complexity boundaries',
  'app/webhooks.py: clean',
  'app/retry.py: clean',
  'All 18 files passed linting with zero violations.',
]);

const testLogPassLines = generateLogLines(60, 'pytest', [
  'tests/test_webhooks.py::test_webhook_signature_verification PASSED [ 14% ]',
  'tests/test_webhooks.py::test_duplicate_event_idempotency PASSED [ 28% ]',
  'tests/test_webhooks.py::test_exponential_backoff_timing PASSED [ 42% ]',
  'tests/test_webhooks.py::test_database_retry_transaction PASSED [ 57% ]',
  'Debug trace - Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDN45POgJKMGReDTQrlqdEqDhY9aO100ecaNYWaPM',
  'tests/test_webhooks.py::test_dead_letter_queue_delivery PASSED [ 71% ]',
  'tests/test_webhooks.py::test_concurrent_webhook_dispatch PASSED [ 85% ]',
  'tests/test_webhooks.py::test_graceful_shutdown PASSED [ 100% ]',
  '============================== 8 passed in 1.42s ==============================',
]);

const testLogFailLines = generateLogLines(65, 'pytest', [
  'tests/test_webhooks.py::test_webhook_signature_verification PASSED [ 14% ]',
  'tests/test_webhooks.py::test_duplicate_event_idempotency FAILED [ 28% ]',
  'Debug trace - Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDN45POgJKMGReDTQrlqdEqDhY9aO100ecaNYWaPM',
  '--------------------------------- FAILURES ---------------------------------',
  '____________________ test_duplicate_event_idempotency ______________________',
  '    def test_duplicate_event_idempotency():',
  '        response = client.post("/webhooks/stripe", json=sample_payload)',
  '        assert response.status_code == 200',
  '        response2 = client.post("/webhooks/stripe", json=sample_payload)',
  '>       assert ledger.get_charge_count() == 1',
  'E       AssertionError: expected 1 charge, got 2 (duplicate event processed twice)',
  'tests/test_webhooks.py:48: AssertionError',
  '========================= 1 failed, 7 passed in 1.88s =========================',
]);

const docsLogPassLines = generateLogLines(40, 'mkdocs', [
  'INFO     -  Building documentation...',
  'INFO     -  Cleaning site directory',
  'INFO     -  The following pages exist in the docs directory:',
  '  - index.md',
  '  - architecture/webhooks.md',
  '  - operational/retry-policies.md',
  'INFO     -  Documentation built in 0.62 seconds',
]);

const docsLogFailLines = generateLogLines(40, 'mkdocs', [
  'INFO     -  Building documentation in strict mode...',
  'WARNING  -  Doc file "architecture/webhooks.md" contains a broken link to "architecture/idempotency.md"',
  'ERROR    -  Aborted with 1 error in strict mode',
]);

export function getMockChecks(scenario: ReviewScenario): DockerTestResult[] {
  return [
    {
      id: 'chk-install',
      kind: 'install',
      command: 'poetry install --no-root',
      exitCode: 0,
      status: 'passed',
      durationMs: 4200,
      required: true,
      logTail: installLogLines.slice(-200).join('\n'),
      logTruncated: installLogLines.length > 200,
    },
    {
      id: 'chk-build',
      kind: 'build',
      command: 'docker build -t app:latest .',
      exitCode: 0,
      status: 'passed',
      durationMs: 8900,
      required: true,
      logTail: buildLogLines.slice(-200).join('\n'),
      logTruncated: buildLogLines.length > 200,
    },
    {
      id: 'chk-lint',
      kind: 'lint',
      command: 'flake8 app/ --max-line-length=100',
      exitCode: 0,
      status: 'passed',
      durationMs: 1450,
      required: true,
      logTail: lintLogLines.slice(-200).join('\n'),
      logTruncated: lintLogLines.length > 200,
    },
    {
      id: 'chk-test',
      kind: 'test',
      command: 'pytest tests/test_webhooks.py -v',
      exitCode: scenario === 'fail' ? 1 : 0,
      status: scenario === 'fail' ? 'failed' : 'passed',
      durationMs: scenario === 'fail' ? 2400 : 1850,
      required: true,
      logTail: (scenario === 'fail' ? testLogFailLines : testLogPassLines).slice(-200).join('\n'),
      logTruncated: false,
    },
    {
      id: 'chk-docs',
      kind: 'other',
      command: 'mkdocs build --strict',
      exitCode: scenario === 'mixed' ? 1 : 0,
      status: scenario === 'mixed' ? 'failed' : 'passed',
      durationMs: 950,
      required: false,
      logTail: (scenario === 'mixed' ? docsLogFailLines : docsLogPassLines).slice(-200).join('\n'),
      logTruncated: false,
    },
  ];
}

export function getMockRun(scenario: ReviewScenario): AutomatedRun {
  const checks = getMockChecks(scenario);
  const isPass = scenario === 'pass';

  const files = isPass
    ? [
        { path: 'app/webhooks.py', status: 'modified' as const, additions: 28, deletions: 6 },
        { path: 'app/retry.py', status: 'modified' as const, additions: 14, deletions: 3 },
        { path: 'README.md', status: 'added' as const, additions: 9, deletions: 0 },
      ]
    : [
        { path: 'app/webhooks.py', status: 'modified' as const, additions: 28, deletions: 6 },
        { path: 'app/retry.py', status: 'modified' as const, additions: 14, deletions: 3 },
      ];

  const totalAdditions = files.reduce((acc, f) => acc + f.additions, 0);
  const totalDeletions = files.reduce((acc, f) => acc + f.deletions, 0);

  return {
    runId: `run-${scenario}-01`,
    submissionId: BASE_SUBMISSION_ID,
    commitSha: BASE_COMMIT_SHA,
    status: 'completed',
    startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    finishedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    message: null,
    checks,
    diff: {
      files,
      totalAdditions,
      totalDeletions,
    },
  };
}

export function getMockAiReport(scenario: ReviewScenario): AiVerificationReport {
  if (scenario === 'pass') {
    return {
      reportId: 'rep-pass-01',
      generatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      criteria: [
        {
          criterionId: 'crit-1',
          text: 'Webhook signatures are validated before idempotency cache check',
          required: true,
          status: 'met',
          reasoning: 'Verified HMAC signature check executes on line 34 before cache access.',
          evidence: [
            {
              path: 'app/webhooks.py',
              startLine: 32,
              endLine: 45,
              snippet: 'verify_signature(payload, secret)\ncheck_idempotency_key(key)',
            },
          ],
        },
        {
          criterionId: 'crit-2',
          text: 'Exponential backoff retry with jitter implemented for payment gateway errors',
          required: true,
          status: 'met',
          reasoning: 'Retry loop in retry.py uses random uniform jitter with max attempt cap.',
          evidence: [
            {
              path: 'app/retry.py',
              startLine: 12,
              endLine: 28,
              snippet: 'delay = min(max_delay, base_delay * (2 ** attempt)) + random.uniform(0, 1)',
            },
          ],
        },
        {
          criterionId: 'crit-3',
          text: 'Duplicate events return 200 OK with duplicate indicator header',
          required: true,
          status: 'met',
          reasoning: 'Returns cached transaction record with X-Idempotent-Replay header.',
          evidence: [
            {
              path: 'app/webhooks.py',
              startLine: 50,
              endLine: 62,
              snippet: 'return Response(status_code=200, headers={"X-Idempotent-Replay": "true"})',
            },
          ],
        },
        {
          criterionId: 'crit-4',
          text: 'Documentation updated with retry parameters and webhook setup steps',
          required: false,
          status: 'met',
          reasoning: 'README.md contains configuration table for RETRY_MAX_ATTEMPTS.',
          evidence: [
            {
              path: 'README.md',
              startLine: 1,
              endLine: 9,
              snippet: '### Retry Configuration\n| Var | Default | Description |',
            },
          ],
        },
      ],
      risks: [
        {
          id: 'risk-1',
          severity: 'low',
          category: 'other',
          text: 'Default base delay of 1.0s could be made configurable via environment variable.',
          evidence: [{ path: 'app/retry.py', startLine: 14, endLine: 16 }],
        },
      ],
    };
  }

  if (scenario === 'fail') {
    return {
      reportId: 'rep-fail-01',
      generatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      criteria: [
        {
          criterionId: 'crit-1',
          text: 'Webhook signatures are validated before idempotency cache check',
          required: true,
          status: 'not_met',
          reasoning: 'Signature check is bypassed when idempotency key is present in header.',
          evidence: [
            {
              path: 'app/webhooks.py',
              startLine: 20,
              endLine: 35,
              snippet: 'if key in cache: return cached_response # missing signature verify',
            },
          ],
        },
        {
          criterionId: 'crit-2',
          text: 'Exponential backoff retry with jitter implemented for payment gateway errors',
          required: true,
          status: 'partial',
          reasoning: 'Backoff formula is linear instead of exponential in fallback route.',
          evidence: [
            {
              path: 'app/retry.py',
              startLine: 10,
              endLine: 20,
              snippet: 'delay = base_delay * attempt',
            },
          ],
        },
        {
          criterionId: 'crit-3',
          text: 'Duplicate events return 200 OK with duplicate indicator header',
          required: true,
          status: 'met',
          reasoning: 'Duplicate header is set correctly.',
          evidence: [
            {
              path: 'app/webhooks.py',
              startLine: 50,
              endLine: 55,
              snippet: 'headers["X-Idempotent-Replay"] = "true"',
            },
          ],
        },
      ],
      risks: [
        {
          id: 'risk-fail-sec',
          severity: 'high',
          category: 'secrets',
          text: 'Sample API token sk-test-1234567890abcdefghijkl hardcoded in test fallback branch.',
          evidence: [{ path: 'app/webhooks.py', startLine: 15, endLine: 17 }],
        },
      ],
    };
  }

  // scenario === 'mixed' (default)
  return {
    reportId: 'rep-mixed-01',
    generatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    criteria: [
      {
        criterionId: 'crit-1',
        text: 'Webhook signatures are validated before idempotency cache check',
        required: true,
        status: 'met',
        reasoning: 'Verified HMAC signature check executes before cache access.',
        evidence: [
          {
            path: 'app/webhooks.py',
            startLine: 30,
            endLine: 42,
            snippet: 'verify_signature(payload, secret)\ncheck_idempotency_key(key)',
          },
        ],
      },
      {
        criterionId: 'crit-2',
        text: 'Exponential backoff retry with jitter implemented for payment gateway errors',
        required: true,
        status: 'partial',
        reasoning: 'Backoff implemented but the 5-attempt limit is missing in one code path.',
        evidence: [
          {
            path: 'app/retry.py',
            startLine: 15,
            endLine: 30,
            snippet: 'while retrying:\n  delay = calculate_backoff(attempt)',
          },
        ],
      },
      {
        criterionId: 'crit-3',
        text: 'Duplicate events return 200 OK with duplicate indicator header',
        required: true,
        status: 'met',
        reasoning: 'Duplicate events safely return 200 OK with header.',
        evidence: [
          {
            path: 'app/webhooks.py',
            startLine: 55,
            endLine: 65,
            snippet: 'headers["X-Idempotent-Replay"] = "true"',
          },
        ],
      },
      {
        criterionId: 'crit-4',
        text: 'Legacy webhook format converted before processing',
        required: true,
        status: 'met',
        reasoning: 'Format adapter maps payload v1 to schema v2.',
        evidence: [
          {
            // Pointing to a file NOT in the diff to test unverified evidence detection!
            path: 'app/legacy/handlers.py',
            startLine: 10,
            endLine: 25,
            snippet: 'def adapt_v1(payload): pass',
          },
        ],
      },
      {
        criterionId: 'crit-5',
        text: 'README documentation updated with retry parameters',
        required: false,
        status: 'not_met',
        reasoning: 'README documentation file was not included in submission changes.',
        evidence: [],
      },
    ],
    risks: [
      {
        id: 'risk-mixed-1',
        severity: 'high',
        category: 'error_handling',
        text: 'No error handling when the idempotency store is unavailable',
        evidence: [{ path: 'app/webhooks.py', startLine: 38, endLine: 44 }],
      },
      {
        id: 'risk-mixed-2',
        severity: 'medium',
        category: 'other',
        text: 'Retry delay is not capped',
        evidence: [{ path: 'app/retry.py', startLine: 22, endLine: 26 }],
      },
    ],
  };
}

export function getMockSubmission(): CurrentSubmission {
  return {
    submissionId: BASE_SUBMISSION_ID,
    version: 2,
    versionCount: 2,
    status: 'in_review',
    submittedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    developerName: BASE_DEVELOPER_NAME,
    summary:
      'Implemented robust duplicate payment webhook deduplication using Redis idempotency keys and exponential backoff retry for downstream gateway timeouts.',
    notes:
      'Please verify the retry jitter distribution in app/retry.py. The dead-letter queue routing has been configured for unresolved transactions after 5 attempts.',
    commitSha: BASE_COMMIT_SHA,
    feedback: null,
    decidedAt: null,
  };
}

export function getMockPayment(): ProjectPayment {
  return {
    state: 'held',
    amount: 4500,
    currency: 'INR',
    developerName: BASE_DEVELOPER_NAME,
  };
}
