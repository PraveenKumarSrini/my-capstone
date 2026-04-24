import Badge from '@/components/ui/Badge'
import { timeAgo } from '@/lib/utils'
import type { RepositoryDTO } from '@/types'

type RepoSyncStatusProps = {
  repo: RepositoryDTO
}

const webhookBadge: Record<RepositoryDTO['webhookStatus'], { variant: 'success' | 'warning' | 'neutral'; label: string }> = {
  active: { variant: 'success', label: 'Webhook active' },
  missing: { variant: 'warning', label: 'Webhook missing' },
  unregistered: { variant: 'neutral', label: 'No webhook' },
}

export default function RepoSyncStatus({ repo }: RepoSyncStatusProps) {
  const wb = webhookBadge[repo.webhookStatus]

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{repo.fullName}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {repo.lastSyncedAt
            ? `Last synced ${timeAgo(new Date(repo.lastSyncedAt))}`
            : 'Not yet synced'}
        </p>
      </div>
      <Badge variant={wb.variant}>{wb.label}</Badge>
    </div>
  )
}
