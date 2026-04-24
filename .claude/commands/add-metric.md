# /add-metric — Scaffold a New MetricType End-to-End

Adds a new `MetricType` to DevPulse across all layers: DB enum → webhook processor → GitHub fetch → chart → tests.

Usage: `/add-metric <TYPE_NAME> <github_event> <description>`

Example: `/add-metric COMMENT_COUNT issue_comment "Issue and PR comment count"`

## Steps

Work through these in order. Verify `npm run typecheck` passes after each step.

### Step 1 — Prisma enum

In `prisma/schema.prisma`, add the new value to `MetricType`:

```prisma
enum MetricType {
  COMMIT_COUNT
  PR_OPENED
  PR_MERGED
  PR_CLOSED
  REVIEW_COUNT
  COMMENT_COUNT
  <NEW_TYPE>   // ← add here
}
```

Then run:
```bash
npx prisma migrate dev --name add-<new-type>
npx prisma generate
```

### Step 2 — processWebhookEvent.ts

In `src/lib/github/processWebhookEvent.ts`, add a new case in the `switch (eventType)` block.

Determine `value` and `recordedAt` from the webhook payload. Follow the existing pattern:
- `push` → `COMMIT_COUNT`
- `pull_request_review` → `REVIEW_COUNT`

Add the mapping for the new GitHub event type.

### Step 3 — metrics.ts (GitHub API backfill)

In `src/lib/github/metrics.ts`, add a new fetch block inside `fetchMetricsForRepo`.

Use the appropriate Octokit method for the data source. Follow the existing pattern for commits and PRs:
- Paginate with `octokit.paginate`
- Filter by date range (`from`, `to`)
- Push to `metrics[]` with `{ repoId, type: '<NEW_TYPE>', value, recordedAt }`

### Step 4 — Webhook registration

In `src/lib/github/webhooks.ts`, add the new GitHub event name to the `events` array in `registerWebhook`:

```typescript
events: ['push', 'pull_request', 'pull_request_review', '<new_github_event>'],
```

### Step 5 — types/index.ts

In `src/types/index.ts`, verify the `MetricType` union type is derived from Prisma (it should be via `import type { MetricType } from '@prisma/client'`). If a manual union exists, add the new value.

Update `formatMetricValue` in `src/lib/utils.ts` to handle the new type:
```typescript
case '<NEW_TYPE>': return `${value} <unit>`
```

### Step 6 — Frontend: MetricTypeSelector

In `src/components/repos/MetricTypeSelector.tsx`, add the new type to the `<select>` options.

### Step 7 — Dashboard chart (if aggregated)

If the new metric should appear in the dashboard summary:
- Add it to `MetricsSummaryBar.tsx` as a new `MetricCard`
- Update `GET /api/dashboard` route to include it in the `summary` object

### Step 8 — Tests

Add test cases to:

1. `tests/unit/processWebhookEvent.test.ts`:
   ```typescript
   it('<new_event> payload → inserts <NEW_TYPE>', async () => { ... })
   ```

2. `tests/unit/metrics.test.ts`:
   - Mock the new Octokit method
   - Assert it maps to `<NEW_TYPE>` with correct value

3. `tests/integration/repos.test.ts`:
   - Add a query test: `?type=<NEW_TYPE>` returns metrics

### Step 9 — Verify

```bash
npm run typecheck
npm run lint
npm test
```

All checks must pass before the new metric type is considered complete.
