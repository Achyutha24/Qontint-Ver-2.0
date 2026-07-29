import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children?: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-[var(--bg-card)] border border-rose-500/20 rounded-2xl shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            {this.props.fallbackTitle || 'Component Execution Error'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            {this.state.error?.message || 'An unexpected runtime exception occurred in this module.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 rounded-xl bg-[var(--aurora)] text-white text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={14} /> Retry Component
            </button>
            <button
              onClick={() => window.location.href = '/app/dashboard'}
              className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-2 hover:bg-[var(--bg-depth)] transition-colors"
            >
              <Home size={14} /> Return to Dashboard
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
