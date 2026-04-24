# /add-feature — Scaffold a New Feature End-to-End

Scaffold a complete vertical slice: API route → React component → SWR hook → tests.
Run this command with the feature name as the argument, e.g. `/add-feature repo-labels`.

---

## Inputs

The user must provide:
- **Feature name** — kebab-case identifier (e.g. `repo-labels`, `team-summary`)
- **HTTP method(s)** — which verbs the API route handles (`GET`, `POST`, `PATCH`, `DELETE`)
- **Route path** — where it lives under `src/app/api/` (e.g. `repos/[repoId]/labels`)
- **Component type** — page section, card, modal, or form
- **Auth requirement** — protected (default) or public

Ask for any missing inputs before proceeding.

---

## Step 1 — Zod schema in `src/types/index.ts`

Add request and response schemas for the new feature.

Rules:
- Use Zod for all input validation (`z.object({ ... })`)
- Export a `<FeatureName>Schema` for request body validation
- Export a `<FeatureName>DTO` TypeScript type for response shape
- Never use `any` — derive types with `z.infer<>`

Example:
```typescript
export const CreateLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
})
export type CreateLabelDTO = z.infer<typeof CreateLabelSchema>
```

---

## Step 2 — DB repository function (if DB access needed)

Add query/mutation functions to the appropriate file in `src/lib/db/`:

| Data domain | File |
|---|---|
| Users | `src/lib/db/userRepo.ts` |
| GitHub accounts | `src/lib/db/accountRepo.ts` |
| Repositories | `src/lib/db/repoRepo.ts` |
| Metrics | `src/lib/db/metricRepo.ts` |
| Webhook events | `src/lib/db/webhookEventRepo.ts` |

Rules:
- Never call `prisma` directly in a route — always via a repo function
- Multi-table writes must use `prisma.$transaction([...])`
- Add explicit return types to exported functions

---

## Step 3 — API route

Create `src/app/api/<route-path>/route.ts`.

Template for a protected route:
```typescript
import { requireAuth, apiSuccess, apiError, handleApiError } from '@/lib/api'
import { <FeatureName>Schema } from '@/types'
import logger from '@/lib/logger'

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAuth()

    const body = await request.json()
    const parsed = <FeatureName>Schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    // TODO: business logic via repo functions

    logger.info({ userId: session.user.id }, '<feature> created')
    return apiSuccess(result, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
```

Rules:
- Always use the `{ success, data/error }` envelope via `apiSuccess` / `apiError`
- Always call `requireAuth()` first on protected routes
- For `:accountId` or `:repoId` routes, call `requireOwnership` / `requireRepoOwnership`
- Ownership failures return `404` (not `403`) to prevent enumeration
- Never decrypt tokens — use `getOctokitForAccount` from `src/lib/github/client.ts`

---

## Step 4 — SWR hook (if the feature has a GET endpoint)

Create `src/hooks/use<FeatureName>.ts`:

```typescript
'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function use<FeatureName>(param: string) {
  const { data, error, isLoading, mutate } = useSWR(
    param ? `/api/<route-path>/${param}` : null,
    fetcher
  )
  return {
    data: data?.data ?? null,
    error: data?.error ?? error?.message ?? null,
    isLoading,
    mutate,
  }
}
```

Rules:
- Use SWR — never `useEffect` + `fetch`
- Pass `null` as the key when the required param is missing (suppresses the request)
- Return `data`, `error`, `isLoading`, `mutate` — callers need all four

---

## Step 5 — React component

Create `src/components/<domain>/<FeatureName>.tsx`.

Rules:
- Functional component only — no class components
- `'use client'` only if the component uses hooks, event handlers, or browser APIs
- Server Component by default
- Use the SWR hook from Step 4 for data fetching
- Handle all three states: loading (show `<Spinner />`), error (show error message), data
- Tailwind CSS only — no inline styles, no other CSS frameworks
- Use existing UI primitives from `src/components/ui/` (`Button`, `Badge`, `Modal`, `Spinner`, `ErrorBoundary`)

---

## Step 6 — Unit test

Create `src/components/<domain>/<FeatureName>.test.tsx` (colocated):

```typescript
import { render, screen } from '@testing-library/react'
import { <FeatureName> } from './<FeatureName>'

jest.mock('@/hooks/use<FeatureName>', () => ({
  use<FeatureName>: jest.fn(),
}))

describe('<FeatureName>', () => {
  it('renders loading state', () => { ... })
  it('renders error state', () => { ... })
  it('renders data correctly', () => { ... })
})
```

Rules:
- Mock SWR hooks — never make real API calls in unit tests
- Cover: loading, error, and success render paths
- Cover any user interactions (clicks, form submits) with `userEvent`

---

## Step 7 — Integration test

Create `tests/integration/<feature-name>.test.ts`:

```typescript
describe('POST /api/<route-path>', () => {
  it('returns 401 when unauthenticated', async () => { ... })
  it('returns 400 on invalid input', async () => { ... })
  it('returns 404 when resource not found or not owned', async () => { ... })
  it('returns 201 with correct shape on success', async () => { ... })
})
```

Rules:
- Use the test DB (`DATABASE_URL` pointing to port 5433)
- Never mock the DB — tests must hit real Prisma queries
- Mock GitHub API calls (never hit real GitHub from tests)
- Test the ownership check: create a resource under user A, attempt access as user B → expect 404

---

## Step 8 — Wire up the component

Add the component to the appropriate page or layout:
- Dashboard sections: `src/app/(dashboard)/page.tsx`
- Settings: `src/app/(dashboard)/settings/page.tsx`
- Repo detail: `src/app/(dashboard)/repos/[repoId]/page.tsx`

---

## Step 9 — Verify

Run the full quality gate:

```bash
npm run lint && npm run typecheck && npm test
```

All three must pass before the feature is considered done.
Fix any type errors or lint warnings introduced by the new code.

---

## Checklist

```
[ ] Zod schema + DTO type added to src/types/index.ts
[ ] DB repo function added (if needed)
[ ] API route created with auth + ownership checks
[ ] Response uses { success, data } envelope
[ ] SWR hook created (if GET endpoint)
[ ] React component created (loading / error / data states)
[ ] Unit test colocated with component
[ ] Integration test in tests/integration/
[ ] Component wired into a page
[ ] lint + typecheck + tests all pass
```
