# DevPulse API Reference

All endpoints are served from the Next.js app server (default `http://localhost:3000`).

## Response Envelope

Every response — success or failure — uses this shape:

```json
{ "success": true, "data": <T> }
{ "success": false, "error": "Human-readable message", "code": "MACHINE_CODE" }
```

HTTP status codes follow REST conventions (`200`, `201`, `400`, `401`, `404`, `409`, `500`).

## Authentication

All endpoints except `POST /api/auth/register` and `POST /api/webhooks/github` require a valid NextAuth session. Include the session cookie (set automatically by the browser after login). API clients must call `POST /api/auth/signin` first or use the `credentials` provider directly.

---

## Auth

### Register

```
POST /api/auth/register
```

Creates a new DevPulse account with email + password.

**Request body**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "supersecret99"
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | string | 1–100 characters |
| `email` | string | valid email format |
| `password` | string | minimum 8 characters |

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "clxyz1234",
    "email": "jane@example.com",
    "name": "Jane Smith"
  }
}
```

**Errors**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | — | Validation failed |
| 409 | `EMAIL_EXISTS` | Email already registered |
| 500 | — | Server error |

---

### Sign In / Sign Out (NextAuth)

```
POST /api/auth/signin     (credentials or GitHub OAuth)
POST /api/auth/signout
GET  /api/auth/session
GET  /api/auth/csrf
GET  /api/auth/providers
GET  /api/auth/callback/github
```

These are standard NextAuth v5 routes. Use the NextAuth client (`signIn()`, `signOut()`) or redirect the user to the GitHub OAuth flow. The session JWT includes `user.id` and `user.activeAccountId`.

---

## GitHub Accounts

### List accounts

```
GET /api/github-accounts
```

Returns all GitHub accounts connected to the authenticated user.

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "clxyz1234",
      "githubLogin": "jane-personal",
      "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
      "displayName": "Personal",
      "createdAt": "2024-11-01T09:00:00.000Z"
    },
    {
      "id": "clxyz5678",
      "githubLogin": "jane-work",
      "avatarUrl": "https://avatars.githubusercontent.com/u/67890",
      "displayName": "Work",
      "createdAt": "2024-11-02T09:00:00.000Z"
    }
  ]
}
```

---

### Connect a GitHub account

```
POST /api/github-accounts
```

Manually connects a GitHub account using a Personal Access Token (PAT). In production, GitHub OAuth (`POST /api/auth/signin` with the GitHub provider) is the preferred path — it auto-creates the account without requiring this endpoint.

**Request body**

```json
{
  "accessToken": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "githubLogin": "jane-personal",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
  "displayName": "Personal"
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| `accessToken` | string | Required. GitHub PAT with `repo,read:user` scope. Encrypted at rest. |
| `githubLogin` | string | Required. GitHub username. |
| `avatarUrl` | string | Optional. Valid URL. |
| `displayName` | string | Optional. Friendly label (e.g. "Work"). |

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "clxyz1234",
    "githubLogin": "jane-personal",
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
    "displayName": "Personal",
    "createdAt": "2024-11-01T09:00:00.000Z"
  }
}
```

**Errors**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `MAX_ACCOUNTS` | User already has 10 GitHub accounts |
| 400 | — | Validation failed |
| 409 | `ALREADY_CONNECTED` | That GitHub login is already linked to this user |
| 500 | — | Server error |

**Side effects**
- `accessToken` is AES-256-GCM encrypted before storage — the raw token is never persisted
- If this is the user's first account, `User.activeAccountId` is set automatically

---

### Get a single account

```
GET /api/github-accounts/:accountId
```

**Response `200`** — same DTO as the list endpoint, single object.

**Errors**

| Status | Condition |
|--------|-----------|
| 401 | Not authenticated |
| 404 | Account not found or not owned by the authenticated user |

---

### Disconnect an account

```
DELETE /api/github-accounts/:accountId
```

Removes the GitHub account and cascades to all associated repositories, metrics, and webhook events. Also deletes webhooks registered on GitHub for this account's repositories.

**Response `200`**

```json
{
  "success": true,
  "data": { "deleted": true }
}
```

**Errors**

| Status | Code | Condition |
|--------|------|-----------|
| 404 | — | Account not found or not owned |
| 409 | `LAST_ACTIVE_ACCOUNT` | Cannot delete the only active account |

---

### Switch active account

```
POST /api/github-accounts/:accountId/switch
```

Sets the given account as the active GitHub account for the current user. All subsequent `/api/repos` and `/api/dashboard` calls operate in this account's context. Clients should call `router.refresh()` after this to re-fetch Server Components.

**Request body** — none

**Response `200`**

```json
{
  "success": true,
  "data": { "activeAccountId": "clxyz5678" }
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| 404 | Account not found or not owned |

---

## Repositories

### List repositories

```
GET /api/repos
```

Returns repositories tracked under the user's currently active GitHub account. Requires `activeAccountId` to be set (happens automatically when a GitHub account is connected).

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "clrepo1234",
      "fullName": "jane-personal/my-project",
      "isTracked": true,
      "lastSyncedAt": "2024-11-15T14:30:00.000Z",
      "webhookStatus": "active"
    },
    {
      "id": "clrepo5678",
      "fullName": "jane-personal/legacy-api",
      "isTracked": false,
      "lastSyncedAt": null,
      "webhookStatus": "unregistered"
    }
  ]
}
```

`webhookStatus` values:

| Value | Meaning |
|-------|---------|
| `active` | Webhook is registered on GitHub |
| `missing` | `webhookId` stored but webhook not found on GitHub |
| `unregistered` | No webhook registered (repo not tracked) |

---

### Connect a repository

```
POST /api/repos/connect
```

Starts tracking a repository under the active GitHub account. Registers a webhook on GitHub and triggers an async initial backfill (last 30 days of commits, PRs, reviews).

**Request body**

```json
{
  "fullName": "jane-personal/my-project"
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| `fullName` | string | Required. Format: `owner/repo`. Regex: `^[\w.-]+/[\w.-]+$` |

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "clrepo1234",
    "fullName": "jane-personal/my-project",
    "isTracked": true,
    "lastSyncedAt": null,
    "webhookStatus": "active"
  }
}
```

**Errors**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | — | Validation failed (bad `fullName` format) |
| 400 | `MAX_REPOS` | Active account already tracks 30 repositories |
| 404 | — | Repository not found on GitHub |
| 409 | `ALREADY_TRACKED` | Repository is already being tracked |
| 500 | — | Server error |

**Side effects**
- Registers a GitHub webhook (`push`, `pull_request`, `pull_request_review` events)
- Webhook registration failure with HTTP 422 (unroutable URL) is logged but does not fail the request
- Initial 30-day metrics backfill runs asynchronously (`setImmediate`) — does not block the response

---

### Discover repositories

```
GET /api/repos/discover?q=<optional-search-term>
```

Searches the active GitHub account's repositories via the GitHub MCP server. Powers the "Connect Repo" UI so users can browse instead of typing `owner/repo` manually.

**Query params**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Optional. Search term filtered to repo name. Omit to list all accessible repos. |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "fullName": "jane-personal/my-project",
      "description": "My awesome project",
      "language": "TypeScript",
      "isPrivate": false,
      "updatedAt": "2024-11-14T10:00:00.000Z",
      "htmlUrl": "https://github.com/jane-personal/my-project"
    }
  ]
}
```

---

### Get a single repository

```
GET /api/repos/:repoId
```

**Response `200`** — same RepositoryDTO as the list endpoint, single object.

**Errors**

| Status | Condition |
|--------|-----------|
| 404 | Repository not found or not owned by authenticated user |

---

### Update repository (toggle tracking)

```
PATCH /api/repos/:repoId
```

Enables or disables metric tracking for a repository.

**Request body**

```json
{ "isTracked": false }
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "clrepo1234",
    "fullName": "jane-personal/my-project",
    "isTracked": false,
    "lastSyncedAt": "2024-11-15T14:30:00.000Z",
    "webhookStatus": "unregistered"
  }
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| 400 | Validation failed |
| 404 | Repository not found or not owned |

**Side effects**
- `isTracked: false` — deletes the webhook from GitHub and clears `webhookId`
- `isTracked: true` — registers a new webhook on GitHub

---

### Get metrics for a repository

```
GET /api/repos/:repoId/metrics?from=<ISO8601>&to=<ISO8601>&type=<MetricType>
```

Fetches time-series metric data for a specific repository and metric type.

**Query params** (all required)

| Param | Type | Example |
|-------|------|---------|
| `from` | ISO 8601 datetime | `2024-10-01T00:00:00.000Z` |
| `to` | ISO 8601 datetime | `2024-11-01T00:00:00.000Z` |
| `type` | MetricType enum | `COMMIT_COUNT` |

Valid `MetricType` values:

| Value | Description |
|-------|-------------|
| `COMMIT_COUNT` | Number of commits pushed |
| `PR_OPENED` | Pull requests opened |
| `PR_MERGED` | Pull requests merged |
| `PR_CLOSED` | Pull requests closed without merging |
| `REVIEW_COUNT` | Code reviews submitted |
| `COMMENT_COUNT` | Issue/PR comments posted |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "clmetric1234",
      "type": "COMMIT_COUNT",
      "value": 7,
      "recordedAt": "2024-10-15T12:34:00.000Z",
      "metadata": {
        "from": "2024-10-15T00:00:00.000Z",
        "to": "2024-10-15T23:59:59.999Z"
      }
    }
  ]
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid query params |
| 404 | Repository not found or not owned |

---

## Dashboard

### Aggregated metrics

```
GET /api/dashboard?from=<ISO8601>&to=<ISO8601>
```

Returns aggregated metrics across all tracked repositories in the active GitHub account.

**Query params** (both optional)

| Param | Default | Description |
|-------|---------|-------------|
| `from` | 30 days ago | Start of date range |
| `to` | now | End of date range |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalCommits": 142,
      "totalPRsOpened": 23,
      "totalPRsMerged": 18,
      "totalReviews": 47
    },
    "commitTimeline": [],
    "prTimeline": [],
    "recentActivity": [
      {
        "repoFullName": "jane-personal/my-project",
        "type": "PR_MERGED",
        "value": 1,
        "recordedAt": "2024-11-15T14:32:00.000Z"
      },
      {
        "repoFullName": "jane-personal/legacy-api",
        "type": "COMMIT_COUNT",
        "value": 3,
        "recordedAt": "2024-11-15T13:10:00.000Z"
      }
    ],
    "repos": [
      {
        "id": "clrepo1234",
        "fullName": "jane-personal/my-project",
        "isTracked": true,
        "lastSyncedAt": "2024-11-15T14:30:00.000Z",
        "webhookStatus": "active"
      }
    ]
  }
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| 400 | `activeAccountId` not set |
| 500 | Server error |

---

## Webhooks

### Receive a GitHub webhook

```
POST /api/webhooks/github
```

This endpoint is called by GitHub, not by your application. Register this URL in GitHub webhook settings (or let `POST /api/repos/connect` do it automatically).

**Required headers**

| Header | Description |
|--------|-------------|
| `X-GitHub-Delivery` | UUID delivery identifier (prevents duplicate processing) |
| `X-GitHub-Event` | Event type: `push`, `pull_request`, or `pull_request_review` |
| `X-Hub-Signature-256` | HMAC-SHA256 of the raw request body, prefixed with `sha256=` |

**Request body** — raw JSON GitHub webhook payload

**Processing flow**
1. Validate all required headers
2. Parse payload — extract `repository.full_name` and `repository.id`
3. Look up the matching `Repository` record; return `404` if not found
4. Verify HMAC-SHA256 signature against per-account `webhookSecret` (constant-time compare); return `401` on mismatch
5. Check `deliveryId` uniqueness; return `409` if already processed
6. Persist `WebhookEvent` with status `PENDING`
7. Return `200` immediately (within 500 ms)
8. Process event asynchronously via `setImmediate` → write `Metric` → broadcast SSE

**Response `200`**

```json
{ "success": true }
```

**Errors**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | — | Missing required headers or invalid JSON |
| 401 | — | HMAC signature mismatch |
| 404 | — | Repository not found in DB |
| 409 | `DUPLICATE` | `X-GitHub-Delivery` already processed |

**Metrics written per event type**

| GitHub event | Action | MetricType written | Value |
|---|---|---|---|
| `push` | any | `COMMIT_COUNT` | number of commits in push |
| `pull_request` | `opened` | `PR_OPENED` | 1 |
| `pull_request` | `closed` + merged | `PR_MERGED` | 1 |
| `pull_request` | `closed` + not merged | `PR_CLOSED` | 1 |
| `pull_request_review` | `submitted` | `REVIEW_COUNT` | 1 |

---

## Server-Sent Events

### Metrics update stream

```
GET /api/sse/metrics
```

Opens a persistent SSE connection. The server pushes `metrics_updated` events whenever a webhook is processed, triggering the dashboard to re-fetch via SWR.

**Response headers**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event stream**

On connection:

```
event: connected
data: {"accountId":"clxyz1234"}
```

When a webhook is processed for any repo in the active account:

```
event: metrics_updated
data: {"type":"metrics_updated","repoId":"clrepo1234","accountId":"clxyz1234"}
```

**Notes**
- Requires an authenticated session with `activeAccountId` set
- The client (`useSSE.ts`) calls `swr.mutate()` on each `metrics_updated` event
- Subscriptions are stored in an in-memory `Map<accountId, Set<ReadableStreamController>>` — cleaned up on client disconnect
- EventSource reconnects automatically; no special client logic required

---

## Error Codes Reference

| Code | Typical HTTP | Meaning |
|------|-------------|---------|
| `EMAIL_EXISTS` | 409 | Email already registered |
| `ALREADY_CONNECTED` | 409 | GitHub account already linked to this user |
| `LAST_ACTIVE_ACCOUNT` | 409 | Cannot delete the only active account |
| `MAX_ACCOUNTS` | 400 | User already has 10 GitHub accounts |
| `ALREADY_TRACKED` | 409 | Repository already being tracked |
| `MAX_REPOS` | 400 | Account already tracks 30 repositories |
| `DUPLICATE` | 409 | Webhook delivery already processed |

All other errors return a descriptive `error` string without a machine `code`.

---

## Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | — | Create account |
| `GET` | `/api/github-accounts` | Session | List GitHub accounts |
| `POST` | `/api/github-accounts` | Session | Connect GitHub account |
| `GET` | `/api/github-accounts/:id` | Session | Get account |
| `DELETE` | `/api/github-accounts/:id` | Session | Disconnect account |
| `POST` | `/api/github-accounts/:id/switch` | Session | Set active account |
| `GET` | `/api/repos` | Session | List repos (active account) |
| `POST` | `/api/repos/connect` | Session | Connect + track a repo |
| `GET` | `/api/repos/discover` | Session | Search GitHub repos via MCP |
| `GET` | `/api/repos/:id` | Session | Get repo |
| `PATCH` | `/api/repos/:id` | Session | Toggle `isTracked` |
| `GET` | `/api/repos/:id/metrics` | Session | Fetch time-series metrics |
| `GET` | `/api/dashboard` | Session | Aggregated dashboard data |
| `POST` | `/api/webhooks/github` | HMAC | Receive GitHub webhook |
| `GET` | `/api/sse/metrics` | Session | SSE live update stream |
