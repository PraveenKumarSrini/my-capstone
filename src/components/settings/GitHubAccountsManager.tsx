'use client'

import { useState } from 'react'
import AccountRow from './AccountRow'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import Spinner from '@/components/ui/Spinner'

export default function GitHubAccountsManager() {
  const { accounts, activeAccountId, isLoading, mutate } = useActiveAccount()
  const [error, setError] = useState('')

  const handleDisconnect = async (accountId: string) => {
    setError('')
    const res = await fetch(`/api/github-accounts/${accountId}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? 'Failed to disconnect account')
    } else {
      await mutate()
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
      <h3 className="text-sm font-semibold text-gray-900">Connected GitHub Accounts</h3>
      <p className="mt-0.5 text-xs text-gray-400">Up to 10 accounts</p>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : accounts.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">No GitHub accounts connected</p>
      ) : (
        <div className="mt-2 divide-y divide-gray-100">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isActive={account.id === activeAccountId}
              onDisconnect={handleDisconnect}
              isLast={accounts.length === 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
