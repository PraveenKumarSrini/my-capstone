'use client'

import type { MetricType } from '@prisma/client'

type MetricTypeSelectorProps = {
  selected: MetricType
  onChange: (type: MetricType) => void
}

const METRIC_TYPES: { value: MetricType; label: string }[] = [
  { value: 'COMMIT_COUNT', label: 'Commits' },
  { value: 'PR_OPENED', label: 'PRs Opened' },
  { value: 'PR_MERGED', label: 'PRs Merged' },
  { value: 'PR_CLOSED', label: 'PRs Closed' },
  { value: 'REVIEW_COUNT', label: 'Reviews' },
  { value: 'COMMENT_COUNT', label: 'Comments' },
]

export default function MetricTypeSelector({ selected, onChange }: MetricTypeSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Metric</label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value as MetricType)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {METRIC_TYPES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
