import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render exceptions (including failed lazy chunks) so a single broken
 * component does not white-screen the whole console.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error in admin app:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="content"
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh',
          }}
        >
          <div
            className="card"
            style={{ maxWidth: 440, width: '100%', textAlign: 'center', padding: '32px 24px' }}
          >
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-strong)', marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              An unexpected error occurred while loading this page. Try reloading — if it keeps happening, come back a
              little later.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload the page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
