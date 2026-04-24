import type { SSEEvent } from '@/types'

type SSEController = ReadableStreamDefaultController<Uint8Array>

const clients = new Map<string, Set<SSEController>>()
const encoder = new TextEncoder()

export function subscribe(accountId: string, controller: SSEController): void {
  if (!clients.has(accountId)) {
    clients.set(accountId, new Set())
  }
  clients.get(accountId)!.add(controller)
}

export function unsubscribe(accountId: string, controller: SSEController): void {
  const accountClients = clients.get(accountId)
  if (!accountClients) return
  accountClients.delete(controller)
  if (accountClients.size === 0) clients.delete(accountId)
}

export function broadcast(accountId: string, event: SSEEvent): void {
  const accountClients = clients.get(accountId)
  if (!accountClients || accountClients.size === 0) return

  const payload = encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)

  for (const controller of accountClients) {
    try {
      controller.enqueue(payload)
    } catch {
      accountClients.delete(controller)
    }
  }
}
