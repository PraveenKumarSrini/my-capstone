# CLAUDE.md — DevPulse Developer Analytics Dashboard

> This file is the single source of truth for Claude Code working in this codebase.
> Read it fully before making any changes. Update it when architectural decisions change.

---

## Quick Reference

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run dev:worker       # Start background job worker

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
npx prisma studio        # Open DB GUI at localhost:5555
docker compose up -d postgres-test  # Spin up test DB

# GitHub MCP
npx @anthropic-ai/claude-code --mcp github   # Claude Code with GitHub MCP server
```

---

## Project Overview

**DevPulse** is an internal developer analytics dashboard. It aggregates GitHub activity (commits, PRs, reviews) across multiple GitHub accounts and repositories per user, presenting metrics through a real-time dashboard.

### Key Domain Concepts
- **User**: A DevPulse account (email + password or OAuth)
- **GitHubAccount**: A GitHub identity connected to a User (one user → many GitHub accounts)
- **Repository**: A GitHub repo tracked under a GitHubAccount (one GitHubAccount → many repos)
- **Metric**: A time-series data point captured for a Repository (commits, PRs, reviews, etc.)
- **ActiveAccount**: The currently selected GitHubAccount context for a User session

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Next.js 14 (App Router), TypeScript 5 |
| Styling | Tailwind CSS v3 only |
| Charts | Recharts |
| Backend | Next.js API Routes (Edge-compatible where noted) |
| ORM | Prisma 5 + PostgreSQL 16 |
| Auth | NextAuth v5 (JWT sessions) |
| GitHub Data | GitHub MCP server via Claude Code |
| Testing | Jest (unit/integration), Playwright (e2e) |
| CI/CD | GitHub Actions |
| Logger | `src/lib/logger.ts` (structured JSON) |

---

## Architecture

```
devpulse/
├── src/
│   ├── app/
│   │   ├── (auth)/                  # Login, register, onboarding pages
│   │   ├── (dashboard)/             # Protected dashboard routes
│   │   │   ├── page.tsx             # Main dashboard view
│   │   │   ├── settings/            # User + GitHub account settings
│   │   │   └── repos/               # Repo detail pages
│   │   └── api/
│   │       ├── auth/                # NextAuth handlers
│   │       ├── github-accounts/     # GitHub account CRUD
│   │       │   ├── route.ts         # GET (list), POST (connect new)
│   │       │   └── [accountId]/
│   │       │       ├── route.ts     # GET, PATCH, DELETE
│   │       │       └── switch/route.ts  # POST — switch active account
│   │       ├── repos/
│   │       │   ├── route.ts         # GET (list repos for active account)
│   │       │   └── [repoId]/
│   │       │       └── metrics/route.ts  # GET metrics with ?from=&to=
│   │       └── dashboard/
│   │           └── route.ts         # GET aggregated team metrics
│   ├── components/
│   │   ├── charts/                  # Recharts wrappers (CommitChart, PRChart, etc.)
│   │   ├── layout/                  # Shell, Sidebar, Header, AccountSwitcher
│   │   ├── repos/                   # RepoSelector, RepoCard, ActivityFeed
│   │   └── ui/                      # Primitives: Button, Badge, Modal, Spinner
│   ├── lib/
│   │   ├── auth.ts                  # NextAuth config, session helpers
│   │   ├── github/
│   │   │   ├── client.ts            # Octokit factory — creates client per GitHubAccount
│   │   │   ├── metrics.ts           # Fetch + transform raw GitHub data → Metric shape
│   │   │   └── sync.ts              # Background sync job logic
│   │   ├── db.ts                    # Prisma client singleton
│   │   ├── logger.ts                # Pino structured logger
│   │   └── utils.ts                 # General utilities (date ranges, formatters)
│   ├── hooks/                       # Client-side React hooks
│   │   ├── useActiveAccount.ts      # Read/set active GitHub account from session
│   │   ├── useMetrics.ts            # SWR hook for metrics data
│   │   └── useRepos.ts              # SWR hook for repos list
│   └── types/
│       └── index.ts                 # Shared TypeScript types and Zod schemas
├── prisma/
│   ├── schema.prisma                # Source of truth for DB schema
│   └── migrations/                  # Never edit migrations manually
├── tests/
│   ├── unit/                        # Pure function tests
│   ├── integration/                 # API route tests with test DB
│   └── e2e/                         # Playwright browser tests
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Test → Lint → Typecheck → Build
│       └── deploy.yml               # On main merge: build + deploy
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
  id           String       @id @default(cuid())
  userId       String
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  githubLogin  String       // GitHub username for this account
  accessToken  String       // Encrypted — never log or expose
  displayName  String?      // Optional friendly label (e.g. "Work", "Personal")
  repos        Repository[]
  createdAt    DateTime     @default(now())

  @@unique([userId, githubLogin])
}

model Repository {
  id              String        @id @default(cuid())
  githubAccountId String
  githubAccount   GitHubAccount @relation(fields: [githubAccountId], references: [id], onDelete: Cascade)
  fullName        String        // "owner/repo"
  isTracked       Boolean       @default(true)
  metrics         Metric[]
  lastSyncedAt    DateTime?
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

enum MetricType {
  COMMIT_COUNT
  PR_OPENED
  PR_MERGED
  PR_CLOSED
  REVIEW_COUNT
  COMMENT_COUNT
}
```

---

## Multi-GitHub-Account Design

This is a core feature. One User can connect multiple GitHub accounts (personal, work, OSS org, etc.).

### Rules
1. Every API call that touches GitHub data **must** receive a `githubAccountId`. Never assume the "default" account.
2. The active account is stored in the user's session as `session.user.activeAccountId`.
3. Account switching calls `POST /api/github-accounts/[accountId]/switch` — it updates `User.activeAccountId` and refreshes the session.
4. `src/lib/github/client.ts` exports `getOctokitForAccount(accountId)` — always use this factory, never instantiate Octokit directly.
5. Access tokens are encrypted at rest using `src/lib/crypto.ts`. Never store or log raw tokens.
6. When listing repos, always scope to the currently active `GitHubAccount`, not the whole User.

### AccountSwitcher Component
- Lives in `src/components/layout/AccountSwitcher.tsx`
- Displays all connected GitHub accounts with avatars
- On select: calls the switch endpoint, then `router.refresh()`
- Shows a loading state during switch — do not allow repo interaction mid-switch

---

## API Contract

All API responses follow this envelope:

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string, code?: string }
```

Never return raw data without the envelope. Never throw unhandled errors from API routes — always catch and return `{ success: false, error: "..." }`.

### Key Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/github-accounts` | List all GitHub accounts for the current user |
| POST | `/api/github-accounts` | Connect a new GitHub account (OAuth flow) |
| GET | `/api/github-accounts/:accountId` | Get single account details |
| DELETE | `/api/github-accounts/:accountId` | Disconnect a GitHub account |
| POST | `/api/github-accounts/:accountId/switch` | Set as active account |
| GET | `/api/repos` | List repos for active GitHub account |
| POST | `/api/repos/connect` | Start tracking a new repo |
| GET | `/api/repos/:repoId/metrics` | Fetch metrics (`?from=ISO&to=ISO&type=COMMIT_COUNT`) |
| GET | `/api/dashboard` | Aggregated metrics for all tracked repos in active account |
| GET | `/api/auth/[...nextauth]` | NextAuth handlers |

---

## Code Style & Conventions

### TypeScript
- Strict mode enabled. Fix type errors — do not use `any` or `@ts-ignore`
- Always add explicit return types to exported functions
- Use Zod schemas in `src/types/index.ts` for all external input validation (API request bodies, env vars)
- Prefer `type` over `interface` unless declaration merging is needed

### React / Next.js
- Functional components only — no class components
- Use `async/await` — never `.then()` chains
- Server Components by default; add `'use client'` only when needed (event handlers, hooks, browser APIs)
- 2-space indentation, single quotes, no semicolons (Prettier enforced)
- Component files: PascalCase (`AccountSwitcher.tsx`)
- Utility files: camelCase (`githubClient.ts`)

### Logging
- Always use `src/lib/logger.ts` (Pino, structured JSON)
- Log levels: `logger.info`, `logger.warn`, `logger.error`
- Never use `console.log`, `console.error`, etc.

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
- ❌ Log or expose raw GitHub access tokens under any circumstances
- ❌ Assume a default GitHub account — always require explicit `accountId`
- ❌ Modify `prisma/migrations/` manually — let Prisma CLI manage it
- ❌ Modify the NextAuth session shape without updating `src/types/index.ts` and all consumers
- ❌ Add API endpoints without the `{ success, data/error }` envelope
- ❌ Modify the auth flow without discussing with the team lead
- ❌ Use `.then()` chains — always `async/await`
- ❌ Commit with failing lint or type errors

---

## Testing

- **Unit tests**: Pure functions, utilities, data transformers — in `tests/unit/`
- **Integration tests**: API routes using test DB — in `tests/integration/`
- **E2E tests**: Critical user flows (connect GitHub account, switch account, view dashboard) — in `tests/e2e/`
- Test files for components are colocated: `AccountSwitcher.test.tsx` next to `AccountSwitcher.tsx`
- Mock GitHub API calls in tests — never hit real GitHub from tests
- Test DB requires: `docker compose up -d postgres-test`

---

## MCP Integration (GitHub)

Claude Code uses the GitHub MCP server for repo data operations.

```bash
# Run Claude Code with GitHub MCP enabled
npx @anthropic-ai/claude-code --mcp github
```

The MCP server handles:
- Listing repos for a given GitHub account
- Fetching commit history, PR lists, review data
- Pagination and rate limit management

The background sync job (`src/lib/github/sync.ts`) calls these via the GitHub client factory and writes normalized `Metric` records to the DB.

---

## Environment Variables

```bash
# Required
DATABASE_URL=                  # PostgreSQL connection string
NEXTAUTH_SECRET=               # Random 32-char string
NEXTAUTH_URL=                  # e.g. http://localhost:3000

# GitHub OAuth App (for connecting GitHub accounts)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Encryption (for storing access tokens at rest)
ENCRYPTION_KEY=                # 32-byte hex string

# Optional
LOG_LEVEL=info                 # debug | info | warn | error
SYNC_INTERVAL_MS=300000        # Default: 5 minutes
```

Never commit `.env` files. Use `.env.example` as the template.

---

## CI/CD Pipeline (GitHub Actions)

```
Push to PR branch:
  1. Lint (ESLint)
  2. Typecheck (tsc --noEmit)
  3. Unit + Integration tests (Jest)
  4. Build (next build)

Merge to main:
  1. All above
  2. E2E tests (Playwright, staging env)
  3. Deploy to production
```

All steps must pass before merge. No exceptions.

---

## Known Issues & Gotchas

- **Prisma client**: Always run `npx prisma generate` after any `schema.prisma` change or you'll get type errors at runtime
- **Test DB**: Must be running (`docker compose up -d postgres-test`) before `npm test`
- **GitHub rate limits**: The GitHub client respects rate limit headers. If metrics are stale, check sync job logs first
- **Account switching latency**: After `POST /api/github-accounts/:id/switch`, call `router.refresh()` to re-fetch server components — do not rely on stale client state
- **Token encryption**: `GitHubAccount.accessToken` is stored encrypted. Decrypt only in `src/lib/github/client.ts` — nowhere else

---

## Adding a New GitHub Account (Flow Reference)

1. User clicks "Connect GitHub Account" in `AccountSwitcher` or Settings
2. App redirects to GitHub OAuth with `scope=repo,read:user`
3. GitHub redirects back to `/api/auth/callback/github`
4. NextAuth callback creates a new `GitHubAccount` record (encrypted token)
5. If this is the user's first account, set it as `User.activeAccountId`
6. Redirect to dashboard — new account appears in switcher

---

*Last updated: 2026-04-24*
*Maintainer: Praveen Kumar Srinivasan*