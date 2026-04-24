# /security-scan — Security Audit

Audit DevPulse for token exposure, HMAC validation coverage, and ownership enforcement.
Apply fixes inline for every violation found. Write findings to `docs/SECURITY-AUDIT.md`.

---

## What this command checks

1. **Decrypt call sites** — all `decrypt()` calls are confined to `src/lib/github/client.ts`
2. **Token redaction in logs** — Pino redacts `accessToken` and `webhookSecret` on all paths
3. **No raw `console.*`** — all logging goes through `src/lib/logger.ts`
4. **HMAC validation order** — webhook route verifies signature before any DB write
5. **Ownership checks** — every `:accountId` and `:repoId` route verifies resource belongs to the authed user
6. **Response stripping** — no API response serialises `accessToken` or `webhookSecret`

---

## Steps

### Step 1 — Verify decrypt call sites

`src/lib/github/client.ts` is the **only** file allowed to call `decrypt()`. It exposes three
functions so callers never import `decrypt` directly:

| Exported function | Decrypts | Used by |
|---|---|---|
| `getOctokitForAccount(accountId)` | `accessToken` | All GitHub API callers |
| `getAccessTokenForAccount(accountId)` | `accessToken` | `mcp.ts` (needs raw bearer token) |
| `getWebhookSecretForAccount(accountId)` | `webhookSecret` | `webhooks.ts` (registration) |

Run:
```bash
grep -rn "decrypt(" src/ --include="*.ts"
```

Flag any `decrypt(` call in a file other than `src/lib/github/client.ts` and
`src/lib/crypto.ts` (definition) as a **VIOLATION**.

### Step 2 — Verify token redaction in Pino config

Read `src/lib/logger.ts`. Confirm the `redact` array includes all four paths:
```typescript
['accessToken', 'webhookSecret', '*.accessToken', '*.webhookSecret']
```

Missing any path → **VIOLATION**.

### Step 3 — Scan for raw console output

```bash
grep -rn "console\.\(log\|error\|warn\|info\|debug\)" src/ --include="*.ts"
```

Any hit is a **VIOLATION**. Replace with `logger.info / logger.warn / logger.error`.

### Step 4 — Verify HMAC validation order in webhook route

Read `src/app/api/webhooks/github/route.ts`. Confirm this exact sequence:

1. Parse required headers (`X-Hub-Signature-256`, `X-GitHub-Event`, `X-GitHub-Delivery`) → 400 if missing
2. Read raw body as text (before JSON parse)
3. Parse JSON payload
4. DB lookup: find `Repository` + `GitHubAccount` by `fullName` + `githubRepoId` (read-only)
5. Call `getWebhookSecretForAccount` via `client.ts` and verify HMAC → **401 if mismatch**
6. Only after HMAC passes: check duplicate `deliveryId` (409), then `enqueue` WebhookEvent

Any DB **write** before step 5 is a **VIOLATION**.

### Step 5 — Verify ownership checks on all parameterised routes

| Route file | Required check |
|---|---|
| `src/app/api/github-accounts/[accountId]/route.ts` (GET, DELETE) | `requireOwnership(accountId, session.user.id)` |
| `src/app/api/github-accounts/[accountId]/switch/route.ts` (POST) | `requireOwnership(accountId, session.user.id)` |
| `src/app/api/repos/[repoId]/route.ts` (GET, PATCH) | `requireRepoOwnership(repoId, session.user.id)` |
| `src/app/api/repos/[repoId]/metrics/route.ts` (GET) | `account.userId !== session.user.id` check |

Missing check on any HTTP method → **VIOLATION**.
Ownership failures must return `404 Not Found` (not `403`) to prevent enumeration.

### Step 6 — Verify response stripping

```bash
grep -rn "accessToken\|webhookSecret" src/app/api --include="*.ts"
```

All hits must be limited to:
- `github-accounts/route.ts` — encrypting the token before storage (POST handler)
- `webhooks/github/route.ts` — header reference only (no value returned)

Any `select` or spread that would include these fields in a JSON response → **VIOLATION**.

### Step 7 — Report

Output a structured report and write it to `docs/SECURITY-AUDIT.md`:

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

Fix every violation before reporting done.
