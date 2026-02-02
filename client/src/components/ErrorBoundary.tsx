/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Prevents the entire application from crashing due to one component error.
 * 
 * Usage:
 *   <ErrorBoundary>
 *     <MyComponent />
 *   </ErrorBoundary>
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white rounded-xl shadow-lg border border-red-100 p-8 max-w-lg w-full">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            
            <h1 className="text-xl font-bold text-slate-900 text-center mb-2">
              应用程序出错了
            </h1>
            
            <p className="text-slate-600 text-center mb-6">
              抱歉，应用程序遇到了意外错误。请尝试刷新页面或返回首页。
            </p>

            {/* Error details (collapsed by default) */}
            {this.state.error && (
              <div className="mb-6">
                <details className="bg-slate-50 rounded-lg border border-slate-200">
                  <summary className="px-4 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100">
                    查看错误详情（供开发人员参考）
                  </summary>
                  <div className="px-4 py-3 text-xs font-mono text-red-700 overflow-auto max-h-48">
                    <p className="font-semibold mb-1">{this.state.error.toString()}</p>
                    {this.state.errorInfo && (
                      <pre className="whitespace-pre-wrap text-slate-600">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>重试</span>
              </button>
              
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>刷新页面</span>
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>返回首页</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Async Error Boundary
 * 
 * A wrapper component that catches errors in async operations
 * and provides a way to reset and retry.
 */
interface AsyncErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string | number;
}

export class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps, State> {
  constructor(props: AsyncErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidUpdate(prevProps: AsyncErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  render(): ReactNode {
    return (
      <ErrorBoundary>
        {this.props.children}
      </ErrorBoundary>
    );
  }
}

export default ErrorBoundary;