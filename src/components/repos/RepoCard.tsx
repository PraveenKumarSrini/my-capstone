import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { timeAgo } from '@/lib/utils'
import type { RepositoryDTO } from '@/types'

type RepoCardProps = {
  repo: RepositoryDTO
  onToggleTrack: (repoId: string, isTracked: boolean) => Promise<void>
  isUpdating: boolean
}

const webhookBadge: Record<RepositoryDTO['webhookStatus'], { variant: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
  active: { variant: 'success', label: 'Webhook active' },
  missing: { variant: 'warning', label: 'Webhook missing' },
  unregistered: { variant: 'neutral', label: 'No webhook' },
}

export default function RepoCard({ repo, onToggleTrack, isUpdating }: RepoCardProps) {
  const wb = webhookBadge[repo.webhookStatus]

  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{repo.fullName}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={wb.variant}>{wb.label}</Badge>
          <span className="text-xs text-gray-400">
            {repo.lastSyncedAt
              ? `Synced ${timeAgo(new Date(repo.lastSyncedAt))}`
              : 'Not yet synced'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={repo.isTracked ? 'success' : 'neutral'}>
          {repo.isTracked ? 'Tracked' : 'Untracked'}
        </Badge>
        <Button
          variant={repo.isTracked ? 'danger' : 'secondary'}
          size="sm"
          isLoading={isUpdating}
          onClick={() => onToggleTrack(repo.id, !repo.isTracked)}
        >
          {repo.isTracked ? 'Untrack' : 'Track'}
        </Button>
      </div>
    </div>
  )
}
