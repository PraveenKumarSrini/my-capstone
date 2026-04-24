type MetricCardProps = {
  label: string
  value: number | string
  delta?: string
  icon: React.ReactNode
  isLoading?: boolean
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 animate-pulse">
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="mt-3 h-8 w-16 rounded bg-gray-200" />
    </div>
  )
}

export default function MetricCard({ label, value, delta, icon, isLoading }: MetricCardProps) {
  if (isLoading) return <SkeletonCard />

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {delta && (
        <p className={`mt-1 text-xs font-medium ${delta.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
          {delta} vs last period
        </p>
      )}
    </div>
  )
}
