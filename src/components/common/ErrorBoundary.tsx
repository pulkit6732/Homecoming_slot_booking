import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('The application could not render.', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-panel" role="alert">
          <p className="eyebrow">Something went wrong</p>
          <h1>The page could not be displayed.</h1>
          <p>
            Try loading the page again. If the problem continues, contact
            support.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </main>
      )
    }

    return this.props.children
  }
}
