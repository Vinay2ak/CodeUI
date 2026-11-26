import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="p-6 rounded-lg bg-surface border border-danger/30 text-text flex flex-col items-center justify-center text-center gap-3 my-4"
        >
          <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h3>
            <p className="text-xs text-text-muted mt-1 max-w-md font-mono">
              {this.state.error?.message || 'An unexpected runtime error occurred'}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={this.handleReset}
            className="mt-2"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
