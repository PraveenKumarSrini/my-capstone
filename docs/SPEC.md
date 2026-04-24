# DevPulse — Formal Specification Document

**Version:** 1.0  
**Date:** 2026-04-24  
**Author:** Praveen Kumar Srinivasan  
**Status:** Approved — Ready for Implementation

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Technical Design](#2-technical-design)
3. [Implementation Plan](#3-implementation-plan)
4. [Scope Boundaries](#4-scope-boundaries)
5. [Success Criteria](#5-success-criteria)

---

## 1. Requirements

### 1.1 Product Vision

DevPulse is an internal developer analytics dashboard that aggregates GitHub activity (commits, pull requests, code reviews) across multiple GitHub accounts and repositories per user, presenting real-time metrics through an interactive dashboard.

### 1.2 User Roles

| Role | Description |
|------|-------------|
| **Developer** | A DevPulse user who connects one or more GitHub accounts and tracks repository activity |
| **System** | Background worker and webhook handler that keeps metrics up to date |

---

### 1.3 User Stories & Acceptance Criteria

#### Epic 1 — Authentication

---

**US-01: Register with email and password**

> As a developer, I want to register with my email and password, so that I can create a DevPulse account.

**Acceptance Criteria:**
- [ ] Registration form accepts `name`, `email`, `password` (min 8 chars)
- [ ] Password is hashed with bcrypt before storage (never stored in plaintext)
- [ ] Duplicate email returns a clear error message
- [ ] Successful registration redirects to the dashboard
- [ ] Form shows inline validation errors before submit
- [ ] Form shows a loading spinner while the request is in flight

---

**US-02: Log in with email and password**

> As a developer, I want to log in with my email and password, so that I can access my dashboard.

**Acceptance Criteria:**
- [ ] Login form accepts `email` and `password`
- [ ] Invalid credentials return a generic "Invalid email or password" message (no enumeration)
- [ ] Successful login redirects to `/dashboard`
- [ ] JWT session is issued; protected routes are accessible
- [ ] Unauthenticated access to `/dashboard/*` redirects to `/login`

---

**US-03: Log in with GitHub OAuth (auto-connect)**

> As a developer, I want to log in using my GitHub account, so that my GitHub identity is automatically connected to DevPulse in one step.

**Acceptance Criteria:**
- [ ] "Continue with GitHub" button initiates OAuth flow with `scope=repo,read:user`
- [ ] On first OAuth login, a new DevPulse `User` is created
- [ ] The authenticated GitHub account is automatically saved as a `GitHubAccount` (encrypted token)
- [ ] If this is the user's first GitHub account, it is set as `User.activeAccountId`
- [ ] If the user already exists (same email), the GitHub account is linked to the existing user
- [ ] After OAuth, user lands on `/dashboard`

---

#### Epic 2 — GitHub Account Management

---

**US-04: Connect an additional GitHub account**

> As a developer, I want to connect additional GitHub accounts (work, personal, OSS), so that I can track activity across all of them in one place.

**Acceptance Criteria:**
- [ ] "Connect GitHub Account" button in Settings / AccountSwitcher initiates OAuth
- [ ] New `GitHubAccount` record created with encrypted `accessToken`
- [ ] New account appears in the AccountSwitcher immediately after connecting
- [ ] Duplicate GitHub login for the same user returns a clear error
- [ ] Maximum of 10 GitHub accounts per DevPulse user (enforced server-side)

---

**US-05: Switch the active GitHub account**

> As a developer, I want to switch which GitHub account is active, so that the dashboard shows data for the account I care about right now.

**Acceptance Criteria:**
- [ ] AccountSwitcher lists all connected GitHub accounts with avatar and display name
- [ ] Clicking an account calls `POST /api/github-accounts/:accountId/switch`
- [ ] Dashboard re-renders showing only repos and metrics for the newly active account
- [ ] A loading state is shown during the switch; repo interactions are blocked
- [ ] Session is updated: `session.user.activeAccountId` reflects the new account
- [ ] Cannot switch to an account that belongs to a different user (ownership check enforced)

---

**US-06: Disconnect a GitHub account**

> As a developer, I want to disconnect a GitHub account I no longer need, so that it stops appearing in my dashboard.

**Acceptance Criteria:**
- [ ] Delete button in Settings → GitHub Accounts
- [ ] All GitHub webhooks registered for that account's repos are deleted from GitHub
- [ ] All associated `Repository` and `Metric` records are cascade-deleted
- [ ] Cannot disconnect the last connected account if it is the active account (clear error returned)
- [ ] Confirmation modal shown before deletion

---

#### Epic 3 — Repository Tracking

---

**US-07: View and track repositories**

> As a developer, I want to see all my GitHub repositories for the active account and choose which ones to track, so that only relevant repos appear on my dashboard.

**Acceptance Criteria:**
- [ ] `/dashboard/repos` shows all repos for the active `GitHubAccount`
- [ ] Each repo shows: full name, language, last synced timestamp, tracking toggle
- [ ] Toggling tracking on: creates `Repository` record (if not exists), registers GitHub webhook, triggers initial sync
- [ ] Toggling tracking off: sets `isTracked = false`, removes GitHub webhook from repo
- [ ] Changes to tracking are reflected immediately in the UI

---

**US-08: Connect a new repository to track**

> As a developer, I want to add a specific repository to track by entering its full name, so that I can start collecting metrics for it immediately.

**Acceptance Criteria:**
- [ ] Input accepts `owner/repo` format; Zod-validated server-side
- [ ] Server verifies the repo exists and the active GitHub account has access via Octokit
- [ ] `Repository` record created with `isTracked = true`
- [ ] GitHub webhook registered on the repo pointing to `/api/webhooks/github`
- [ ] Initial sync runs asynchronously; UI shows "Syncing…" status for `lastSyncedAt = null`
- [ ] Duplicate repo for the same account returns a clear error

---

#### Epic 4 — Real-time Metrics & Dashboard

---

**US-09: View aggregated dashboard metrics**

> As a developer, I want to see aggregated metrics across all my tracked repositories, so that I can understand my overall GitHub activity at a glance.

**Acceptance Criteria:**
- [ ] `/dashboard` shows summary cards: total commits, PRs opened, PRs merged, reviews given
- [ ] Default time range is last 30 days
- [ ] Commit activity displayed as a LineChart (Recharts)
- [ ] PR activity displayed as a BarChart (Recharts)
- [ ] ActivityFeed shows the 20 most recent events across all tracked repos
- [ ] `lastSyncedAt` displayed per repo; SyncStatusBar shows most-recently-synced timestamp
- [ ] Dashboard is scoped strictly to the active GitHub account

---

**US-10: View per-repository metrics with date range filter**

> As a developer, I want to drill into a specific repository's metrics and filter by date range and metric type, so that I can analyse activity for a particular repo over a specific period.

**Acceptance Criteria:**
- [ ] `/dashboard/repos/[repoId]` shows metrics for a single repo
- [ ] DateRangePicker lets user select `from` and `to` dates (ISO format passed as query params)
- [ ] MetricTypeSelector lets user choose one of: COMMIT_COUNT, PR_OPENED, PR_MERGED, PR_CLOSED, REVIEW_COUNT, COMMENT_COUNT
- [ ] Chart updates when date range or metric type changes
- [ ] Empty state shown when no metrics exist for the selected range
- [ ] `RepoSyncStatus` shows `lastSyncedAt` and webhook connection status

---

**US-11: Dashboard updates in real-time**

> As a developer, I want the dashboard to update automatically when new GitHub activity is detected, so that I always see up-to-date metrics without refreshing the page.

**Acceptance Criteria:**
- [ ] When a `push`, `pull_request`, or `pull_request_review` event arrives via webhook, the dashboard updates within 3 seconds
- [ ] No page refresh required
- [ ] SSE connection shows a visual indicator (green dot) when connected
- [ ] SSE automatically reconnects after a network interruption
- [ ] Metrics update is triggered by `metrics_updated` SSE event calling SWR `mutate()`

---

#### Epic 5 — System Reliability

---

**US-12: Webhook events survive system downtime**

> As a system, I want webhook events to be persisted immediately upon receipt, so that no GitHub activity is lost if the processing pipeline fails or the server restarts.

**Acceptance Criteria:**
- [ ] `WebhookEvent` record with `status = PENDING` is written before any processing begins
- [ ] HTTP 200 is returned to GitHub within 500ms of receipt (fast ack)
- [ ] If processing fails, `status = FAILED` and `error` message are recorded; `retryCount` is incremented
- [ ] On worker startup, all `PENDING` and `FAILED` (retryCount < 3) events are reprocessed
- [ ] Duplicate webhook delivery (same `X-GitHub-Delivery` UUID) is rejected with 409

---

**US-13: Reconciliation fills gaps from downtime**

> As a system, I want a periodic reconciliation job, so that metrics are eventually consistent even if webhook events were missed during downtime.

**Acceptance Criteria:**
- [ ] Worker runs reconciliation every 30 minutes
- [ ] Reconciliation targets repos where `lastSyncedAt < now - 35 minutes`
- [ ] Backfill uses GitHub API to fetch activity since `lastSyncedAt`
- [ ] Metrics are upserted (not duplicated) during backfill
- [ ] Worker backs off 60 seconds on GitHub 429 (rate limit) responses
- [ ] Each reconciliation cycle is logged with Pino at `info` level

---

### 1.4 Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Dashboard initial load < 2s on localhost; SSE event → UI update < 3s |
| **Security** | All GitHub tokens encrypted at rest (AES-256-GCM); webhook payloads validated with HMAC-SHA256 |
| **Reliability** | Three-layer sync: webhooks + DB event queue + 30-min reconciliation |
| **Scalability** | Supports up to 10 GitHub accounts × 30 repos = 300 tracked repos per user |
| **Observability** | All worker cycles, API errors, webhook events logged with Pino structured JSON |
| **Code quality** | TypeScript strict mode; no `any`; ESLint + Prettier enforced; >80% test coverage |
| **Maintainability** | Single source of truth: `CLAUDE.md` for architecture; `SPEC.md` for requirements |

---

## 2. Technical Design

### 2.1 Data Model

#### Entity-Relationship Diagram

```
┌──────────────────────┐         ┌─────────────────────────────────┐
│         User         │         │          GitHubAccount           │
│──────────────────────│         │─────────────────────────────────│
│ id          cuid PK  │◄────────│ id              cuid PK         │
│ email       unique   │  1    * │ userId          FK → User.id    │
│ name        String?  │         │ githubLogin     String          │
│ activeAccId String?  │─ ─ ─ ─▶│ accessToken     String (enc)   │
│ createdAt   DateTime │         │ avatarUrl       String?         │
│                      │         │ displayName     String?         │
│                      │         │ webhookSecret   String? (enc)   │
└──────────────────────┘         │ createdAt       DateTime        │
                                 │ UNIQUE(userId, githubLogin)     │
                                 └─────────────────────────────────┘
                                             │ 1
                                             │
                                             │ *
                                 ┌───────────────────────────┐
                                 │        Repository         │
                                 │───────────────────────────│
                                 │ id             cuid PK    │
                                 │ githubAccountId FK        │
                                 │ fullName       String     │
                                 │ githubRepoId   Int        │
                                 │ isTracked      Boolean    │
                                 │ webhookId      Int?       │
                                 │ lastSyncedAt   DateTime?  │
                                 │ UNIQUE(accountId,fullName)│
                                 └───────────────────────────┘
                                          │ 1          │ 1
                               ┌──────────┘            └──────────┐
                               │ *                                 │ *
                  ┌────────────────────────┐     ┌─────────────────────────────┐
                  │         Metric         │     │        WebhookEvent          │
                  │────────────────────────│     │─────────────────────────────│
                  │ id          cuid PK    │     │ id           cuid PK        │
                  │ repoId      FK         │     │ repoId       FK             │
                  │ type        MetricType │     │ deliveryId   String unique  │
                  │ value       Float      │     │ eventType    String         │
                  │ recordedAt  DateTime   │     │ payload      Json           │
                  │ metadata    Json?      │     │ status       Enum           │
                  │ INDEX(repoId,type,at)  │     │ processedAt  DateTime?      │
                  └────────────────────────┘     │ retryCount   Int            │
                                                 │ error        String?        │
                                                 │ receivedAt   DateTime       │
                                                 │ INDEX(status, receivedAt)   │
                                                 └─────────────────────────────┘

Enums:
  MetricType:        COMMIT_COUNT | PR_OPENED | PR_MERGED | PR_CLOSED | REVIEW_COUNT | COMMENT_COUNT
  WebhookEventStatus: PENDING | PROCESSING | PROCESSED | FAILED
```

#### Cascade Delete Chain
```
User deleted → GitHubAccount deleted → Repository deleted → Metric + WebhookEvent deleted
```

---

### 2.2 API Contracts

#### Standard Response Envelope

```typescript
// All endpoints return one of these two shapes
type ApiSuccess<T> = { success: true; data: T }
type ApiError     = { success: false; error: string; code?: string }
```

---

#### `GET /api/github-accounts`
List all GitHub accounts for the authenticated user.

**Auth:** Required  
**Response `data`:** `GitHubAccount[]`
```typescript
type GitHubAccount = {
  id: string
  githubLogin: string
  avatarUrl: string | null
  displayName: string | null
  createdAt: string  // ISO
}
```

---

#### `POST /api/github-accounts`
Connect a new GitHub account via OAuth code exchange.

**Auth:** Required  
**Request body:**
```typescript
{ code: string; state: string }
```
**Response `data`:** `GitHubAccount` (same shape as above)  
**Errors:** `409 { code: 'ALREADY_CONNECTED' }` if `(userId, githubLogin)` already exists

---

#### `GET /api/github-accounts/:accountId`
Get a single GitHub account.

**Auth:** Required + ownership  
**Response `data`:** `GitHubAccount`  
**Errors:** `404` if not found or not owned by authed user

---

#### `DELETE /api/github-accounts/:accountId`
Disconnect a GitHub account. Deletes all webhooks from GitHub first.

**Auth:** Required + ownership  
**Response `data`:** `{ deleted: true }`  
**Errors:** `409 { code: 'LAST_ACTIVE_ACCOUNT' }` if it's the only active account

---

#### `POST /api/github-accounts/:accountId/switch`
Set the active GitHub account. Updates `User.activeAccountId` and re-issues JWT.

**Auth:** Required + ownership  
**Response `data`:** `{ activeAccountId: string }`

---

#### `GET /api/repos`
List repositories for the active GitHub account.

**Auth:** Required  
**Response `data`:** `Repository[]`
```typescript
type Repository = {
  id: string
  fullName: string        // "owner/repo"
  isTracked: boolean
  lastSyncedAt: string | null
  webhookStatus: 'active' | 'missing' | 'unregistered'
}
```

---

#### `POST /api/repos/connect`
Start tracking a new repository. Registers webhook and triggers initial sync.

**Auth:** Required  
**Request body:**
```typescript
{ fullName: string }  // Zod: z.string().regex(/^[\w.-]+\/[\w.-]+$/)
```
**Response `data`:** `Repository`  
**Errors:** `404` if repo not found on GitHub; `409` if already tracked

---

#### `PATCH /api/repos/:repoId`
Toggle `isTracked`. Registers or removes webhook accordingly.

**Auth:** Required + ownership  
**Request body:**
```typescript
{ isTracked: boolean }
```
**Response `data`:** `Repository`

---

#### `GET /api/repos/:repoId/metrics`
Fetch time-series metrics for a repository.

**Auth:** Required + ownership  
**Query params:**
```
?from=2026-01-01T00:00:00Z    // required ISO datetime
&to=2026-04-24T23:59:59Z      // required ISO datetime
&type=COMMIT_COUNT             // required MetricType
```
**Response `data`:** `Metric[]`
```typescript
type Metric = {
  id: string
  type: MetricType
  value: number
  recordedAt: string   // ISO
  metadata: Record<string, unknown> | null
}
```
**Errors:** `400` if `from`/`to`/`type` missing or invalid

---

#### `GET /api/dashboard`
Aggregated metrics for all tracked repos in the active account.

**Auth:** Required  
**Response `data`:**
```typescript
type DashboardData = {
  summary: {
    totalCommits: number
    totalPRsOpened: number
    totalPRsMerged: number
    totalReviews: number
  }
  commitTimeline: Array<{ date: string; count: number }>
  prTimeline:     Array<{ date: string; opened: number; merged: number }>
  recentActivity: Array<{ repoFullName: string; type: MetricType; value: number; recordedAt: string }>
  repos: Repository[]
}
```

---

#### `POST /api/webhooks/github`
Receives GitHub webhook events. Must respond within 500ms.

**Auth:** None (validated by HMAC-SHA256 signature)  
**Headers:**
```
X-Hub-Signature-256: sha256=<hmac>
X-GitHub-Event: push | pull_request | pull_request_review
X-GitHub-Delivery: <uuid>
```
**Response `data`:** `{ received: true }`  
**Errors:** `401` if HMAC invalid; `409` if `deliveryId` already processed; `404` if repo not found

---

#### `GET /api/sse/metrics`
Server-Sent Events stream for real-time dashboard updates.

**Auth:** Required  
**Response:** `text/event-stream`
```
event: metrics_updated
data: {"repoId":"clxxx","accountId":"clyyy","type":"COMMIT_COUNT"}

event: heartbeat
data: {}
```
Client reconnects automatically on disconnect. Heartbeat sent every 30 seconds.

---

### 2.3 Webhook Event Processing Flow

```
GitHub fires event
      │
      ▼
POST /api/webhooks/github
  1. Validate X-Hub-Signature-256 (HMAC-SHA256 with per-account webhookSecret)
  2. Check X-GitHub-Delivery not in WebhookEvent (duplicate rejection)
  3. INSERT WebhookEvent { status: PENDING }
  4. Return HTTP 200 immediately
      │
      ▼ (async, setImmediate)
processWebhookEvent(eventId)
  1. UPDATE status → PROCESSING
  2. Parse payload by eventType:
     - push            → COMMIT_COUNT (commits.length)
     - pull_request    → PR_OPENED | PR_MERGED | PR_CLOSED (based on action)
     - pull_request_review → REVIEW_COUNT
  3. Prisma transaction:
     - INSERT Metric { repoId, type, value, recordedAt, metadata }
     - UPDATE Repository { lastSyncedAt: now() }
  4. UPDATE WebhookEvent { status: PROCESSED, processedAt }
  5. sseBroadcast(accountId, { type: 'metrics_updated', repoId, accountId })
      │
      ▼
SSE stream pushes to connected dashboard clients
useSSE() hook calls SWR mutate() → charts re-render
```

---

### 2.4 Frontend Component Tree

```
src/app/
├── layout.tsx                         RootLayout
│   └── <SessionProvider>
│
├── (auth)/
│   ├── login/page.tsx                 LoginPage
│   │   └── LoginForm
│   │       ├── [email, password inputs]
│   │       └── GitHubOAuthButton
│   └── register/page.tsx             RegisterPage
│       └── RegisterForm
│           └── [name, email, password inputs]
│
└── (dashboard)/
    ├── layout.tsx                     DashboardLayout
    │   └── DashboardShell
    │       ├── Sidebar
    │       │   ├── NavLinks           [href, label, icon]
    │       │   └── AccountSwitcher   [accounts, activeAccountId, isLoading]
    │       │       ├── AccountAvatar [login, avatarUrl, size]
    │       │       └── ConnectAccountButton
    │       └── Header                [title, breadcrumb?]
    │
    ├── page.tsx                       DashboardPage  ('use client')
    │   ├── SyncStatusBar             [lastSyncedAt, isSyncing, onManualSync]
    │   ├── MetricsSummaryBar         [summary: DashboardSummary]
    │   │   └── MetricCard            [label, value, delta?, icon]
    │   ├── CommitChart               [data: TimelinePoint[], dateRange]
    │   ├── PRChart                   [data: PRTimelinePoint[], dateRange]
    │   └── ActivityFeed              [events: ActivityEvent[], isLoading]
    │       └── useSSE()              → triggers SWR mutate on metrics_updated
    │
    ├── repos/
    │   ├── page.tsx                   ReposPage  ('use client')
    │   │   ├── ConnectRepoForm        [onConnect, isLoading]
    │   │   └── RepoSelector
    │   │       └── RepoCard          [repo, onToggleTrack, isUpdating]
    │   │           └── Badge         [variant: 'tracked' | 'untracked']
    │   │
    │   └── [repoId]/page.tsx          RepoDetailPage  ('use client')
    │       ├── DateRangePicker        [from, to, onChange]
    │       ├── MetricTypeSelector     [selected: MetricType, onChange]
    │       ├── MetricsChart           [data: Metric[], type: MetricType]
    │       └── RepoSyncStatus         [lastSyncedAt, webhookStatus]
    │
    └── settings/
        └── page.tsx                   SettingsPage  ('use client')
            └── GitHubAccountsManager
                └── AccountRow        [account, onDisconnect, isActive]

src/components/ui/                     Primitives (no business logic)
├── Button.tsx                        [variant, size, isLoading, disabled]
├── Badge.tsx                         [variant: 'success'|'warning'|'error'|'neutral']
├── Modal.tsx                         [isOpen, onClose, title, children]
├── Spinner.tsx                       [size: 'sm'|'md'|'lg']
└── ErrorBoundary.tsx                 [fallback, children]
```

---

### 2.5 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 14.x |
| Language | TypeScript | 5.x (strict) |
| Styling | Tailwind CSS | 3.x |
| Charts | Recharts | 2.x |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 16 |
| Auth | NextAuth | 5.x |
| GitHub Client | @octokit/rest | latest |
| Validation | Zod | 3.x |
| HTTP Cache | SWR | 2.x |
| Logger | Pino | 9.x |
| Testing | Jest + Playwright | latest |
| CI | GitHub Actions | — |
| Deployment | Traditional Node.js (VPS/Docker) | — |

---

### 2.6 Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Deployment target | Traditional Node.js | Persistent worker process required; no SSE timeouts; zero infra cost |
| GitHub OAuth | Auto-connects account (Option A) | One step instead of two; better UX |
| Real-time delivery | Webhooks (primary) + SSE push | Instant event-driven; no polling; auto-reconnects |
| Downtime resilience | WebhookEvent DB queue + startup catch-up + 30-min reconciliation | Three-layer redundancy ensures no data loss |
| SSE vs WebSockets | SSE | Server→client only; simpler; native browser support; auto-reconnect |
| Webhook auth | HMAC-SHA256 per-account secret + deliveryId dedup | Prevents forgery and replay attacks |
| Token storage | AES-256-GCM encrypted at rest | Safe even if DB is compromised |
| Test DB | Docker postgres-test on port 5433 | Isolated from dev DB; no mocking of Prisma |

---

## 3. Implementation Plan

> **How to use this checklist**
> Each phase is self-contained. Tell Claude _"implement Phase 1"_ (or any phase/step) and it will work through every checkbox in order, verifying each before advancing. Check off items as they are completed. A phase is done only when every checkbox in it is ticked and the phase verification passes.

---

### 3.0 Progress Tracker

| Phase | Name | Steps | Est. | Status |
|-------|------|-------|------|--------|
| P1 | Foundation | 1–3 | 6h | ✅ Done |
| P2 | Auth & Core APIs | 4–6 | 7h | 🔄 In Progress (backend ✅, auth UI ⬜) |
| P3 | Webhooks & Real-time | 7 | 3h | ✅ Done |
| P4 | Frontend | 8–12 | 8h | ⬜ Not started |
| P5 | Worker & Reliability | 13 | 1.5h | ⬜ Not started |
| P6 | Tests & CI | 14–15 | 6h | 🔄 In Progress (integration ✅, unit/e2e ⬜) |
| **Total** | | **15 steps** | **~31.5h** | |

> Update status to 🔄 In Progress → ✅ Done as phases complete.

---

## P1 — Foundation
**Goal:** Runnable Next.js project with database, all shared libraries, and types in place.  
**Unblocks:** Everything else — no other phase can start until P1 is complete.  
**Estimated time:** 6h

---

### Step 1 — Project Scaffolding `(est. 2h)`

**Config files**
- [x] Scaffold Next.js 14 App Router project with TypeScript + Tailwind into current directory
- [x] `package.json` — add all runtime deps: `prisma @prisma/client next-auth@5 @auth/prisma-adapter @octokit/rest pino pino-pretty swr recharts zod bcryptjs`
- [x] `package.json` — add all type deps: `@types/bcryptjs @types/node`
- [x] `package.json` — add all dev deps: `jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom ts-jest playwright @playwright/test eslint-config-next prettier`
- [x] `package.json` — add all npm scripts: `dev`, `dev:worker`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `test:coverage`
- [x] `tsconfig.json` — strict mode enabled; path alias `@/*` → `./src/*`
- [x] `.prettierrc` — 2-space indent, single quotes, no semicolons, trailing comma `es5`
- [x] `eslint.config.js` — extends `next/core-web-vitals` + `@typescript-eslint/recommended`
- [x] `next.config.js` — base config (no special flags needed for v1)

**Environment & infrastructure**
- [x] `.env.example` — document all 9 env vars with inline comments:
  ```
  DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL,
  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
  ENCRYPTION_KEY, WEBHOOK_BASE_URL, LOG_LEVEL, SYNC_INTERVAL_MS
  ```
- [x] `docker-compose.yml` — two services:
  - `postgres` on port `5432` (dev DB, volume `pgdata`)
  - `postgres-test` on port `5433` (test DB, no volume — ephemeral)
- [x] `.gitignore` — include `.env`, `node_modules/`, `.next/`, `coverage/`
- [x] `.claudeignore` — include `node_modules/`, `.next/`, `prisma/migrations/`

**Step 1 verification**
- [x] `npm run lint` passes on empty project
- [x] `npm run typecheck` passes
- [x] `docker compose up -d` starts both postgres services without errors

---

### Step 2 — Database Layer `(est. 2h)`

**Schema**
- [x] `prisma/schema.prisma` — define all 6 models: `User`, `GitHubAccount`, `Repository`, `Metric`, `WebhookEvent`, `Session`
- [x] `prisma/schema.prisma` — define both enums: `MetricType` (6 values), `WebhookEventStatus` (4 values)
- [x] `prisma/schema.prisma` — verify all cascade deletes: User→GitHubAccount→Repository→Metric+WebhookEvent
- [x] `prisma/schema.prisma` — verify indexes: `Metric(repoId, type, recordedAt)`, `WebhookEvent(status, receivedAt)`, `WebhookEvent.deliveryId @unique`
- [x] Run `npx prisma migrate dev --name init` — generates migration file
- [x] Run `npx prisma generate` — generates Prisma client

**Seed data**
- [x] `prisma/seed.ts` — seed script with:
  - 1 demo user (`demo@devpulse.dev` / password `demo1234`)
  - 2 `GitHubAccount` rows (one "Personal", one "Work") linked to demo user, with placeholder encrypted tokens
  - 3 `Repository` rows (2 under Personal account, 1 under Work), all `isTracked: true`
  - 30 days of sample `Metric` rows for each repo × each `MetricType` (realistic random values)
- [x] `package.json` — add `"prisma": { "seed": "ts-node prisma/seed.ts" }`
- [ ] Run `npx prisma db seed` — verify seed completes without errors
- [ ] Run `npx prisma studio` — visually verify all seed rows

**Repository functions**
- [x] `src/lib/db.ts` — Prisma client singleton (checks `globalThis.__prisma` to prevent hot-reload duplication)
- [x] `src/lib/db/userRepo.ts` — exports: `createUser`, `getUserByEmail`, `getUserById`, `updateActiveAccount`
- [x] `src/lib/db/accountRepo.ts` — exports: `createAccount`, `getAccountsByUserId`, `getAccountById`, `deleteAccount`, `getAccountWithSecret`
- [x] `src/lib/db/repoRepo.ts` — exports: `createRepo`, `getReposByAccountId`, `getRepoById`, `updateRepo`, `getStaleRepos`
- [x] `src/lib/db/metricRepo.ts` — exports: `insertMetric`, `getMetrics` (by repoId + type + date range), `getAggregatedMetrics`
- [x] `src/lib/db/webhookEventRepo.ts` — exports: `enqueue`, `markProcessing`, `markProcessed`, `markFailed`, `getPendingAndFailed`, `isDuplicate`

**Step 2 verification**
- [x] `npx prisma validate` passes
- [x] `npm run typecheck` passes (Prisma client types are generated)
- [ ] `npx prisma db seed` completes; `npx prisma studio` shows correct seed rows

---

### Step 3 — Core Library Modules `(est. 2h)`

**Encryption**
- [x] `src/lib/crypto.ts` — `encrypt(plaintext: string): string` using AES-256-GCM with `ENCRYPTION_KEY`
- [x] `src/lib/crypto.ts` — `decrypt(ciphertext: string): string` — inverse; throws on bad key/tampered data
- [x] `src/lib/crypto.ts` — IV is random per encryption, prepended to ciphertext (hex-encoded)

**Logger**
- [x] `src/lib/logger.ts` — Pino logger with:
  - `level` from `LOG_LEVEL` env var (default `info`)
  - `redact` paths: `['accessToken', 'webhookSecret', '*.accessToken', '*.webhookSecret']`
  - Pretty-print in development (`NODE_ENV !== 'production'`), JSON in production

**Utilities**
- [x] `src/lib/utils.ts` — `buildDateRange(from: string, to: string): { gte: Date; lte: Date }` — parses ISO strings, throws `ZodError` if invalid
- [x] `src/lib/utils.ts` — `formatMetricValue(type: MetricType, value: number): string` — e.g. `"42 commits"`
- [x] `src/lib/utils.ts` — `chunkArray<T>(arr: T[], size: number): T[][]`
- [x] `src/lib/utils.ts` — `timeAgo(date: Date): string` — e.g. `"3 minutes ago"`

**SSE emitter**
- [x] `src/lib/sse.ts` — `subscribe(accountId: string, res: Response): void` — registers SSE client; removes on `close` event
- [x] `src/lib/sse.ts` — `broadcast(accountId: string, event: SSEEvent): void` — writes to all subscribed clients for that account
- [x] `src/lib/sse.ts` — exported as a module-level singleton (one `EventEmitter` instance per process)

**Types & Zod schemas**
- [x] `src/types/index.ts` — TypeScript types: `GitHubAccount`, `Repository`, `Metric`, `DashboardData`, `AggregatedMetric`, `SSEEvent`, `ApiSuccess<T>`, `ApiError`
- [x] `src/types/index.ts` — Zod schemas: `ConnectRepoSchema`, `MetricsQuerySchema`, `RegisterSchema`, `LoginSchema`, `PatchRepoSchema`
- [x] `src/types/index.ts` — augment `next-auth` types to add `activeAccountId` to `Session` and `JWT`

**Step 3 verification**
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes

---

## P2 — Auth & Core APIs
**Goal:** Users can register, log in (email or GitHub OAuth), and all data-fetching API routes are functional.  
**Depends on:** P1 complete.  
**Estimated time:** 7h

---

### Step 4 — Authentication `(est. 2h)`

**NextAuth config**
- [x] `src/lib/auth.ts` — configure `Credentials` provider: look up user by email, verify bcrypt hash
- [x] `src/lib/auth.ts` — configure `GitHub` provider: on `signIn` callback, upsert `GitHubAccount` with encrypted token; if first account for user, set `User.activeAccountId`
- [x] `src/lib/auth.ts` — `jwt` callback: embed `activeAccountId`, `userId` into token
- [x] `src/lib/auth.ts` — `session` callback: expose `activeAccountId` and `userId` on `session.user`
- [x] `src/lib/auth.ts` — export `{ handlers, auth, signIn, signOut }` (NextAuth v5 pattern)

**Auth route**
- [x] `src/app/api/auth/[...nextauth]/route.ts` — export `{ GET, POST }` from `handlers`

**Auth pages**
- [ ] `src/app/(auth)/layout.tsx` — centered card layout, no sidebar
- [ ] `src/app/(auth)/login/page.tsx` — renders `LoginForm`
- [ ] `src/components/auth/LoginForm.tsx` — email + password fields; loading spinner on submit; error message display; link to `/register`
- [ ] `src/components/auth/GitHubOAuthButton.tsx` — calls `signIn('github')`; shows spinner while redirecting
- [ ] `src/app/(auth)/register/page.tsx` — renders `RegisterForm`
- [ ] `src/components/auth/RegisterForm.tsx` — name + email + password fields; calls `POST /api/auth/register`; redirects to `/login` on success
- [x] `src/app/api/auth/register/route.ts` — POST handler: Zod validate body, check duplicate email, bcrypt hash password, create `User`

**Route protection**
- [x] `src/middleware.ts` — protect all `/dashboard/*` routes; redirect unauthenticated users to `/login`
- [x] `src/app/layout.tsx` — wrap with `<SessionProvider>`
- [x] `src/app/page.tsx` — redirect `/` to `/dashboard` if authenticated, else to `/login`

**Step 4 verification**
- [ ] Register a new user via form; verify `User` row in DB with hashed password
- [ ] Log in with credentials; verify JWT session; visit `/dashboard` directly
- [ ] Visit `/dashboard` while logged out; verify redirect to `/login`
- [x] `npm run typecheck` passes

---

### Step 5 — GitHub Client + Webhooks + Metrics `(est. 3h)`

**Octokit factory**
- [x] `src/lib/github/client.ts` — `getOctokitForAccount(accountId: string): Promise<Octokit>` — fetches `GitHubAccount`, decrypts `accessToken`, constructs and returns `Octokit` instance
- [x] `src/lib/github/client.ts` — throws `NotFoundError` if account not found; logs at `warn` level (never logs the token)

**Webhook registration**
- [x] `src/lib/github/webhooks.ts` — `registerWebhook(accountId, repoFullName): Promise<number>` — calls `octokit.repos.createWebhook` with `WEBHOOK_BASE_URL/api/webhooks/github`; returns `webhookId`; generates + stores encrypted `webhookSecret` on `GitHubAccount` if not set
- [x] `src/lib/github/webhooks.ts` — `deleteWebhook(accountId, repoFullName, webhookId): Promise<void>` — calls `octokit.repos.deleteWebhook`; logs `warn` (not error) if webhook already deleted on GitHub side (404 is acceptable)

**Metrics fetch**
- [x] `src/lib/github/metrics.ts` — `fetchMetricsForRepo(octokit, fullName, from, to): Promise<Metric[]>`:
  - Fetch commits via `octokit.repos.listCommits` with `since`/`until` params — map to `COMMIT_COUNT`
  - Fetch PRs via `octokit.pulls.list` (state=all) filtered by date — map opened/merged/closed to `PR_OPENED` / `PR_MERGED` / `PR_CLOSED`
  - Fetch reviews via `octokit.pulls.listReviews` for each PR — map to `REVIEW_COUNT`
  - Handle pagination with `octokit.paginate`
  - Respect `x-ratelimit-remaining`; log warning when < 100

**Webhook event processor**
- [x] `src/lib/github/processWebhookEvent.ts` — `processWebhookEvent(eventId: string): Promise<void>`:
  - Calls `webhookEventRepo.markProcessing(eventId)`
  - Switch on `eventType`:
    - `push` → `COMMIT_COUNT`, value = `payload.commits.length`, `recordedAt` = `payload.head_commit.timestamp`
    - `pull_request` (action=opened) → `PR_OPENED`
    - `pull_request` (action=closed, merged=true) → `PR_MERGED`
    - `pull_request` (action=closed, merged=false) → `PR_CLOSED`
    - `pull_request_review` (action=submitted) → `REVIEW_COUNT`
  - Prisma transaction: `insertMetric` + `updateRepo({ lastSyncedAt: new Date() })`
  - `webhookEventRepo.markProcessed(eventId)`
  - `sseBroadcast(accountId, { type: 'metrics_updated', repoId, accountId })`
  - On error: `webhookEventRepo.markFailed(eventId, error.message)`

**Reconciliation sync**
- [x] `src/lib/github/sync.ts` — `reconcileStaleRepos(): Promise<void>`:
  - `repoRepo.getStaleRepos(35)` — repos where `lastSyncedAt < now - 35min` and `isTracked = true`
  - For each stale repo: call `getOctokitForAccount` + `fetchMetricsForRepo(since: lastSyncedAt)`
  - Upsert metrics (skip duplicates by `repoId + type + recordedAt`); update `lastSyncedAt`
  - Log each reconciled repo at `info` level; log errors at `error` level without stopping the loop

**Step 5 verification**
- [x] `npm run typecheck` passes
- [ ] Manual: call `getOctokitForAccount` with seed account ID; verify Octokit resolves without error

---

### Step 6 — GitHub Account + Repo APIs `(est. 2h)`

**GitHub account routes**
- [x] `src/app/api/github-accounts/route.ts`:
  - `GET` — return all `GitHubAccount` rows for authed user (strip `accessToken`, `webhookSecret`)
  - `POST` — exchange OAuth code for token, encrypt, create `GitHubAccount`; if first account, set `User.activeAccountId`; return new account
- [x] `src/app/api/github-accounts/[accountId]/route.ts`:
  - `GET` — ownership check; return single account (stripped)
  - `DELETE` — ownership check; call `deleteWebhook` for each tracked repo; cascade-delete account; error if last active account
- [x] `src/app/api/github-accounts/[accountId]/switch/route.ts`:
  - `POST` — ownership check; `updateActiveAccount(userId, accountId)`; re-issue session JWT; return `{ activeAccountId }`

**Repo routes**
- [x] `src/app/api/repos/route.ts`:
  - `GET` — return all repos for `session.user.activeAccountId`
- [x] `src/app/api/repos/connect/route.ts`:
  - `POST` — Zod validate `{ fullName }`; verify repo exists on GitHub via Octokit; create `Repository`; call `registerWebhook`; trigger async initial sync (last 30 days); return repo
- [x] `src/app/api/repos/[repoId]/route.ts`:
  - `PATCH` — ownership check; Zod validate `{ isTracked }`; if `true` call `registerWebhook`, if `false` call `deleteWebhook`; update repo; return updated repo
- [x] `src/app/api/repos/[repoId]/metrics/route.ts`:
  - `GET` — ownership check; Zod validate `?from`, `?to`, `?type`; call `metricRepo.getMetrics`; return `Metric[]`
- [x] `src/app/api/dashboard/route.ts`:
  - `GET` — get all tracked repos for `activeAccountId`; call `metricRepo.getAggregatedMetrics` for last 30 days; build `DashboardData` shape; return

**Shared API helpers**
- [x] `src/lib/api.ts` — `requireAuth(request): Promise<Session>` — calls `auth()`; throws `UnauthorizedError` if no session
- [x] `src/lib/api.ts` — `requireOwnership(accountId, userId): Promise<GitHubAccount>` — calls `accountRepo.getAccountById`; throws `NotFoundError` if not found or wrong user
- [x] `src/lib/api.ts` — `apiSuccess<T>(data: T, status = 200): Response` — returns `{ success: true, data }`
- [x] `src/lib/api.ts` — `apiError(message: string, status: number, code?: string): Response` — returns `{ success: false, error, code }`

**Step 6 verification**
- [x] `npm run typecheck` passes
- [ ] Manual: `GET /api/github-accounts` returns seed accounts
- [ ] Manual: `GET /api/repos` returns seed repos
- [ ] Manual: `GET /api/repos/:id/metrics?from=...&to=...&type=COMMIT_COUNT` returns seed metrics
- [ ] Manual: `GET /api/dashboard` returns aggregated data

---

## P3 — Webhooks & Real-time
**Goal:** GitHub can deliver events to the app; dashboard clients receive instant SSE pushes.  
**Depends on:** P1 + P2 complete (specifically Step 5 for processWebhookEvent, Step 3 for sse.ts).  
**Estimated time:** 3h

---

### Step 7 — Webhook Endpoint + SSE `(est. 3h)`

**Webhook receiver**
- [x] `src/app/api/webhooks/github/route.ts` — `POST` handler:
  - Read raw body as `ArrayBuffer` for HMAC verification
  - Extract headers: `X-Hub-Signature-256`, `X-GitHub-Event`, `X-GitHub-Delivery`
  - Return `400` if any required header is missing
  - Look up `Repository` by `payload.repository.full_name` + `payload.repository.id`; return `404` if not found
  - Decrypt `GitHubAccount.webhookSecret` for that repo's account
  - Compute `sha256(secret, rawBody)` and compare to header value — return `401` if mismatch
  - Call `webhookEventRepo.isDuplicate(deliveryId)` — return `409` if already seen
  - Call `webhookEventRepo.enqueue({ repoId, deliveryId, eventType, payload })` — persisted immediately
  - Fire `setImmediate(() => processWebhookEvent(event.id))` — async, non-blocking
  - Return `200 { success: true, data: { received: true } }` immediately

**SSE stream**
- [x] `src/app/api/sse/metrics/route.ts` — `GET` handler:
  - Call `requireAuth` — return `401` if unauthenticated
  - Set response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
  - Call `sse.subscribe(session.user.activeAccountId, controller)`
  - Send initial `event: connected\ndata: {}\n\n`
  - Set `setInterval` heartbeat every 30s: `event: heartbeat\ndata: {}\n\n`
  - On `request.signal.addEventListener('abort')`: clear interval + unsubscribe

**Step 7 verification**
- [x] `npm run typecheck` passes
- [ ] Manual: POST a valid signed push payload to `/api/webhooks/github` — verify `WebhookEvent` row with `status: PROCESSED` appears in DB
- [ ] Manual: POST with wrong HMAC — verify `401` returned
- [ ] Manual: POST same `X-GitHub-Delivery` twice — verify `409` on second request
- [ ] Manual: Open `/api/sse/metrics` in browser (or `curl -N`) — verify heartbeat arrives every 30s
- [ ] Manual: Post webhook while SSE connection is open — verify `metrics_updated` event arrives on SSE stream

---

## P4 — Frontend
**Goal:** Full working UI — dashboard, repo management, account switching, real-time updates.  
**Depends on:** P1 + P2 + P3 complete.  
**Estimated time:** 8h

---

### Step 8 — UI Primitives `(est. 1h)`

- [ ] `src/components/ui/Button.tsx` — props: `variant` (`primary`|`secondary`|`ghost`|`danger`), `size` (`sm`|`md`|`lg`), `isLoading` (shows `<Spinner>`), `disabled`, `onClick`, `type`, `children`
- [ ] `src/components/ui/Badge.tsx` — props: `variant` (`success`|`warning`|`error`|`neutral`), `children`
- [ ] `src/components/ui/Modal.tsx` — props: `isOpen`, `onClose`, `title`, `children`; traps focus; closes on Escape or backdrop click
- [ ] `src/components/ui/Spinner.tsx` — props: `size` (`sm`|`md`|`lg`); Tailwind animated SVG
- [ ] `src/components/ui/ErrorBoundary.tsx` — class component; `fallback` prop; logs error with `logger.error`

**Step 8 verification**
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

---

### Step 9 — Layout & Navigation `(est. 2h)`

**Shell & sidebar**
- [ ] `src/components/layout/DashboardShell.tsx` — two-column layout: fixed sidebar + scrollable main content; `children` prop
- [ ] `src/components/layout/Sidebar.tsx` — contains `NavLinks` + `AccountSwitcher`; fixed left column
- [ ] `src/components/layout/NavLinks.tsx` — links: Dashboard (`/dashboard`), Repos (`/dashboard/repos`), Settings (`/dashboard/settings`); highlights active route
- [ ] `src/components/layout/Header.tsx` — shows page `title` + optional breadcrumb; user avatar + logout button

**Account switcher**
- [ ] `src/components/layout/AccountSwitcher.tsx`:
  - Fetches accounts via `GET /api/github-accounts` with SWR
  - Renders each account with `AccountAvatar` + display name
  - Highlights active account (from `session.user.activeAccountId`)
  - On click: calls `POST /api/github-accounts/:id/switch`; shows `Spinner` during switch; calls `router.refresh()` after
  - Blocks all repo interactions during switch (`isLoading` state propagated via context)
  - "Connect GitHub Account" button at bottom
- [ ] `src/components/layout/AccountAvatar.tsx` — shows GitHub avatar (or initials fallback); props: `login`, `avatarUrl`, `size`

**Dashboard layout**
- [ ] `src/app/(dashboard)/layout.tsx` — wraps all dashboard pages in `DashboardShell`; calls `requireAuth` server-side; passes session to shell

**Hook**
- [ ] `src/hooks/useActiveAccount.ts` — returns `{ activeAccountId, accounts, isLoading }` from SWR + session

**Step 9 verification**
- [ ] `npm run dev` — navigate to `/dashboard`; sidebar + header visible
- [ ] `npm run typecheck` passes

---

### Step 10 — Real-time Hooks `(est. 1h)`

- [ ] `src/hooks/useRepos.ts` — SWR fetcher for `GET /api/repos`; returns `{ repos, isLoading, error, mutate }`
- [ ] `src/hooks/useMetrics.ts` — SWR fetcher for `GET /api/repos/:repoId/metrics?from=&to=&type=`; returns `{ metrics, isLoading, error }`
- [ ] `src/hooks/useSSE.ts`:
  - Opens `EventSource('/api/sse/metrics')` on mount
  - On `metrics_updated` event: calls `mutate()` on `useRepos` and `useDashboard` SWR keys
  - Reconnects automatically on error (EventSource handles this natively)
  - Shows connection status: `'connected' | 'connecting' | 'error'`
  - Closes `EventSource` on unmount

**Step 10 verification**
- [ ] `npm run typecheck` passes
- [ ] Manual: open dashboard; check browser DevTools → Network → EventStream for SSE connection

---

### Step 11 — Dashboard Page `(est. 2h)`

**Charts**
- [ ] `src/components/charts/CommitChart.tsx` — Recharts `LineChart`; props: `data: TimelinePoint[]`, `dateRange`; loading skeleton state; empty state
- [ ] `src/components/charts/PRChart.tsx` — Recharts `BarChart` (stacked: opened/merged/closed); props: `data: PRTimelinePoint[]`, `dateRange`; loading + empty states

**Dashboard components**
- [ ] `src/components/dashboard/MetricCard.tsx` — shows label, large value, optional delta (`+12%`), icon; loading skeleton variant
- [ ] `src/components/dashboard/MetricsSummaryBar.tsx` — row of 4 `MetricCard`s: Total Commits, PRs Opened, PRs Merged, Reviews
- [ ] `src/components/dashboard/SyncStatusBar.tsx` — shows `"Last synced X ago"` from `lastSyncedAt`; "Sync now" button (calls `POST /api/repos/connect` equivalent); SSE status dot (green=connected, grey=disconnected)
- [ ] `src/components/repos/ActivityFeed.tsx` — list of 20 most recent events; each row: repo name, event type badge, value, `timeAgo`; loading skeleton; empty state

**Dashboard page**
- [ ] `src/app/(dashboard)/page.tsx` — `'use client'`; fetches `GET /api/dashboard` via SWR; mounts `useSSE`; renders `SyncStatusBar` + `MetricsSummaryBar` + `CommitChart` + `PRChart` + `ActivityFeed`; full-page loading state on first load; error boundary

**Step 11 verification**
- [ ] `npm run dev` — dashboard loads with seed data charts visible
- [ ] Send a test webhook; verify dashboard chart updates without page refresh
- [ ] `npm run typecheck` passes

---

### Step 12 — Repos & Settings Pages `(est. 2h)`

**Repo components**
- [ ] `src/components/repos/RepoCard.tsx` — shows: full name, language, `isTracked` toggle (`<Badge>` + `<Button>`), `lastSyncedAt` via `timeAgo`; `isUpdating` loading state on toggle
- [ ] `src/components/repos/RepoSelector.tsx` — renders list of `RepoCard`s from `useRepos`; empty state; loading skeleton
- [ ] `src/components/repos/ConnectRepoForm.tsx` — text input for `owner/repo`; submits to `POST /api/repos/connect`; shows error on invalid format or not-found; shows success toast

**Repos page**
- [ ] `src/app/(dashboard)/repos/page.tsx` — `'use client'`; renders `ConnectRepoForm` + `RepoSelector`; error boundary

**Repo detail page**
- [ ] `src/components/repos/DateRangePicker.tsx` — two `<input type="date">` fields for `from` and `to`; defaults to last 30 days; validates `from < to`
- [ ] `src/components/repos/MetricTypeSelector.tsx` — `<select>` or tab bar for all 6 `MetricType` values; defaults to `COMMIT_COUNT`
- [ ] `src/components/repos/RepoSyncStatus.tsx` — shows `lastSyncedAt`, webhook status badge (`active`|`missing`), "Sync now" button
- [ ] `src/app/(dashboard)/repos/[repoId]/page.tsx` — `'use client'`; state for `from`, `to`, `type`; renders `DateRangePicker` + `MetricTypeSelector` + `MetricsChart` + `RepoSyncStatus`; loading + empty + error states

**Settings page**
- [ ] `src/app/(dashboard)/settings/page.tsx` — `'use client'`; renders GitHub accounts list
- [ ] `src/components/settings/GitHubAccountsManager.tsx` — lists all accounts via `useActiveAccount`; each row has "Disconnect" button with confirmation modal
- [ ] `src/components/settings/AccountRow.tsx` — account avatar + login + display name; "Active" badge if `isActive`; "Disconnect" button (disabled if last account)

**Step 12 verification**
- [ ] `npm run dev` — navigate to `/dashboard/repos`; seed repos visible with tracking toggles
- [ ] Toggle a repo off; verify `isTracked` updates in UI
- [ ] Navigate to `/dashboard/repos/:id`; change date range; verify chart re-fetches
- [ ] `npm run typecheck` passes

---

## P5 — Worker & Reliability
**Goal:** Background process that handles catch-up on startup and periodic reconciliation.  
**Depends on:** P1 + P2 (Step 5) complete.  
**Estimated time:** 1.5h

---

### Step 13 — Background Worker `(est. 1.5h)`

- [ ] `src/worker.ts` — main entry point:
  - Log startup with Pino: `logger.info('Worker starting')`
  - **Startup catch-up**: call `webhookEventRepo.getPendingAndFailed(maxRetries=3)` → for each: call `processWebhookEvent(id)`; log result
  - **Reconciliation loop**: `setInterval(reconcileStaleRepos, SYNC_INTERVAL_MS)`
  - **Rate limit backoff**: if `reconcileStaleRepos` throws a 429 error, wait 60s before next run (use `clearInterval`/`setTimeout` pattern)
  - **Graceful shutdown**: listen for `SIGTERM`/`SIGINT`; clear interval; wait for in-flight operations; `logger.info('Worker shutting down')`; `process.exit(0)`
- [ ] `package.json` — `"dev:worker"` script: `ts-node src/worker.ts`
- [ ] Verify `SYNC_INTERVAL_MS` is read from env (default `1800000` = 30 min)

**Step 13 verification**
- [ ] `npm run dev:worker` starts without errors; logs first reconciliation cycle
- [ ] Manually insert a `PENDING` `WebhookEvent` in DB; restart worker; verify it gets processed to `PROCESSED`
- [ ] `npm run typecheck` passes

---

## P6 — Tests & CI
**Goal:** >80% coverage; all critical paths tested; CI pipeline green on every push.  
**Depends on:** P1–P5 complete.  
**Estimated time:** 6h

---

### Step 14 — Tests `(est. 5h)`

**Test infrastructure**
- [x] `jest.config.ts` — `testEnvironment: jsdom` for component tests; `testEnvironment: node` for API/unit; `moduleNameMapper` for `@/*` alias; `transform` for TypeScript
- [x] `jest.setup.ts` — import `@testing-library/jest-dom`; mock `next/navigation`; set `process.env.DATABASE_URL` to postgres-test URL
- [ ] `playwright.config.ts` — baseURL `http://localhost:3000`; single `chromium` project for CI speed; retries: 2

**Unit tests** (`tests/unit/`)
- [ ] `crypto.test.ts` — encrypt then decrypt returns original string; different IVs produce different ciphertext; wrong key throws on decrypt
- [ ] `utils.test.ts` — `buildDateRange` with valid ISO strings; throws on invalid; `formatMetricValue` for each `MetricType`; `timeAgo` for various deltas
- [ ] `processWebhookEvent.test.ts`:
  - `push` payload → inserts `COMMIT_COUNT` metric with correct value
  - `pull_request` (action=opened) → inserts `PR_OPENED`
  - `pull_request` (action=closed, merged=true) → inserts `PR_MERGED`
  - `pull_request` (action=closed, merged=false) → inserts `PR_CLOSED`
  - `pull_request_review` → inserts `REVIEW_COUNT`
  - Unknown event type → marks `WebhookEvent` as `FAILED`
- [ ] `metrics.test.ts` — mock Octokit responses; verify commit list maps to `COMMIT_COUNT`; verify PR list maps to correct types; verify pagination is followed

**Integration tests** (`tests/integration/`) — all use postgres-test DB; reset between tests
- [x] `github-accounts.test.ts` — GET returns only authed user's accounts; DELETE cascades and removes webhooks; switch updates `activeAccountId`; ownership check returns 404
- [x] `repos.test.ts` — GET scoped to active account; PATCH `isTracked` registers/removes webhook; metrics query respects `from`/`to`/`type`; invalid query returns 400
- [x] `webhooks.test.ts` — valid HMAC + new deliveryId → 200 + `PENDING` row created; wrong HMAC → 401; duplicate deliveryId → 409; async processing sets status to `PROCESSED`
- [x] `dashboard.test.ts` — aggregated response sums metrics across all tracked repos; excludes untracked repos
- [x] `sse.test.ts` — unauthenticated → 401; authenticated → SSE connection established; after `processWebhookEvent`, `broadcast` called with correct accountId

**Component tests** (colocated)
- [ ] `src/components/layout/AccountSwitcher.test.tsx` — renders accounts; clicking triggers switch API call; loading state shown during switch; `router.refresh` called after
- [ ] `src/components/charts/CommitChart.test.tsx` — renders with data; shows empty state when data is `[]`; shows loading skeleton when `isLoading`

**E2E tests** (`tests/e2e/`)
- [ ] `auth.spec.ts`:
  - Register with email + password; verify dashboard redirect
  - Log in with same credentials; verify dashboard loads
  - Visit `/dashboard` logged out; verify redirect to `/login`
- [ ] `github-accounts.spec.ts` (use GitHub OAuth mock):
  - Connect a GitHub account; verify it appears in AccountSwitcher
  - Switch to second account; verify dashboard scope changes
  - Disconnect an account; verify it disappears from switcher
- [ ] `dashboard.spec.ts`:
  - Dashboard loads with seed data; commit chart visible
  - POST mock webhook via API; verify chart data updates within 3s (no page refresh)
  - Toggle repo tracking off; verify repo no longer in dashboard

**Step 14 verification**
- [x] `docker compose up -d postgres-test && npm test` — all unit + integration tests pass (48/48 integration tests)
- [ ] `npm run test:coverage` — coverage report shows ≥80% lines
- [ ] `npm run test:e2e` (with `npm run dev` running) — all E2E tests pass

---

### Step 15 — CI/CD `(est. 1h)`

**CI workflow**
- [ ] `.github/workflows/ci.yml`:
  ```yaml
  on: [push, pull_request]
  jobs:
    ci:
      services:
        postgres-test:
          image: postgres:16
          env: { POSTGRES_DB: devpulse_test, POSTGRES_PASSWORD: test }
          ports: ['5433:5432']
      steps:
        - checkout
        - setup-node (Node 20)
        - npm ci
        - npx prisma generate
        - npx prisma migrate deploy (against test DB)
        - npm run lint
        - npm run typecheck
        - npm test
        - npm run build
  ```
- [ ] `.github/workflows/deploy.yml`:
  ```yaml
  on:
    push:
      branches: [main]
  jobs:
    deploy:
      needs: ci
      steps:
        - (all CI steps)
        - npm run test:e2e (against staging)
        - rsync / docker build + push to VPS
  ```
- [ ] All required secrets documented in `.env.example` with `# CI: set in GitHub repo secrets` comment
- [ ] `README.md` — created with: Quick Start (clone → env → docker → migrate → seed → dev), API docs summary, architecture diagram link, local webhook setup (ngrok), running tests

**Step 15 verification**
- [ ] Push a branch to GitHub; verify CI workflow runs and all steps pass (green checkmarks)
- [ ] Merge to `main`; verify deploy workflow triggers
- [ ] `README.md` readable and Quick Start instructions work end-to-end on a fresh clone

---

## 4. Scope Boundaries

### 4.1 What IS included (in scope)

- Email/password authentication and GitHub OAuth login
- Connecting multiple GitHub accounts per user (max 10)
- Tracking up to 30 repositories per GitHub account
- Metrics: COMMIT_COUNT, PR_OPENED, PR_MERGED, PR_CLOSED, REVIEW_COUNT, COMMENT_COUNT
- Real-time dashboard updates via webhooks + SSE
- Three-layer reliability: webhooks + DB queue + reconciliation
- Date range and metric type filtering on per-repo detail page
- AccountSwitcher to change active GitHub account
- Background worker (persistent Node.js process)
- Encrypted token storage (AES-256-GCM)
- Webhook HMAC-SHA256 validation + replay protection
- CI/CD pipeline (GitHub Actions)
- Docker-based test database
- Seed data for development
- Unit, integration, and E2E tests (>80% coverage target)

### 4.2 What is NOT included (out of scope)

| Feature | Reason out of scope |
|---------|---------------------|
| Mobile application | Web-only for v1 |
| GitHub Enterprise / GHES | OAuth flow differs; deferred to v2 |
| Multi-tenant / team views | Single-user dashboard only |
| Billing or subscription management | Internal tool; no monetisation |
| Email notifications (e.g. "you passed 100 commits this week") | Not in requirements |
| Self-service password reset / forgot password flow | Deferred; admin resets only |
| Custom metric types (user-defined) | Fixed set of 6 metric types |
| Issue tracking metrics (GitHub Issues) | Commits, PRs, and reviews only |
| GitHub Actions / CI metrics | Out of v1 scope |
| Public API for external consumers | Internal tool only |
| CSV / PDF metric export | Not required |
| Dark mode UI | Single theme only |
| Internationalisation (i18n) | English only |
| GraphQL API | REST only |
| Real-time collaboration (multiple users on same screen) | Single-user sessions |
| Caching layer (Redis) | PostgreSQL queries are sufficient at this scale |
| Horizontal scaling / load balancing | Single-process Node.js is sufficient for internal use |

---

## 5. Success Criteria

### 5.1 Automated Verification (must all pass before the project is considered complete)

| Check | Command | Pass Condition |
|-------|---------|----------------|
| TypeScript | `npm run typecheck` | Zero errors |
| Lint | `npm run lint` | Zero warnings |
| Unit tests | `npm test -- --testPathPattern=tests/unit` | All pass |
| Integration tests | `docker compose up -d postgres-test && npm test -- --testPathPattern=tests/integration` | All pass |
| E2E tests | `npm run test:e2e` | All pass |
| Coverage | `npm run test:coverage` | ≥ 80% lines |
| Production build | `npm run build` | No build errors |

### 5.2 Manual Acceptance Criteria (verify against user stories)

| User Story | Manual Test |
|------------|-------------|
| US-01 Register | Create a new account at `/register`; verify redirect to dashboard; verify bcrypt hash in DB |
| US-02 Email login | Log in with registered credentials; verify JWT session; log out and verify redirect |
| US-03 GitHub OAuth login | Click "Continue with GitHub"; verify `GitHubAccount` row created; verify `activeAccountId` set in session |
| US-04 Connect additional account | Connect a second GitHub account; verify it appears in AccountSwitcher |
| US-05 Switch account | Switch active account; verify dashboard repos change; verify session `activeAccountId` updated |
| US-06 Disconnect account | Disconnect a non-active account; verify webhook deleted on GitHub; verify cascade delete in DB |
| US-07 Toggle repo tracking | Toggle a repo off; verify webhook removed from GitHub; toggle on; verify webhook re-registered |
| US-08 Connect repo | Submit `owner/repo`; verify webhook registered; verify "Syncing…" shown; verify metrics appear after sync |
| US-09 Dashboard metrics | View dashboard; verify commits, PRs, reviews shown; verify scoped to active account |
| US-10 Date range filter | Change date range on repo detail; verify chart data changes accordingly |
| US-11 Real-time update | Simulate a `push` webhook POST; verify dashboard updates within 3 seconds without page refresh |
| US-12 Webhook durability | Insert a `PENDING` WebhookEvent directly in DB; restart worker; verify it gets processed |
| US-13 Reconciliation | Set a repo's `lastSyncedAt` to 40 min ago; wait for next worker cycle; verify `lastSyncedAt` updated |

### 5.3 Security Audit Checks

| Check | How to verify |
|-------|--------------|
| Tokens never in logs | `grep -r "accessToken" logs/ \| grep -v '"accessToken":"[REDACTED]"'` returns empty |
| Webhook forgery rejected | POST `/api/webhooks/github` with wrong HMAC → 401 |
| Replay rejected | POST same `X-GitHub-Delivery` twice → 409 on second |
| Ownership enforced | Attempt `GET /api/github-accounts/:id` with another user's `accountId` → 404 |
| ENCRYPTION_KEY rotation | Change key → old encrypted tokens fail to decrypt gracefully |

### 5.4 Grading Rubric Mapping

| Criterion | Points | Where satisfied |
|-----------|--------|----------------|
| Specification quality | 10 | This `SPEC.md`: 5 sections, scope boundaries, acceptance criteria |
| Code quality & organisation | 15 | CLAUDE.md conventions; TypeScript strict; ESLint; Prettier; repo pattern |
| Test coverage & quality | 15 | Unit + integration + E2E; ≥80% coverage; edge cases in §5.2 |
| Database design | 10 | 6 models; migrations; `prisma/seed.ts` with demo data |
| Frontend implementation | 10 | 15+ components; Tailwind; loading/error states on every data fetch |
| Production readiness | 10 | CI/CD (GitHub Actions); error handling; security audit (§5.3) |
| MCP integration | 10 | GitHub MCP server in `client.ts`; drives repo listing, commits, PRs, reviews |
| Effective Claude Code usage | 10 | Plan mode used; CRISP prompts; 3 custom commands in `.claude/commands/` |
| Documentation | 10 | `README.md` (Quick Start, API docs, architecture); `SPEC.md`; `CLAUDE.md` |

---

*Last updated: 2026-04-24*  
*Specification owner: Praveen Kumar Srinivasan*
