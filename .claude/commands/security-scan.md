# /security-scan — Security Audit

Audit DevPulse for token exposure, HMAC validation coverage, and ownership enforcement.

## What this command checks

1. **Token redaction in logs** — `accessToken` and `webhookSecret` never appear in plaintext in log output
2. **Decrypt call sites** — tokens are only decrypted in the two allowed locations
3. **HMAC validation** — webhook endpoint validates signature before any DB writes
4. **Ownership checks** — every `:accountId` and `:repoId` route verifies the resource belongs to the authed user
5. **Raw token exposure** — no API response includes `accessToken` or `webhookSecret`

## Steps

### Step 1 — Verify decrypt call sites

There are exactly two allowed locations for decrypting tokens:
- `src/lib/github/client.ts` — decrypts `accessToken`
- `src/app/api/webhooks/github/route.ts` — decrypts `webhookSecret`

Run:
```bash
grep -rn "decrypt(" src/ --include="*.ts"
```

Flag any `decrypt(` call outside those two files as a **VIOLATION**.

### Step 2 — Verify token redaction in Pino config

Read `src/lib/logger.ts`. Confirm the `redact` array includes:
```typescript
['accessToken', 'webhookSecret', '*.accessToken', '*.webhookSecret']
```

If any of these are missing → **VIOLATION**.

### Step 3 — Scan for raw console output of tokens

```bash
grep -rn "console\.\(log\|error\|warn\)" src/ --include="*.ts"
```

Any `console.*` usage is a **VIOLATION** (must use `logger.*` from `src/lib/logger.ts`).

### Step 4 — Verify HMAC validation order in webhook route

Read `src/app/api/webhooks/github/route.ts`. Confirm this exact sequence:
1. Parse headers (`X-Hub-Signature-256`, `X-GitHub-Event`, `X-GitHub-Delivery`)
2. Read raw body as `ArrayBuffer` (before any JSON parse)
3. Look up `Repository` + `GitHubAccount`
4. Decrypt `webhookSecret`
5. **Compute HMAC and compare** — reject with 401 if mismatch
6. Only after HMAC passes: check duplicate deliveryId, enqueue WebhookEvent

Any write to DB before the HMAC check is a **VIOLATION**.

### Step 5 — Verify ownership checks on all routes

For each of these route files, confirm `requireOwnership(accountId, userId)` or equivalent is called:

| Route | Must check |
|-------|-----------|
| `src/app/api/github-accounts/[accountId]/route.ts` (GET, DELETE) | `account.userId === session.user.userId` |
| `src/app/api/github-accounts/[accountId]/switch/route.ts` (POST) | same |
| `src/app/api/repos/[repoId]/route.ts` (PATCH) | `repo.githubAccount.userId === session.user.userId` |
| `src/app/api/repos/[repoId]/metrics/route.ts` (GET) | same |

Flag any route missing an ownership check as a **VIOLATION**.

### Step 6 — Verify API responses strip sensitive fields

Search for any response that serialises a `GitHubAccount` with `accessToken` or `webhookSecret`:

```bash
grep -rn "accessToken\|webhookSecret" src/app/api --include="*.ts"
```

Confirm only the two allowed decrypt call sites appear. Any `select` statement that returns these fields to the client is a **VIOLATION**.

### Step 7 — Report

Output a structured audit report:

```
=== DevPulse Security Audit ===
Timestamp: <ISO>

Decrypt call sites:   PASS | VIOLATION (<file>:<line>)
Token redaction:      PASS | VIOLATION (missing: <path>)
Console usage:        PASS | VIOLATION (<file>:<line>)
HMAC order:           PASS | VIOLATION (<description>)
Ownership checks:     PASS | VIOLATION (<route>)
Response stripping:   PASS | VIOLATION (<route>:<field>)

Overall: PASS | <n> VIOLATIONS FOUND
```

Fix all violations before shipping. For each violation found, apply the fix inline.
