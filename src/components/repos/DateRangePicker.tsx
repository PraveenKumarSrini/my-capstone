'use client'

type DateRangePickerProps = {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

export default function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const handleFrom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = e.target.value
    if (newFrom <= to) onChange(newFrom, to)
  }

  const handleTo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = e.target.value
    if (newTo >= from) onChange(from, newTo)
  }

  return (
    <div className="flex items-center gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
        <input
          type="date"
          value={from}
          onChange={handleFrom}
          max={to}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
        <input
          type="date"
          value={to}
          onChange={handleTo}
          min={from}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  )
}
