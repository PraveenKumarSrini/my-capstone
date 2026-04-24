'use client'

import { Component, type ReactNode } from 'react'
import logger from '@/lib/logger'

type Props = {
  fallback?: ReactNode
  children: ReactNode
}

type State = {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    logger.error({ err: error, componentStack: info.componentStack }, 'React render error')
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-medium text-red-700">Something went wrong.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-3 text-xs text-red-600 underline"
            >
              Try again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
