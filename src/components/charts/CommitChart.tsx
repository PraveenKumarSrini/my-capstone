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
import type { DashboardData } from '@/types'

type CommitChartProps = {
  data: DashboardData['commitTimeline']
  isLoading?: boolean
}

function Skeleton() {
  return (
    <div className="h-64 w-full animate-pulse rounded bg-gray-100" />
  )
}

export default function CommitChart({ data, isLoading }: CommitChartProps) {
  if (isLoading) return <Skeleton />

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300">
        <p className="text-sm text-gray-400">No commit data for this period</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickFormatter={(v: string) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
        <Tooltip
          labelFormatter={(v: string) => new Date(v).toLocaleDateString()}
          formatter={(v: number) => [v, 'Commits']}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#4f46e5"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
