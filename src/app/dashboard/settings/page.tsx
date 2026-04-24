'use client'

import Header from '@/components/layout/Header'
import GitHubAccountsManager from '@/components/settings/GitHubAccountsManager'

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" breadcrumb="Dashboard" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl space-y-5">
          <GitHubAccountsManager />
        </div>
      </main>
    </>
  )
}
