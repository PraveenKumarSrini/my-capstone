# DevPulse — Developer Analytics Dashboard

Aggregate GitHub activity (commits, PRs, reviews) across multiple accounts and repositories, visualised in a real-time dashboard with webhook-driven updates.

---

## Quick Start

**Prerequisites:** Node.js 20+, Docker, a GitHub OAuth App ([create one](https://github.com/settings/developers))

```bash
# 1. Clone and install
git clone <repo-url> devpulse && cd devpulse
npm ci

# 2. Start databases
docker compose up -d postgres        # dev DB on :5432
docker compose up -d postgres-test   # test DB on :5433

# 3. Configure environment
cp .env.example .env
# Edit .env — minimum required values shown below

# 4. Bootstrap the database
npx prisma migrate dev
npx prisma db seed        # loads demo user, 2 accounts, 3 repos, sample metrics

# 5. Start the app
npm run dev              # Next.js on http://localhost:3000
npm run dev:worker       # background sync worker (separate terminal)
```

Open `http://localhost:3000`. Log in with the seeded demo account: **demo@devpulse.io / password123**

### Minimum `.env` values

```bash
DATABASE_URL="postgresql://devpulse:devpulse@localhost:5432/devpulse"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"   # any 32+ char string
NEXTAUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID="<your-oauth-app-client-id>"
GITHUB_CLIENT_SECRET="<your-oauth-app-client-secret>"
ENCRYPTION_KEY="$(openssl rand -hex 32)"       # must be 64 hex chars (32 bytes)
WEBHOOK_BASE_URL="http://localhost:3000"        # replace with ngrok URL to receive webhooks
```

---

## Overview

DevPulse is an internal tool for engineering teams to track GitHub velocity across multiple accounts:

- **Multi-account**: one login can connect up to 10 GitHub identities (personal, work, OSS)
- **Real-time**: GitHub webhooks → DB queue → Server-Sent Events push to browser
- **Resilient**: three-layer sync survives crashes, restarts, and webhook outages
- **Secure**: AES-256-GCM encrypted tokens, HMAC-validated webhooks, ownership-checked routes

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                           Browser                                │
│                                                                  │
│   React Dashboard  ◄── SSE (metrics_updated event)             │
│       │                                                          │
│   SWR hooks ──────────────────────────────────────────────────► │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼───────────────────────────────────┐
│               Next.js App Server  (port 3000)                    │
│                                                                  │
│   GET  /api/github-accounts   POST /api/github-accounts         │
│   GET  /api/repos             POST /api/repos/connect           │
│   GET  /api/repos/discover    PATCH /api/repos/[repoId]         │
│   GET  /api/repos/[repoId]/metrics                              │
│   GET  /api/dashboard                                            │
│   GET  /api/sse/metrics       POST /api/webhooks/github         │
│                                                                  │
│   Auth: NextAuth v5 (JWT)   Validation: Zod                     │
└────────┬──────────────────────────────────┬──────────────────────┘
         │ Prisma ORM                       │ Octokit / MCP
┌────────▼──────────────┐     ┌────────────▼───────────────────────┐
│    PostgreSQL 16       │     │         GitHub API                 │
│                        │     │                                    │
│  User                  │     │  Commits · PRs · Reviews          │
│  GitHubAccount         │     │  Webhook management               │
│  Repository            │     │  Repo search (via MCP server)     │
│  Metric                │     └────────────────────────────────────┘
│  WebhookEvent          │
└────────────────────────┘
         ▲
         │  DB queue (PENDING / FAILED events)
┌────────┴───────────────────────────────────────────────────────────┐
│                   Background Worker  (tsx)                         │
│                                                                    │
│   Startup  ── reprocess all PENDING + FAILED WebhookEvents        │
│   Every 30 min ── reconcileStaleRepos() via GitHub API            │
│   On HTTP 429  ── back off 60 s, then resume                      │
│   SIGTERM/SIGINT ── graceful shutdown                              │
└────────────────────────────────────────────────────────────────────┘
         ▲
         │ POST /api/webhooks/github
  GitHub Webhooks (push · pull_request · pull_request_review)
```

### Three-Layer Sync

| Layer | Trigger | What it does |
|-------|---------|--------------|
| 1 — Webhooks | GitHub event fires | HMAC-validated → persisted as `WebhookEvent(PENDING)` → async process → SSE broadcast |
| 2 — DB Queue | Worker startup | Replays all `PENDING` + `FAILED` (retryCount < 3) events to survive crashes and deploys |
| 3 — Reconciliation | Every 30 min | Finds repos where `lastSyncedAt < now − 35 min`; backfills via GitHub API |

### Data Model

```
User (1) ──► GitHubAccount (up to 10)
               │  accessToken    — AES-256-GCM encrypted at rest
               │  webhookSecret  — AES-256-GCM encrypted at rest
               └──► Repository (up to 30 per account)
                      ├──► Metric[]        COMMIT_COUNT · PR_OPENED · PR_MERGED
                      │                   PR_CLOSED · REVIEW_COUNT · COMMENT_COUNT
                      └──► WebhookEvent[] PENDING → PROCESSING → PROCESSED | FAILED
```

---

## Environment Variables

```bash
# ── Required ────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/devpulse
NEXTAUTH_SECRET=<32-random-chars>           # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=<oauth-app-client-id>
GITHUB_CLIENT_SECRET=<oauth-app-client-secret>
ENCRYPTION_KEY=<64-char-hex-string>         # openssl rand -hex 32  (must be 64 chars)
WEBHOOK_BASE_URL=http://localhost:3000      # public URL; use ngrok in dev

# ── Optional ────────────────────────────────────────────────────────
LOG_LEVEL=info                 # debug | info | warn | error
SYNC_INTERVAL_MS=1800000       # reconciliation interval (default 30 min)
```

---

## Development

```bash
npm run dev           # Next.js dev server (port 3000)
npm run dev:worker    # background worker (separate terminal)

npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run lint && npm run typecheck   # run before every commit

npm test              # Jest unit + integration (requires postgres-test on :5433)
npm run test:coverage # coverage report (target ≥ 80%)
npm run test:e2e      # Playwright end-to-end

npx prisma generate   # regenerate client after schema.prisma changes
npx prisma studio     # DB GUI at localhost:5555
```

### Local Webhooks

GitHub cannot reach `localhost`. Use [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
# Copy the HTTPS URL, e.g. https://abc123.ngrok.io
# Set WEBHOOK_BASE_URL=https://abc123.ngrok.io in .env, then restart the server
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Next.js 14 (App Router), TypeScript 5 |
| Styling | Tailwind CSS v3 |
| Charts | Recharts |
| Backend | Next.js API Routes |
| ORM | Prisma 5 + PostgreSQL 16 |
| Auth | NextAuth v5 (JWT sessions) |
| GitHub client | @octokit/rest |
| Repo discovery | @modelcontextprotocol/sdk (GitHub MCP server) |
| Real-time | Server-Sent Events (SSE) |
| Validation | Zod |
| HTTP cache | SWR |
| Logging | Pino (structured JSON, secrets redacted) |
| Testing | Jest (unit + integration), Playwright (E2E) |
| CI/CD | GitHub Actions |

---

## Project Structure

```
devpulse/
├── src/
│   ├── app/
│   │   ├── (auth)/             login, register pages
│   │   ├── (dashboard)/        protected routes
│   │   └── api/                REST endpoints + SSE + webhook receiver
│   ├── components/
│   │   ├── charts/             CommitChart, PRChart (Recharts)
│   │   ├── dashboard/          MetricsSummaryBar, MetricCard, SyncStatusBar
│   │   ├── layout/             DashboardShell, Sidebar, AccountSwitcher
│   │   ├── repos/              RepoSelector, ConnectRepoForm, ActivityFeed
│   │   └── ui/                 Button, Badge, Modal, Spinner, ErrorBoundary
│   ├── hooks/
│   │   ├── useActiveAccount.ts
│   │   ├── useMetrics.ts       SWR hook
│   │   ├── useRepos.ts         SWR hook
│   │   └── useSSE.ts           EventSource → SWR mutate()
│   ├── lib/
│   │   ├── auth.ts             NextAuth config
│   │   ├── crypto.ts           AES-256-GCM encrypt/decrypt
│   │   ├── db.ts               Prisma singleton
│   │   ├── db/                 repository functions (accountRepo, repoRepo, …)
│   │   ├── github/
│   │   │   ├── client.ts       getOctokitForAccount — ONLY token decrypt site
│   │   │   ├── metrics.ts      fetchMetricsForRepo (commits, PRs, reviews)
│   │   │   ├── sync.ts         reconcileStaleRepos
│   │   │   ├── webhooks.ts     registerWebhook / deleteWebhook
│   │   │   ├── processWebhookEvent.ts
│   │   │   └── mcp.ts          searchGitHubReposViaMCP
│   │   ├── logger.ts           Pino (redacts accessToken, webhookSecret)
│   │   └── sse.ts              SSE broadcast singleton
│   ├── types/index.ts          All TS types + Zod schemas
│   └── worker.ts               Background worker entry point
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── tests/
│   ├── unit/                   Pure function tests
│   ├── integration/            API route tests (real DB on postgres-test)
│   └── e2e/                    Playwright browser tests
├── docs/
│   ├── SPEC.md                 Full requirements and acceptance criteria
│   ├── API.md                  Complete endpoint reference
│   └── SECURITY-AUDIT.md
├── .claude/commands/           Custom Claude Code slash commands
├── .github/workflows/          CI/CD pipelines
└── docker-compose.yml
```

---

## CI/CD

```
Push to PR / main branch:
  1. Lint (ESLint)
  2. Typecheck (tsc --noEmit)
  3. Test — Jest with postgres-test service (port 5433)
  4. Build (next build)
  [+ npm audit --audit-level=high]

Merge to main:
  1–4 above
  5. E2E tests (Playwright)
  6. Deploy (rsync / Docker)
```

---

## Security

| Concern | Mechanism |
|---------|-----------|
| GitHub tokens at rest | AES-256-GCM (`src/lib/crypto.ts`) |
| Webhook verification | HMAC-SHA256 (`X-Hub-Signature-256`), constant-time compare |
| Duplicate webhooks | `deliveryId` unique constraint → 409 response |
| Repo ownership | Every route verifies `repo.githubAccount.userId === session.user.id` |
| Password storage | bcrypt (10 rounds) |
| Log redaction | Pino redacts `accessToken` and `webhookSecret` fields |
| Decrypt boundaries | Access token: only `src/lib/github/client.ts` — Webhook secret: only `src/app/api/webhooks/github/route.ts` |
| HTTP headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options on all routes |

Run `/security-scan` in Claude Code to audit the above at any time.

---

## Custom Slash Commands

| Command | Description |
|---------|-------------|
| `/security-scan` | Audit token handling, HMAC order, ownership checks |
| `/deploy-check` | Pre-deployment verification checklist |
| `/add-feature` | Scaffold a new feature end-to-end |
| `/add-metric` | Add a new MetricType end-to-end |
| `/sync-check` | Audit webhook and reconciliation health |

---

## API Reference

Full endpoint documentation with request/response examples: [docs/API.md](docs/API.md)

All API responses use a standard envelope:

```json
{ "success": true, "data": {} }
{ "success": false, "error": "Human-readable message", "code": "MACHINE_CODE" }
```

---

## Contributing

1. `npm run lint && npm run typecheck` must pass before every commit
2. New API routes must use the `{ success, data/error }` envelope
3. Never call `prisma` directly in routes — use `src/lib/db/` repository functions
4. Never call `decrypt()` outside `src/lib/github/client.ts` (token) or the webhook route (secret)
5. See [CLAUDE.md](CLAUDE.md) for full coding conventions and [docs/SPEC.md](docs/SPEC.md) for requirements

---

*Maintainer: Praveen Kumar Srinivasan — praveenkumar.srinivasanmba@gmail.com*
