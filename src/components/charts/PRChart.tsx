'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { DashboardData } from '@/types'

type PRChartProps = {
  data: DashboardData['prTimeline']
  isLoading?: boolean
}

function Skeleton() {
  return <div className="h-64 w-full animate-pulse rounded bg-gray-100" />
}

export default function PRChart({ data, isLoading }: PRChartProps) {
  if (isLoading) return <Skeleton />

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300">
        <p className="text-sm text-gray-400">No PR data for this period</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickFormatter={(v: string) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
        <Tooltip labelFormatter={(v: string) => new Date(v).toLocaleDateString()} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="opened" name="Opened" fill="#6366f1" stackId="a" />
        <Bar dataKey="merged" name="Merged" fill="#22c55e" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  )
}
