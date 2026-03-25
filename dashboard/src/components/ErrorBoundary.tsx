import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to render on error. If not provided, uses default fallback. */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Level indicator for styling: 'app' = full-page, 'component' = inline */
  level?: 'app' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary for catching render errors.
 *
 * Usage:
 *   <ErrorBoundary level="app">
 *     <App />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary level="component" fallback={<p>Failed to load</p>}>
 *     <SwapTransaction />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isApp = this.props.level === 'app';

      return (
        <div style={isApp ? styles.appContainer : styles.componentContainer}>
          <div style={isApp ? styles.appCard : styles.componentCard}>
            <h2 style={isApp ? styles.appTitle : styles.componentTitle}>
              {isApp ? 'Something went wrong' : 'This section encountered an error'}
            </h2>
            <p style={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            {isApp && (
              <p style={styles.hint}>
                Your funds are safe. No transaction was sent.
              </p>
            )}
            <button onClick={this.handleReset} style={styles.button}>
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a1c32 0%, #0f2b46 40%, #134e5e 100%)',
    padding: 20,
  },
  appCard: {
    textAlign: 'center' as const,
    background: '#fff',
    padding: '48px 40px',
    borderRadius: 16,
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    maxWidth: 480,
  },
  appTitle: {
    margin: '0 0 12px',
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a1a',
  },
  componentContainer: {
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  componentCard: {
    textAlign: 'center' as const,
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '24px 20px',
    borderRadius: 12,
    maxWidth: 400,
    width: '100%',
  },
  componentTitle: {
    margin: '0 0 8px',
    fontSize: 16,
    fontWeight: 600,
    color: '#dc2626',
  },
  message: {
    margin: '0 0 16px',
    color: '#666',
    lineHeight: 1.6,
    fontSize: 14,
    wordBreak: 'break-word' as const,
  },
  hint: {
    margin: '0 0 24px',
    color: '#0d9488',
    fontSize: 14,
    fontWeight: 600,
  },
  button: {
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

/**
 * Higher-order component wrapper for convenience.
 * Usage: export default withErrorBoundary(MyComponent)
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  level: 'app' | 'component' = 'component'
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary level={level}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return ComponentWithErrorBoundary;
}
