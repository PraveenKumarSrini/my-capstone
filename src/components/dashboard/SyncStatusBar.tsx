import { timeAgo } from '@/lib/utils'

type SyncStatusBarProps = {
  lastSyncedAt: string | null
  sseStatus: 'connecting' | 'connected' | 'error'
}

export default function SyncStatusBar({ lastSyncedAt, sseStatus }: SyncStatusBarProps) {
  const statusDot = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-400 animate-pulse',
    error: 'bg-red-500',
  }[sseStatus]

  const statusLabel = {
    connected: 'Live',
    connecting: 'Connecting…',
    error: 'Disconnected',
  }[sseStatus]

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${statusDot}`} />
        <span className="text-sm text-gray-600">{statusLabel}</span>
      </div>
      <p className="text-xs text-gray-400">
        {lastSyncedAt
          ? `Last synced ${timeAgo(new Date(lastSyncedAt))}`
          : 'Not yet synced'}
      </p>
    </div>
  )
}
