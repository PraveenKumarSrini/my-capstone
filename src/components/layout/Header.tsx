'use client'

import { signOut, useSession } from 'next-auth/react'
import Button from '@/components/ui/Button'

type HeaderProps = {
  title: string
  breadcrumb?: string
}

export default function Header({ title, breadcrumb }: HeaderProps) {
  const { data: session } = useSession()

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div>
        {breadcrumb && (
          <p className="text-xs text-gray-400 mb-0.5">{breadcrumb}</p>
        )}
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {session?.user?.name && (
          <span className="text-sm text-gray-500">{session.user.name}</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
