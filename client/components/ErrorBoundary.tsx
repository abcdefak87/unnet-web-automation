import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { ErrorFallback } from './ErrorFallback'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  context?: string
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Don't show error boundary for AbortError (navigation cancellation)
    if (error.name === 'AbortError' || error.message?.includes('Abort')) {
      console.log('AbortError caught by boundary, ignoring:', error.message)
      return { hasError: false }
    }
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Don't log AbortError as it's expected behavior
    if (error.name === 'AbortError' || error.message?.includes('Abort')) {
      console.log('Navigation was cancelled, this is normal:', error.message)
      return
    }
    console.error('Navigation Error Boundary caught an error:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || ErrorFallback
      return (
        <FallbackComponent 
          error={this.state.error} 
          resetError={this.resetError}
          context={this.props.context}
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
