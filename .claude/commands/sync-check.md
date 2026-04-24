# /sync-check — Webhook & Sync Health Audit

Audit the health of the webhook pipeline and reconciliation system for DevPulse.

## What this command does

1. **Check the WebhookEvent queue** — query the DB for any events stuck in PENDING or FAILED states
2. **Check stale repos** — find repos where `lastSyncedAt < now - 35min` and `isTracked = true`
3. **Cross-reference GitHub via MCP** — use the GitHub MCP server to verify repos still exist and webhooks are still registered
4. **Report summary** — output a structured health report

## Steps

### Step 1 — Query stuck webhook events

Run this DB query via Prisma:

```typescript
const stuck = await prisma.webhookEvent.findMany({
  where: {
    OR: [
      { status: 'PENDING' },
      { status: 'FAILED', retryCount: { lt: 3 } },
    ],
  },
  orderBy: { receivedAt: 'asc' },
  take: 20,
  include: { repo: { select: { fullName: true } } },
})
```

Report: count, oldest event's `receivedAt`, breakdown by `status`.

### Step 2 — Query stale repos

```typescript
const cutoff = new Date(Date.now() - 35 * 60 * 1000)
const stale = await prisma.repository.findMany({
  where: { isTracked: true, lastSyncedAt: { lt: cutoff } },
  include: { githubAccount: { select: { githubLogin: true } } },
})
```

Report: count, list of `fullName` + `lastSyncedAt` for each stale repo.

### Step 3 — Verify repos via GitHub MCP

For each tracked repo found in Step 2, use the GitHub MCP server to verify:

1. Use `mcp__github__get_repository` with `{ owner, repo }` parsed from `fullName`
   - If 404 → repo deleted or access revoked; flag as **INACCESSIBLE**
   - If 200 → repo accessible; proceed to webhook check
2. Use `mcp__github__list_repository_webhooks` with `{ owner, repo }`
   - If DevPulse webhook URL (`/api/webhooks/github`) not in the list → flag as **WEBHOOK_MISSING**
   - If present and `active: false` → flag as **WEBHOOK_INACTIVE**
   - If present and `active: true` → **HEALTHY**

### Step 4 — Report

Output a structured summary:

```
=== DevPulse Sync Health Check ===
Timestamp: <ISO>

WebhookEvent Queue:
  PENDING:  <n>
  FAILED:   <n>
  Oldest stuck event: <ISO or "none">

Stale Repos (<n> found):
  - owner/repo  last synced: <timeAgo>  webhook: HEALTHY|WEBHOOK_MISSING|INACCESSIBLE

Recommendations:
  - [ ] Run `npm run dev:worker` to process <n> stuck events
  - [ ] Investigate <repo> — webhook missing, re-register via PATCH /api/repos/:id
  - [ ] Check GITHUB_PERSONAL_ACCESS_TOKEN for <repo> — access revoked
```

Flag any critical issues (FAILED events with `retryCount >= 3`, inaccessible repos) in **bold**.
