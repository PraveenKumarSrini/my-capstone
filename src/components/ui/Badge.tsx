type BadgeProps = {
  variant?: 'success' | 'warning' | 'error' | 'neutral'
  children: React.ReactNode
}

const variantMap = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-700',
}

export default function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantMap[variant]}`}
    >
      {children}
    </span>
  )
}
