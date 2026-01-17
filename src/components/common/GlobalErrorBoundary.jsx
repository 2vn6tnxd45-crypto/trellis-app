// src/components/common/GlobalErrorBoundary.jsx
// ============================================
// GLOBAL ERROR BOUNDARY
// ============================================
// Catches unhandled errors at the app level and shows a friendly error page
// with recovery options

import React from 'react';
import { AlertOctagon, RefreshCw, Home, Bug } from 'lucide-react';

export class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log to console in development
        console.error('[GlobalErrorBoundary] Uncaught error:', error);
        console.error('[GlobalErrorBoundary] Component stack:', errorInfo?.componentStack);

        this.setState({ errorInfo });

        // In production, you might want to send this to an error tracking service
        // Example: Sentry.captureException(error, { extra: errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            const isDev = process.env.NODE_ENV === 'development';

            return (
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
                        {/* Icon */}
                        <div className="inline-flex p-4 bg-red-100 rounded-full mb-6">
                            <AlertOctagon className="h-10 w-10 text-red-600" />
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">
                            Something went wrong
                        </h1>

                        {/* Message */}
                        <p className="text-slate-600 mb-6">
                            We're sorry, but something unexpected happened.
                            Please try refreshing the page or going back to the home screen.
                        </p>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <button
                                onClick={this.handleReload}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                            >
                                <RefreshCw size={18} />
                                Refresh Page
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                <Home size={18} />
                                Go Home
                            </button>
                        </div>

                        {/* Retry option */}
                        <button
                            onClick={this.handleRetry}
                            className="text-sm text-slate-500 hover:text-emerald-600 underline"
                        >
                            Try again without refreshing
                        </button>

                        {/* Error details in development */}
                        {isDev && this.state.error && (
                            <div className="mt-6 p-4 bg-slate-100 rounded-xl text-left overflow-auto max-h-48">
                                <div className="flex items-center gap-2 text-slate-600 text-xs font-medium mb-2">
                                    <Bug size={14} />
                                    Development Error Details
                                </div>
                                <pre className="text-xs text-red-600 whitespace-pre-wrap break-words">
                                    {this.state.error.toString()}
                                </pre>
                                {this.state.errorInfo?.componentStack && (
                                    <pre className="text-xs text-slate-500 mt-2 whitespace-pre-wrap break-words">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <p className="text-xs text-slate-400 mt-6">
                            If this keeps happening, please contact support.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
