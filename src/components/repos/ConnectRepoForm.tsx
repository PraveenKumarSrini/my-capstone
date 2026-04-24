'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

type ConnectRepoFormProps = {
  onConnect: () => void
}

export default function ConnectRepoForm({ onConnect }: ConnectRepoFormProps) {
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
      setError('Enter a valid repo name in owner/repo format')
      return
    }

    setIsLoading(true)
    const res = await fetch('/api/repos/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName }),
    })
    const json = await res.json()
    setIsLoading(false)

    if (!json.success) {
      setError(json.error ?? 'Failed to connect repository')
    } else {
      setSuccess(`${fullName} connected successfully`)
      setFullName('')
      onConnect()
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Connect a Repository</h3>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="owner/repo"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <Button type="submit" isLoading={isLoading} disabled={!fullName}>
          Connect
        </Button>
      </form>
    </div>
  )
}
