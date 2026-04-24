# DevPulse Security Audit

**Timestamp:** 2026-04-24T00:00:00Z  
**Auditor:** /security-scan (Claude Code)  
**Branch:** master  
**Commit:** 8d9846e (commands) + inline fix applied this run

---

## Audit Summary

```
=== DevPulse Security Audit ===
Timestamp: 2026-04-24T00:00:00Z

Decrypt call sites:   VIOLATION → FIXED (webhooks/github/route.ts:49)
Token redaction:      PASS
Console usage:        PASS
HMAC order:           PASS
Ownership checks:     PASS
Response stripping:   PASS

Overall: 1 VIOLATION FOUND AND FIXED
```

---

## Findings

### FIXED-01 — Unauthorized `decrypt()` call in webhook route

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **File** | `src/app/api/webhooks/github/route.ts` |
| **Line** | 49 (pre-fix) |
| **Category** | Decrypt call site violation |

**Finding:** The webhook route called `decrypt(repo.githubAccount.webhookSecret)` directly and imported `decrypt` from `@/lib/crypto`. Per the updated architecture policy, `src/lib/github/client.ts` is the **only** file permitted to call `decrypt()` — all callers must go through one of the three exported helpers.

**Fix applied:**

```diff
- import { decrypt } from '@/lib/crypto'
+ import { getWebhookSecretForAccount } from '@/lib/github/client'

- const repo = await prisma.repository.findFirst({
-   where: { fullName: repoData.full_name, githubRepoId: repoData.id },
-   include: { githubAccount: true },
- })
+ const repo = await prisma.repository.findFirst({
+   where: { fullName: repoData.full_name, githubRepoId: repoData.id },
+ })

- const rawSecret = repo.githubAccount.webhookSecret
-   ? decrypt(repo.githubAccount.webhookSecret)
-   : null
+ const rawSecret = await getWebhookSecretForAccount(repo.githubAccountId)
```

Also removed the now-unnecessary `include: { githubAccount: true }` from the DB query — the encrypted value is no longer read into memory in this file at all.

---

## Passing Checks

### PASS-01 — Decrypt call sites

`src/lib/github/client.ts` is the sole file calling `decrypt()`. All three exported helpers are present and used correctly:

| Helper | Decrypts | Verified caller |
|---|---|---|
| `getOctokitForAccount` | `accessToken` | All GitHub API routes |
| `getAccessTokenForAccount` | `accessToken` | `src/lib/github/mcp.ts` |
| `getWebhookSecretForAccount` | `webhookSecret` | `src/lib/github/webhooks.ts`, `src/app/api/webhooks/github/route.ts` |

No `decrypt(` calls outside `src/lib/github/client.ts` or `src/lib/crypto.ts` (definition).

---

### PASS-02 — Token redaction in Pino logger

`src/lib/logger.ts` correctly redacts all four required paths:

```typescript
redact: {
  paths: ['accessToken', 'webhookSecret', '*.accessToken', '*.webhookSecret'],
  censor: '[REDACTED]',
}
```

---

### PASS-03 — No `console.*` usage

Zero `console.log/error/warn/info/debug` calls in `src/`. All logging routes through `src/lib/logger.ts`.

---

### PASS-04 — HMAC validation order

`src/app/api/webhooks/github/route.ts` sequence after fix:

1. Parse headers → 400 if missing
2. Read raw body as text (before JSON parse)
3. Parse JSON payload
4. DB lookup — `Repository` by `fullName` + `githubRepoId` (read-only, no `include`)
5. `await getWebhookSecretForAccount(repo.githubAccountId)` via `client.ts`
6. **HMAC verified** → 401 if mismatch
7. Duplicate `deliveryId` check → 409
8. `enqueue` WebhookEvent ← first DB write, after HMAC passes ✓

---

### PASS-05 — Ownership checks on all parameterised routes

| Route | Mechanism | Result |
|---|---|---|
| `GET /api/github-accounts/[accountId]` | `requireOwnership(accountId, session.user.id)` | ✓ |
| `DELETE /api/github-accounts/[accountId]` | `requireOwnership(accountId, session.user.id)` | ✓ |
| `POST /api/github-accounts/[accountId]/switch` | `requireOwnership(accountId, session.user.id)` | ✓ |
| `GET /api/repos/[repoId]` | `requireRepoOwnership(repoId, session.user.id)` | ✓ |
| `PATCH /api/repos/[repoId]` | `requireRepoOwnership(repoId, session.user.id)` | ✓ |
| `GET /api/repos/[repoId]/metrics` | `account.userId !== session.user.id` inline check | ✓ |

All ownership failures return `404 Not Found` to prevent resource enumeration.

---

### PASS-06 — API responses strip sensitive fields

All `toDTO()` functions and inline response builders exclude `accessToken` and `webhookSecret`.
`src/app/api/github-accounts/route.ts` references `accessToken` only in the POST handler for
input validation and encryption before storage — it never appears in a response body.

---

## Open Recommendations (non-blocking)

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| R-01 | MEDIUM | No rate limiting on `POST /api/github-accounts` or `POST /api/repos/connect` | Add IP-based rate limiting at edge middleware |
| R-02 | LOW | `POST /api/github-accounts` accepts raw `accessToken` in request body | Enforce HTTPS-only; validate token against GitHub API before storing |
| R-03 | LOW | `repos/[repoId]/metrics` uses inline ownership check instead of `requireRepoOwnership` | Consolidate to the shared helper |
| R-04 | INFO | CSP `script-src` includes `'unsafe-inline'` / `'unsafe-eval'` | Required by Next.js 14; migrate to nonce-based CSP on Next.js 15+ |

---

*Re-run `/security-scan` after any changes to API routes, auth flow, or token handling.*
