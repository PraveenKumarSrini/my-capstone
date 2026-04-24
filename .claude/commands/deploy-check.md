# /deploy-check — Pre-Deployment Verification Checklist

Run this before every deployment to main. Mirrors the CI pipeline in
`.github/workflows/ci.yml` and adds deployment-specific safety checks.
**All items must pass before deploying.**

---

## Step 1 — Working tree is clean

```bash
git status
git diff --stat
```

Fail if there are uncommitted changes or untracked files in `src/`, `prisma/`, or config files.
Stash or commit everything before deploying.

---

## Step 2 — Lint

```bash
npm run lint
```

Zero errors required. Warnings are allowed but flag them in the output.

---

## Step 3 — Type check

```bash
npm run typecheck
```

Zero type errors. `@ts-ignore` or `any` added since last deploy → flag as a concern.

---

## Step 4 — Unit and integration tests with coverage

Ensure the test database is running first:
```bash
docker compose ps postgres-test
```

If not running:
```bash
docker compose up -d postgres-test
```

Run tests:
```bash
npm run test:coverage -- --ci
```

Coverage must be **≥ 80%** on lines. Print the summary table.
If below threshold, list the uncovered files and block deployment.

---

## Step 5 — Production build

```bash
npx prisma generate
npm run build
```

Build must complete without errors. Note any new warnings about bundle size.

---

## Step 6 — Dependency audit

```bash
npm audit --audit-level=high
```

Zero high or critical vulnerabilities. Moderate vulnerabilities: list them and
require explicit sign-off before proceeding.

---

## Step 7 — Pending database migrations

```bash
npx prisma migrate status
```

If any migrations are marked `Not Applied`, deployment will fail at startup.
Apply them to the production DB before deploying the new code:
```bash
npx prisma migrate deploy
```

---

## Step 8 — Environment variables

Check that all required env vars are set in the deployment environment:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✓ | Must be ≥ 32 random characters |
| `NEXTAUTH_URL` | ✓ | Must match the public domain (no trailing slash) |
| `GITHUB_CLIENT_ID` | ✓ | OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | ✓ | OAuth App client secret |
| `ENCRYPTION_KEY` | ✓ | 32-byte hex string — same key used to encrypt existing tokens |
| `WEBHOOK_BASE_URL` | ✓ | Public HTTPS URL (GitHub must reach this) |
| `LOG_LEVEL` | optional | Defaults to `info` |
| `SYNC_INTERVAL_MS` | optional | Defaults to 1800000 (30 min) |

Fail if any required variable is missing or set to a placeholder value
(e.g. `ci-placeholder`, `changeme`, all-zero `ENCRYPTION_KEY`).

---

## Step 9 — No secrets committed

```bash
git log --all --oneline -- .env .env.local .env.production
git grep -l "ENCRYPTION_KEY\s*=\s*[0-9a-f]\{32,\}" -- '*.ts' '*.js' '*.json' '*.yml'
```

If either command returns results → **block deployment and rotate the exposed secret immediately**.

---

## Step 10 — Security headers present

Read `next.config.js`. Confirm the `headers()` export includes at minimum:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `Content-Security-Policy`

Missing any of these → flag before deploying.

---

## Step 11 — CI pipeline passed on this commit

```bash
gh run list --branch main --limit 5
```

Confirm the most recent CI run for the commit being deployed shows all three jobs
(`test`, `build`, `security`) as ✓ passed. Never deploy a commit where CI did not run
or where any job failed.

---

## Final Report

Print a checklist summary:

```
=== DevPulse Deploy Check ===
Timestamp: <ISO>
Commit:    <git rev-parse --short HEAD>

[ ] Working tree clean
[ ] Lint passed
[ ] Typecheck passed
[ ] Tests passed (coverage: X%)
[ ] Build succeeded
[ ] npm audit clean
[ ] Migrations applied
[ ] Env vars verified
[ ] No secrets in git
[ ] Security headers present
[ ] CI passed on this commit

RESULT: READY TO DEPLOY | <n> CHECKS FAILED — DO NOT DEPLOY
```

If any check fails, list the specific failure and the remediation step.
Do not proceed with deployment until all checks pass.
