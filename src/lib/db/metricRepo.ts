import { Prisma, type Metric, type MetricType } from '@prisma/client'
import prisma from '@/lib/db'
import type { AggregatedMetric } from '@/types'

export async function insertMetric(data: {
  repoId: string
  type: MetricType
  value: number
  recordedAt: Date
  metadata?: Record<string, unknown>
}): Promise<Metric> {
  return prisma.metric.create({
    data: {
      ...data,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function getMetrics(params: {
  repoId: string
  type: MetricType
  from: Date
  to: Date
}): Promise<Metric[]> {
  return prisma.metric.findMany({
    where: {
      repoId: params.repoId,
      type: params.type,
      recordedAt: { gte: params.from, lte: params.to },
    },
    orderBy: { recordedAt: 'asc' },
  })
}

export async function getAggregatedMetrics(
  accountId: string,
  from: Date,
  to: Date
): Promise<AggregatedMetric[]> {
  const rows = await prisma.metric.groupBy({
    by: ['repoId', 'type'],
    where: {
      repo: { githubAccountId: accountId, isTracked: true },
      recordedAt: { gte: from, lte: to },
    },
    _sum: { value: true },
  })

  return rows.map((r) => ({
    repoId: r.repoId,
    type: r.type,
    total: r._sum.value ?? 0,
  }))
}

export async function getRecentActivity(
  accountId: string,
  limit = 20
): Promise<
  Array<{
    repoId: string
    repoFullName: string
    type: MetricType
    value: number
    recordedAt: Date
  }>
> {
  const metrics = await prisma.metric.findMany({
    where: { repo: { githubAccountId: accountId, isTracked: true } },
    include: { repo: { select: { fullName: true } } },
    orderBy: { recordedAt: 'desc' },
    take: limit,
  })

  return metrics.map((m) => ({
    repoId: m.repoId,
    repoFullName: m.repo.fullName,
    type: m.type,
    value: m.value,
    recordedAt: m.recordedAt,
  }))
}
