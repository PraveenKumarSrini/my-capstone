# CLAUDE.md — DevPulse Developer Analytics Dashboard

> This file is the single source of truth for Claude Code working in this codebase.
> Read it fully before making any changes. Update it when architectural decisions change.
> For full requirements and acceptance criteria, see [`docs/SPEC.md`](docs/SPEC.md).
> For the full API reference, see [`docs/API.md`](docs/API.md).

---

## Quick Start (new developer, < 5 min)

```bash
# 1. Install
npm ci

# 2. Start databases
docker compose up -d postgres postgres-test

# 3. Environment
cp .env.example .env
# Fill in DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GITHUB_CLIENT_ID,
# GITHUB_CLIENT_SECRET, ENCRYPTION_KEY (openssl rand -hex 32), WEBHOOK_BASE_URL

# 4. Bootstrap DB
npx prisma migrate dev
npx prisma db seed          # demo user: demo@devpulse.io / password123

# 5. Run
npm run dev                 # Next.js on :3000
npm run dev:worker          # background worker (separate terminal)
```

For webhook testing in dev: `ngrok http 3000` → set `WEBHOOK_BASE_URL` to the ngrok URL.

---

## Quick Reference

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run dev:worker       # Start background job worker (persistent Node.js process)

# Build & Quality
npm run build            # Production build
npm run lint             # ESLint check
npm run typecheck        # TypeScript type check (no emit)
npm run lint && npm run typecheck  # Run before every commit

# Testing
npm test                 # Jest unit + integration tests
npm run test:e2e         # Playwright end-to-end tests
npm run test:coverage    # Coverage report (target: >80%)

# Database
npx prisma generate      # Regenerate Prisma client (run after schema changes)
npx prisma migrate dev   # Apply pending migrations (dev only)
npx prisma db seed       # Seed demo data (1 user, 2 accounts, 3 repos, sample metrics)
npx prisma studio        # Open DB GUI at localhost:5555
docker compose up -d postgres-test  # Spin up test DB (port 5433)

# GitHub MCP (configured via .mcp.json — loaded automatically by Claude Code)
export GITHUB_PERSONAL_ACCESS_TOKEN=<pat>    # required for the github MCP server

# Local webhook testing (development only)
ngrok http 3000          # Expose localhost — set WEBHOOK_BASE_URL to ngrok URL
```

---

## Project Overview

**DevPulse** is an internal developer analytics dashboard. It aggregates GitHub activity (commits, PRs, reviews) across multiple GitHub accounts and repositories per user, presenting metrics through a real-time dashboard.

### Key Domain Concepts
- **User**: A DevPulse account (email + password or GitHub OAuth)
- **GitHubAccount**: A GitHub identity connected to a User (one user → many GitHub accounts, max 10)
- **Repository**: A GitHub repo tracked under a GitHubAccount (one GitHubAccount → up to 30 repos)
- **Metric**: A time-series data point captured for a Repository (commits, PRs, reviews, etc.)
- **WebhookEvent**: A durable inbox record for incoming GitHub webhook payloads (persisted before processing)
- **ActiveAccount**: The currently selected GitHubAccount context for a User session

### Architectural Decisions (locked)
| Decision | Choice |
|----------|--------|
| Deployment | Traditional Node.js (VPS/Docker) — persistent worker process |
| GitHub OAuth login | Auto-connects that GitHub account (Option A) |
| Real-time updates | GitHub Webhooks → DB queue → SSE push to browser |
| Downtime resilience | Three-layer: webhooks + WebhookEvent DB queue + 30-min reconciliation |
| SSE vs WebSockets | SSE (server→client push; simpler; auto-reconnects) |
| Token storage | AES-256-GCM encrypted at rest via `src/lib/crypto.ts` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Next.js 14 (App Router), TypeScript 5 |
| Styling | Tailwind CSS v3 only |
| Charts | Recharts |
| Backend | Next.js API Routes |
| ORM | Prisma 5 + PostgreSQL 16 |
| Auth | NextAuth v5 (JWT sessions) |
| GitHub Client | @octokit/rest (via `getOctokitForAccount`) |
| GitHub Data | GitHub MCP server via Claude Code |
| Real-time | Server-Sent Events (SSE) |
| Validation | Zod |
| HTTP Cache | SWR |
| Testing | Jest (unit/integration), Playwright (e2e) |
| CI/CD | GitHub Actions |
| Logger | `src/lib/logger.ts` (Pino, structured JSON) |

---

## Architecture

```
devpulse/
├── src/
│   ├── app/
│   │   ├── (auth)/                  # Login, register pages
│   │   ├── (dashboard)/             # Protected dashboard routes
│   │   │   ├── page.tsx             # Main dashboard view
│   │   │   ├── settings/            # GitHub account management
│   │   │   └── repos/               # Repo list + detail pages
│   │   └── api/
│   │       ├── auth/                # NextAuth handlers
│   │       ├── github-accounts/     # GitHub account CRUD
│   │       │   ├── route.ts         # GET (list), POST (connect)
│   │       │   └── [accountId]/
│   │       │       ├── route.ts     # GET, DELETE
│   │       │       └── switch/route.ts  # POST — switch active account
│   │       ├── repos/
│   │       │   ├── route.ts         # GET (list repos for active account)
│   │       │   ├── connect/route.ts # POST — add repo + register webhook
│   │       │   └── [repoId]/
│   │       │       ├── route.ts     # PATCH isTracked
│   │       │       └── metrics/route.ts  # GET metrics ?from=&to=&type=
│   │       ├── dashboard/
│   │       │   └── route.ts         # GET aggregated metrics
│   │       ├── webhooks/
│   │       │   └── github/route.ts  # POST — receive GitHub webhook events
│   │       └── sse/
│   │           └── metrics/route.ts # GET — SSE stream for real-time updates
│   ├── components/
│   │   ├── charts/                  # CommitChart (LineChart), PRChart (BarChart)
│   │   ├── dashboard/               # MetricsSummaryBar, MetricCard, SyncStatusBar
│   │   ├── layout/                  # DashboardShell, Sidebar, Header, AccountSwitcher
│   │   ├── repos/                   # RepoSelector, RepoCard, ActivityFeed, ConnectRepoForm
│   │   └── ui/                      # Button, Badge, Modal, Spinner, ErrorBoundary
│   ├── lib/
│   │   ├── auth.ts                  # NextAuth config — GitHub OAuth auto-connects account
│   │   ├── crypto.ts                # AES-256-GCM encrypt/decrypt (tokens + webhook secrets)
│   │   ├── sse.ts                   # EventEmitter singleton — subscribe/broadcast
│   │   ├── github/
│   │   │   ├── client.ts            # getOctokitForAccount(accountId) — ONLY place to decrypt token
│   │   │   ├── webhooks.ts          # registerWebhook / deleteWebhook via Octokit
│   │   │   ├── metrics.ts           # fetchMetricsForRepo — GitHub API → Metric[]
│   │   │   ├── processWebhookEvent.ts  # parse payload → write Metrics → broadcast SSE
│   │   │   ├── sync.ts              # reconcileStaleRepos — backfill via GitHub API
│   │   │   └── mcp.ts               # searchGitHubReposViaMCP — GitHub MCP server client
│   │   ├── db.ts                    # Prisma client singleton
│   │   ├── db/
│   │   │   ├── userRepo.ts
│   │   │   ├── accountRepo.ts
│   │   │   ├── repoRepo.ts
│   │   │   ├── metricRepo.ts
│   │   │   └── webhookEventRepo.ts  # enqueue / dequeue / mark status
│   │   ├── logger.ts                # Pino — redacts accessToken + webhookSecret
│   │   └── utils.ts                 # buildDateRange, formatMetricValue, chunkArray
│   ├── hooks/
│   │   ├── useActiveAccount.ts      # Session-based active account
│   │   ├── useMetrics.ts            # SWR hook for metrics
│   │   ├── useRepos.ts              # SWR hook for repos
│   │   └── useSSE.ts                # EventSource → on metrics_updated → SWR mutate()
│   └── types/
│       └── index.ts                 # All TS types + Zod schemas
├── prisma/
│   ├── schema.prisma                # Source of truth for DB schema (6 models)
│   ├── seed.ts                      # Demo data: 1 user, 2 accounts, 3 repos, metrics
│   └── migrations/                  # Never edit manually
├── tests/
│   ├── unit/                        # Pure function tests
│   ├── integration/                 # API route tests with test DB
│   └── e2e/                         # Playwright browser tests
├── docs/
│   ├── SPEC.md                      # Formal spec: requirements, design, scope boundaries
│   ├── API.md                       # Complete endpoint reference with request/response examples
│   └── SECURITY-AUDIT.md            # Security audit findings
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Lint → Typecheck → Test → Build
│       └── deploy.yml               # On main merge: CI + E2E + deploy
├── .claude/
│   └── commands/                    # Custom Claude Code slash commands
│       ├── sync-check.md            # /sync-check — verify webhook + reconciliation health
│       ├── add-metric.md            # /add-metric — scaffold a new MetricType end-to-end
│       ├── security-scan.md         # /security-scan — audit tokens, HMAC, ownership checks
│       ├── deploy-check.md          # /deploy-check — pre-deployment verification checklist
│       └── add-feature.md           # /add-feature — scaffold a new feature end-to-end
├── CLAUDE.md                        # ← You are here
└── .claudeignore
```

---

## Database Schema (Prisma)

```prisma
// Key relationships — do not rename fields without a migration

model User {
  id               String          @id @default(cuid())
  email            String          @unique
  name             String?
  githubAccounts   GitHubAccount[]
  activeAccountId  String?         // FK to currently selected GitHubAccount
  sessions         Session[]
  createdAt        DateTime        @default(now())
}

model GitHubAccount {
  id             String        @id @default(cuid())
  userId         String
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  githubLogin    String        // GitHub username — never the raw token
  accessToken    String        // AES-256-GCM encrypted — NEVER log or expose
  avatarUrl      String?       // Cached from GitHub profile
  displayName    String?       // e.g. "Work", "Personal"
  webhookSecret  String?       // AES-256-GCM encrypted per-account HMAC secret
  repos          Repository[]
  createdAt      DateTime      @default(now())

  @@unique([userId, githubLogin])
}

model Repository {
  id              String         @id @default(cuid())
  githubAccountId String
  githubAccount   GitHubAccount  @relation(fields: [githubAccountId], references: [id], onDelete: Cascade)
  fullName        String         // "owner/repo"
  githubRepoId    Int            // GitHub numeric repo ID (for webhook payload validation)
  isTracked       Boolean        @default(true)
  webhookId       Int?           // GitHub webhook ID (used to delete on untrack)
  metrics         Metric[]
  webhookEvents   WebhookEvent[]
  lastSyncedAt    DateTime?

  @@unique([githubAccountId, fullName])
}

model Metric {
  id           String     @id @default(cuid())
  repoId       String
  repo         Repository @relation(fields: [repoId], references: [id], onDelete: Cascade)
  type         MetricType
  value        Float
  recordedAt   DateTime
  metadata     Json?

  @@index([repoId, type, recordedAt])
}

// Durable inbox — webhook payload persisted BEFORE processing begins
model WebhookEvent {
  id          String             @id @default(cuid())
  repoId      String
  repo        Repository         @relation(fields: [repoId], references: [id], onDelete: Cascade)
  deliveryId  String             @unique  // X-GitHub-Delivery — prevents duplicate processing
  eventType   String             // "push" | "pull_request" | "pull_request_review"
  payload     Json               // raw GitHub webhook payload
  status      WebhookEventStatus @default(PENDING)
  processedAt DateTime?
  retryCount  Int                @default(0)
  error       String?
  receivedAt  DateTime           @default(now())

  @@index([status, receivedAt])
}

enum MetricType {
  COMMIT_COUNT
  PR_OPENED
  PR_MERGED
  PR_CLOSED
  REVIEW_COUNT
  COMMENT_COUNT
}

enum WebhookEventStatus {
  PENDING
  PROCESSING
  PROCESSED
  FAILED
}
```

---

## Three-Layer Sync Architecture

Real-time data delivery is handled by three complementary layers:

```
Layer 1 — Webhooks (real-time, primary path)
  GitHub fires event → POST /api/webhooks/github
  → validate HMAC-SHA256 → INSERT WebhookEvent (PENDING) → 200 OK
  → async processWebhookEvent → write Metric → UPDATE lastSyncedAt
  → sseBroadcast → dashboard re-renders

Layer 2 — WebhookEvent Queue (durability)
  Payload saved to DB before processing.
  Worker startup: reprocess all PENDING + FAILED (retryCount < 3) events.
  Survives crashes, restarts, and deploy downtime.

Layer 3 — Reconciliation Job (safety net, every 30 min)
  Worker finds repos where lastSyncedAt < now - 35min.
  Fetches missing activity via GitHub API and upserts Metrics.
  Fills gaps from extended outages or missed webhook deliveries.
```

---

## Multi-GitHub-Account Design

One User can connect multiple GitHub accounts (personal, work, OSS org, etc.) — up to 10.

### Rules
1. Every API call that touches GitHub data **must** receive a `githubAccountId`. Never assume a default.
2. The active account is stored in the user's session as `session.user.activeAccountId`.
3. Account switching calls `POST /api/github-accounts/[accountId]/switch` — updates `User.activeAccountId` and re-issues JWT.
4. `src/lib/github/client.ts` exports `getOctokitForAccount(accountId)` — always use this, never instantiate Octokit directly.
5. Access tokens and webhook secrets are encrypted at rest via `src/lib/crypto.ts`. Never store or log raw values.
6. When listing repos, always scope to the currently active `GitHubAccount`, not the whole User.
7. GitHub OAuth login automatically connects that GitHub account (no separate step needed).

### AccountSwitcher Component
- Lives in `src/components/layout/AccountSwitcher.tsx`
- Displays all connected GitHub accounts with avatars and display names
- On select: calls the switch endpoint → JWT re-issued → `router.refresh()`
- Shows a loading state during switch — block all repo interactions mid-switch

---

## API Contract

All API responses follow this envelope:

```typescript
{ success: true, data: T }          // success
{ success: false, error: string, code?: string }  // error
```

Never return raw data without the envelope. Never throw unhandled errors — always catch and return `{ success: false, error: "..." }`.

### Key Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/github-accounts` | List all GitHub accounts for the current user |
| POST | `/api/github-accounts` | Connect a new GitHub account (OAuth code exchange) |
| GET | `/api/github-accounts/:accountId` | Get single account details |
| DELETE | `/api/github-accounts/:accountId` | Disconnect — removes webhooks first |
| POST | `/api/github-accounts/:accountId/switch` | Set as active account |
| GET | `/api/repos` | List repos for active GitHub account |
| GET | `/api/repos/discover` | Search GitHub repos for active account via MCP (`?q=` optional) |
| POST | `/api/repos/connect` | Track a new repo — registers webhook + initial sync |
| PATCH | `/api/repos/:repoId` | Toggle `isTracked` — registers or removes webhook |
| GET | `/api/repos/:repoId/metrics` | Fetch metrics (`?from=ISO&to=ISO&type=MetricType`) |
| GET | `/api/dashboard` | Aggregated metrics for all tracked repos in active account |
| POST | `/api/webhooks/github` | Receive GitHub webhook events (HMAC validated) |
| GET | `/api/sse/metrics` | SSE stream — pushes `metrics_updated` events to dashboard |
| GET | `/api/auth/[...nextauth]` | NextAuth handlers |

Full request/response contracts with examples: see [`docs/API.md`](docs/API.md).

---

## Webhook Security

Every incoming webhook is validated before any processing:

1. **HMAC-SHA256**: Compute `sha256(secret, rawBody)` and compare to `X-Hub-Signature-256` header. Reject with 401 if mismatch.
2. **Duplicate rejection**: `X-GitHub-Delivery` UUID stored in `WebhookEvent.deliveryId` with `@unique` — second delivery of same event returns 409.
3. **Repo ownership**: `repository.full_name` and `repository.id` in payload must match a `Repository` record owned by the account whose secret was used.
4. **Fast ack**: Return HTTP 200 within 500ms. Processing is async (`setImmediate`).

The per-account `webhookSecret` is generated on first repo connect, encrypted with AES-256-GCM, and decrypted only in `src/app/api/webhooks/github/route.ts`.

---

## Code Style & Conventions

### TypeScript
- Strict mode enabled. Fix type errors — do not use `any` or `@ts-ignore`
- Always add explicit return types to exported functions
- Use Zod schemas in `src/types/index.ts` for all external input validation
- Prefer `type` over `interface` unless declaration merging is needed

### React / Next.js
- Functional components only — no class components
- Use `async/await` — never `.then()` chains
- Server Components by default; add `'use client'` only when needed
- 2-space indentation, single quotes, no semicolons (Prettier enforced)
- Component files: PascalCase (`AccountSwitcher.tsx`)
- Utility files: camelCase (`githubClient.ts`)

### Logging
- Always use `src/lib/logger.ts` (Pino, structured JSON)
- Log levels: `logger.info`, `logger.warn`, `logger.error`
- Never use `console.log`, `console.error`, etc.
- Pino is configured to redact `accessToken`, `webhookSecret`, and `*.accessToken`

### Database
- All multi-table writes must use Prisma transactions
- Never call `prisma` directly in components or API routes — use repository functions in `src/lib/db/`
- Run `npx prisma generate` after every schema change

---

## DO NOT

- ❌ Use `console.log` — use `src/lib/logger.ts`
- ❌ Create new utility files — add to existing `src/lib/utils.ts`
- ❌ Use any CSS framework other than Tailwind CSS
- ❌ Instantiate Octokit directly — use `getOctokitForAccount(accountId)` from `src/lib/github/client.ts`
- ❌ Log or expose raw GitHub access tokens or webhook secrets under any circumstances
- ❌ Assume a default GitHub account — always require explicit `accountId`
- ❌ Modify `prisma/migrations/` manually — let Prisma CLI manage it
- ❌ Modify the NextAuth session shape without updating `src/types/index.ts` and all consumers
- ❌ Add API endpoints without the `{ success, data/error }` envelope
- ❌ Decrypt `accessToken` anywhere except `src/lib/github/client.ts`
- ❌ Decrypt `webhookSecret` anywhere except `src/app/api/webhooks/github/route.ts`
- ❌ Process a webhook payload without first persisting it as a `WebhookEvent` (PENDING)
- ❌ Modify the auth flow without discussing with the team lead
- ❌ Use `.then()` chains — always `async/await`
- ❌ Commit with failing lint or type errors

---

## Testing

- **Unit tests**: Pure functions, utilities, data transformers — in `tests/unit/`
- **Integration tests**: API routes using test DB — in `tests/integration/`
- **E2E tests**: Critical user flows — in `tests/e2e/`
- Component tests are colocated: `AccountSwitcher.test.tsx` next to `AccountSwitcher.tsx`
- Mock GitHub API calls in tests — never hit real GitHub from tests
- Test DB requires: `docker compose up -d postgres-test` (port 5433)
- Coverage target: >80%

Key integration test areas:
- Webhook HMAC validation + duplicate rejection
- WebhookEvent persisted before processing (durability)
- SSE broadcast after webhook processing
- Ownership checks on all `:accountId` and `:repoId` routes

---

## Custom Claude Code Commands

Five slash commands live in `.claude/commands/`:

| Command | File | What it does |
|---------|------|-------------|
| `/sync-check` | `sync-check.md` | Audit webhook health: check PENDING/FAILED events, stale repos, last reconciliation run |
| `/add-metric` | `add-metric.md` | Scaffold a new MetricType end-to-end: enum → processWebhookEvent → metrics.ts → chart → tests |
| `/security-scan` | `security-scan.md` | Audit: token redaction in logs, HMAC validation coverage, ownership checks on all routes |
| `/deploy-check` | `deploy-check.md` | Pre-deployment checklist: env vars, migrations, build, lint, tests, security |
| `/add-feature` | `add-feature.md` | Scaffold a new feature end-to-end: route → lib → component → hook → tests |

---

## MCP Integration (GitHub)

MCP servers are configured in `.mcp.json` at the project root. Claude Code loads them automatically when working in this directory.

### Configuration (`.mcp.json`)

| Server | Package | Purpose |
|--------|---------|---------|
| `github` | `@modelcontextprotocol/server-github` | List repos, fetch commits/PRs/reviews, manage webhooks |
| `filesystem` | `@modelcontextprotocol/server-filesystem` | Read project files without shell commands |

**Required env var for `github` server:**
```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=<your-pat>   # needs repo + read:user scope
```

### MCP tools used

| MCP Tool | Used in |
|----------|---------|
| `mcp__github__get_repository` | `/sync-check` — verify repo still accessible |
| `mcp__github__list_repository_webhooks` | `/sync-check` — confirm webhook is registered |
| `mcp__github__list_commits` | Development inspection of commit data |
| `mcp__github__list_pull_requests` | Development inspection of PR data |
| `mcp__filesystem__read_file` | Custom commands reading config/schema files |

### Runtime integration — `GET /api/repos/discover`

`src/lib/github/mcp.ts` exports `searchGitHubReposViaMCP(accountId, query?)` which:
1. Looks up the `GitHubAccount` and decrypts its `accessToken`
2. Spawns `@modelcontextprotocol/server-github` as a child process via `StdioClientTransport`
3. Calls the `search_repositories` MCP tool with the user's OAuth token
4. Returns typed `MCPRepoResult[]` to the caller

This is consumed by `GET /api/repos/discover?q=<optional>` — an API route used by the Connect Repo UI so users can browse their GitHub repos instead of manually typing `owner/repo`.

### Development tooling

For Claude Code development assistance (slash commands, repo inspection), set:
```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=<your-pat>  # needs repo + read:user scope
```
Claude Code loads `.mcp.json` automatically and uses MCP tools to inspect live GitHub state.

### Integration points in code

| File | MCP role |
|------|----------|
| `src/lib/github/mcp.ts` | **Runtime MCP client** — spawns GitHub MCP server, calls `search_repositories` |
| `src/app/api/repos/discover/route.ts` | **API route** — exposes MCP repo search to the frontend |
| `src/lib/github/client.ts` | Octokit factory; mirrors MCP tool surface for commit/PR/webhook operations |
| `src/lib/github/metrics.ts` | Fetches commit/PR/review data (same data MCP tools expose) |
| `src/lib/github/sync.ts` | Reconciliation; `/sync-check` audits its output via MCP |

### Custom commands that use MCP

- `/sync-check` — calls `mcp__github__get_repository` + `mcp__github__list_repository_webhooks` to verify webhook health
- `/security-scan` — uses `mcp__filesystem__read_file` to inspect route handlers for ownership checks

---

## Environment Variables

```bash
# Required
DATABASE_URL=                  # PostgreSQL connection string (dev: port 5432)
NEXTAUTH_SECRET=               # Random 32-char string
NEXTAUTH_URL=                  # e.g. http://localhost:3000

# GitHub OAuth App (for connecting GitHub accounts)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Encryption (for access tokens + webhook secrets at rest)
ENCRYPTION_KEY=                # 32-byte hex string

# Webhooks (set to ngrok URL in dev; public domain in prod)
WEBHOOK_BASE_URL=              # e.g. https://abc123.ngrok.io

# Optional
LOG_LEVEL=info                 # debug | info | warn | error
SYNC_INTERVAL_MS=1800000       # Reconciliation interval (default: 30 min)
```

Never commit `.env` files. Use `.env.example` as the template.

---

## CI/CD Pipeline (GitHub Actions)

```
Push to PR branch:
  1. Lint (ESLint)
  2. Typecheck (tsc --noEmit)
  3. Unit + Integration tests (Jest) — spins up postgres-test service
  4. Build (next build)

Merge to main:
  1. All above
  2. E2E tests (Playwright)
  3. Deploy to production (rsync / Docker)
```

All steps must pass before merge. No exceptions.

---

## Known Issues & Gotchas

- **Prisma client**: Always run `npx prisma generate` after any `schema.prisma` change
- **Test DB**: Must be running (`docker compose up -d postgres-test`) before `npm test`
- **GitHub rate limits**: Worker backs off 60s on 429. Check sync job logs if metrics are stale
- **Account switching**: After `POST /api/github-accounts/:id/switch`, JWT is re-issued. Call `router.refresh()` to re-fetch server components
- **Token encryption**: `GitHubAccount.accessToken` decrypted only in `src/lib/github/client.ts`
- **Webhook secret**: `GitHubAccount.webhookSecret` decrypted only in `src/app/api/webhooks/github/route.ts`
- **SSE + Node.js**: SSE connections are long-lived. The `src/lib/sse.ts` emitter holds refs to active `Response` streams — clean up on client disconnect to avoid memory leaks
- **Local webhooks**: GitHub cannot reach `localhost`. Use `ngrok http 3000` in dev and set `WEBHOOK_BASE_URL` to the ngrok URL

---

## Key Patterns & Invariants

These are non-obvious patterns that must not be broken:

### Encryption boundaries
| Secret | Encrypted in | Decrypted only in |
|--------|-------------|-------------------|
| `GitHubAccount.accessToken` | API route / NextAuth callback | `src/lib/github/client.ts` (three helpers) |
| `GitHubAccount.webhookSecret` | `src/lib/github/webhooks.ts` | `src/app/api/webhooks/github/route.ts` |

No other file may call `decrypt()` on these fields. Violations are caught by `/security-scan`.

### Webhook processing order (must not change)
1. Validate headers → 2. Parse payload → 3. Look up repo → 4. Verify HMAC → 5. Check duplicate → **6. Persist `WebhookEvent(PENDING)`** → 7. Return 200 → 8. Process async

The payload **must** be in the DB before the 200 response. If the process crashes after step 6, the worker replays the event on restart.

### Octokit factory
Always use `getOctokitForAccount(accountId)` from `src/lib/github/client.ts`. Never call `new Octokit()` elsewhere. This is the single enforcement point for encrypted token decryption.

### Repository pattern for DB access
Never call `prisma.*` directly from API routes or components. Use the typed repo functions in `src/lib/db/`:
- `accountRepo.ts` — GitHubAccount CRUD
- `repoRepo.ts` — Repository CRUD + stale repo queries
- `metricRepo.ts` — insert, query, aggregate metrics
- `webhookEventRepo.ts` — enqueue / dequeue / status transitions
- `userRepo.ts` — user lookup, active account update

### API response shape
Every handler must return the `{ success, data }` / `{ success, error, code? }` envelope. Use `ApiException` to throw structured errors; the `handleApiError` utility converts them to the correct HTTP response. Never return raw data or let errors propagate unhandled.

### activeAccountId is required for all GitHub operations
Never fall back to "the user's only account" or a default. If `session.user.activeAccountId` is missing, return a clear error. Users with no accounts must connect one first.

### SSE cleanup
`src/lib/sse.ts` holds a `Map<accountId, Set<controller>>`. Every `GET /api/sse/metrics` handler must call `unsubscribe(accountId, controller)` in the `request.signal.onabort` handler to prevent memory leaks from stale connections.

---

## Adding a New GitHub Account (Flow Reference)

1. User clicks "Connect GitHub Account" in AccountSwitcher or Settings
2. App redirects to GitHub OAuth with `scope=repo,read:user`
3. GitHub redirects back to `/api/auth/callback/github`
4. NextAuth `signIn` callback: upsert `GitHubAccount` (encrypted token); if first account, set `User.activeAccountId`
5. Session JWT is re-issued with updated `activeAccountId`
6. Redirect to dashboard — new account appears in AccountSwitcher

---

*Last updated: 2026-04-27*  
*Maintainer: Praveen Kumar Srinivasan*
