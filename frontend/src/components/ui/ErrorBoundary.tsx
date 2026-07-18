/**
 * ErrorBoundary — Global React Error Boundary
 *
 * Catches ALL unhandled rendering exceptions across the entire application.
 * Prevents blank screens by always displaying a professional recovery UI.
 *
 * Features:
 *  - Captures full stack traces (dev mode only)
 *  - Retry, return home, and reload cached result buttons
 *  - Matches the app's dark/light theme via CSS variables
 */
import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    if (import.meta.env.DEV) {
      console.group('%c[ErrorBoundary] Unhandled React Error', 'color: #ff6b6b; font-weight: bold')
      console.error('Error:', error)
      console.error('Component Stack:', errorInfo.componentStack)
      console.groupEnd()
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleReturnHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/app/analyze'
  }

  handleReloadCached = () => {
    // Clear only the local error state — forces re-render to attempt loading from cache
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const isDev = import.meta.env.DEV
      const errorMessage = this.state.error?.message || 'An unexpected error occurred.'

      return (
        <div
          style={{
            minHeight: '100vh',
            background: 'var(--bg-main, #0D1117)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              background: 'var(--bg-card, #161B22)',
              border: '1px solid rgba(244,162,97,0.2)',
              borderRadius: '20px',
              padding: '2.5rem',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            }}
          >
            {/* Icon */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                ⚠
              </div>
              <div>
                <h1
                  style={{
                    color: 'var(--text-primary, #FFFFFF)',
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Something went wrong
                </h1>
                <p
                  style={{
                    color: 'var(--text-secondary, #A3AAB8)',
                    fontSize: '0.875rem',
                    margin: '0.25rem 0 0 0',
                  }}
                >
                  A rendering error was caught. Your cached work is safe.
                </p>
              </div>
            </div>

            {/* Error summary */}
            <div
              style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: '10px',
                padding: '0.875rem 1rem',
                marginBottom: '1.5rem',
              }}
            >
              <p
                style={{
                  color: '#fc8181',
                  fontSize: '0.8rem',
                  fontFamily: 'Space Mono, monospace',
                  margin: 0,
                  wordBreak: 'break-all',
                }}
              >
                {errorMessage}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  background: 'var(--brand, #F4A261)',
                  color: 'var(--bg-main, #0D1117)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.625rem 1.25rem',
                  fontWeight: '700',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
              >
                ↺ Retry
              </button>
              <button
                onClick={this.handleReturnHome}
                style={{
                  background: 'var(--bg-secondary, #111827)',
                  color: 'var(--text-primary, #FFFFFF)',
                  border: '1px solid var(--border, #30363D)',
                  borderRadius: '10px',
                  padding: '0.625rem 1.25rem',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                ← Return to Analyze
              </button>
              <button
                onClick={this.handleReloadCached}
                style={{
                  background: 'var(--bg-secondary, #111827)',
                  color: 'var(--text-secondary, #A3AAB8)',
                  border: '1px solid var(--border, #30363D)',
                  borderRadius: '10px',
                  padding: '0.625rem 1.25rem',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                ⟳ Reload Cached Result
              </button>
            </div>

            {/* Dev-only stack trace */}
            {isDev && this.state.errorInfo && (
              <details
                style={{
                  marginTop: '0.5rem',
                  border: '1px solid var(--border, #30363D)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                <summary
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--text-muted, #6B7280)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: 'var(--bg-secondary, #111827)',
                    fontFamily: 'Space Mono, monospace',
                    letterSpacing: '0.05em',
                  }}
                >
                  VIEW STACK TRACE (DEV ONLY)
                </summary>
                <pre
                  style={{
                    margin: 0,
                    padding: '1rem',
                    fontSize: '0.7rem',
                    fontFamily: 'Space Mono, monospace',
                    color: '#fc8181',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    overflowY: 'auto',
                    maxHeight: '200px',
                    background: 'rgba(0,0,0,0.3)',
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
