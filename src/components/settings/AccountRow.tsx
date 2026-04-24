'use client'

import { useState } from 'react'
import AccountAvatar from '@/components/layout/AccountAvatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { GitHubAccountDTO } from '@/types'

type AccountRowProps = {
  account: GitHubAccountDTO
  isActive: boolean
  onDisconnect: (accountId: string) => Promise<void>
  isLast: boolean
}

export default function AccountRow({ account, isActive, onDisconnect, isLast }: AccountRowProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    await onDisconnect(account.id)
    setIsDisconnecting(false)
    setIsModalOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-4 py-4">
        <AccountAvatar login={account.githubLogin} avatarUrl={account.avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">{account.githubLogin}</p>
            {isActive && <Badge variant="success">Active</Badge>}
          </div>
          {account.displayName && (
            <p className="text-xs text-gray-400">{account.displayName}</p>
          )}
        </div>
        <Button
          variant="danger"
          size="sm"
          disabled={isLast}
          onClick={() => setIsModalOpen(true)}
        >
          Disconnect
        </Button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Disconnect GitHub Account"
      >
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to disconnect{' '}
          <span className="font-semibold">{account.githubLogin}</span>? This will remove all
          associated repositories and metrics.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" isLoading={isDisconnecting} onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </Modal>
    </>
  )
}
