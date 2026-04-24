'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { MetricDTO } from '@/types'
import type { MetricType } from '@prisma/client'
import { formatMetricValue } from '@/lib/utils'

type MetricsChartProps = {
  data: MetricDTO[]
  type: MetricType
  isLoading?: boolean
}

function Skeleton() {
  return <div className="h-64 w-full animate-pulse rounded bg-gray-100" />
}

export default function MetricsChart({ data, type, isLoading }: MetricsChartProps) {
  if (isLoading) return <Skeleton />

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300">
        <p className="text-sm text-gray-400">No data for the selected range</p>
      </div>
    )
  }

  const chartData = data.map((m) => ({
    date: m.recordedAt,
    value: m.value,
  }))

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickFormatter={(v: string) =>
            new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })
          }
        />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
        <Tooltip
          labelFormatter={(v: string) => new Date(v).toLocaleDateString()}
          formatter={(v: number) => [formatMetricValue(type, v), '']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#4f46e5"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
