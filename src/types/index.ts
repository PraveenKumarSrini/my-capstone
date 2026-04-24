import type { DefaultSession } from 'next-auth'
import type { MetricType } from '@prisma/client'
import { z } from 'zod'

// ─── API envelope ──────────────────────────────────────────────────────────────

export type ApiSuccess<T> = { success: true; data: T }
export type ApiError = { success: false; error: string; code?: string }

// ─── Domain types (safe for API responses — no encrypted fields) ─────────────

export type GitHubAccountDTO = {
  id: string
  githubLogin: string
  avatarUrl: string | null
  displayName: string | null
  createdAt: string
}

export type RepositoryDTO = {
  id: string
  fullName: string
  isTracked: boolean
  lastSyncedAt: string | null
  webhookStatus: 'active' | 'missing' | 'unregistered'
}

export type MetricDTO = {
  id: string
  type: MetricType
  value: number
  recordedAt: string
  metadata: Record<string, unknown> | null
}

export type AggregatedMetric = {
  repoId: string
  type: MetricType
  total: number
}

export type DashboardData = {
  summary: {
    totalCommits: number
    totalPRsOpened: number
    totalPRsMerged: number
    totalReviews: number
  }
  commitTimeline: Array<{ date: string; count: number }>
  prTimeline: Array<{ date: string; opened: number; merged: number }>
  recentActivity: Array<{
    repoFullName: string
    type: MetricType
    value: number
    recordedAt: string
  }>
  repos: RepositoryDTO[]
}

// ─── SSE ─────────────────────────────────────────────────────────────────────

export type SSEEventType = 'metrics_updated' | 'heartbeat' | 'connected'

export type SSEEvent = {
  type: SSEEventType
  repoId?: string
  accountId?: string
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const ConnectRepoSchema = z.object({
  fullName: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'Must be in owner/repo format'),
})

export const MetricsQuerySchema = z.object({
  from: z.string().datetime({ message: 'from must be an ISO datetime' }),
  to: z.string().datetime({ message: 'to must be an ISO datetime' }),
  type: z.enum([
    'COMMIT_COUNT',
    'PR_OPENED',
    'PR_MERGED',
    'PR_CLOSED',
    'REVIEW_COUNT',
    'COMMENT_COUNT',
  ]),
})

export const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const PatchRepoSchema = z.object({
  isTracked: z.boolean(),
})

// ─── NextAuth type augmentation ───────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      activeAccountId: string | null
    } & DefaultSession['user']
  }
}


