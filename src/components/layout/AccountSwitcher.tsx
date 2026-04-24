'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import AccountAvatar from './AccountAvatar'
import Spinner from '@/components/ui/Spinner'

export default function AccountSwitcher() {
  const router = useRouter()
  const { accounts, activeAccountId, isLoading, mutate } = useActiveAccount()
  const [switching, setSwitching] = useState<string | null>(null)

  const handleSwitch = async (accountId: string) => {
    if (accountId === activeAccountId || switching) return
    setSwitching(accountId)
    try {
      await fetch(`/api/github-accounts/${accountId}/switch`, { method: 'POST' })
      await mutate()
      router.refresh()
    } finally {
      setSwitching(null)
    }
  }

  return (
    <div className="px-3 pb-3">
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
        GitHub Accounts
      </p>

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="space-y-1">
          {accounts.map((account) => {
            const isActive = account.id === activeAccountId
            const isSwitching = switching === account.id
            return (
              <button
                key={account.id}
                onClick={() => handleSwitch(account.id)}
                disabled={!!switching}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors disabled:cursor-wait ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <AccountAvatar
                  login={account.githubLogin}
                  avatarUrl={account.avatarUrl}
                  size="sm"
                />
                <span className="flex-1 truncate">
                  {account.displayName ?? account.githubLogin}
                </span>
                {isSwitching && <Spinner size="sm" />}
                {isActive && !isSwitching && (
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                )}
              </button>
            )
          })}
        </div>
      )}

      <a
        href="/api/auth/signin/github"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Connect GitHub Account
      </a>
    </div>
  )
}
