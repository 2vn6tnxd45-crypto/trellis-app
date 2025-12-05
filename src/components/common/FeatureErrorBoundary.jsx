// src/components/common/FeatureErrorBoundary.jsx
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class FeatureErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Feature Crash:", error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onRetry) this.props.onRetry();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col items-center text-center animate-in fade-in zoom-in-95 my-4">
                    <div className="bg-red-100 p-3 rounded-full mb-3">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <h3 className="text-red-900 font-bold mb-1">Temporarily Unavailable</h3>
                    <p className="text-red-700/80 text-xs mb-4 max-w-xs">
                        {this.props.label || "This feature"} encountered a problem.
                    </p>
                    <button 
                        onClick={this.handleRetry}
                        className="flex items-center px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors shadow-sm"
                    >
                        <RefreshCw className="h-3 w-3 mr-2" /> Reload Section
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
