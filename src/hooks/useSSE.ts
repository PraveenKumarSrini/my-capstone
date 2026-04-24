'use client'

import { useEffect, useRef, useState } from 'react'
import { mutate } from 'swr'

type SSEStatus = 'connecting' | 'connected' | 'error'

export function useSSE() {
  const [status, setStatus] = useState<SSEStatus>('connecting')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/sse/metrics')
    esRef.current = es

    es.addEventListener('connected', () => setStatus('connected'))
    es.addEventListener('heartbeat', () => setStatus('connected'))

    es.addEventListener('metrics_updated', () => {
      mutate('/api/dashboard')
      mutate('/api/repos')
    })

    es.onerror = () => setStatus('error')

    return () => {
      es.close()
      esRef.current = null
    }
  }, [])

  return { status }
}
