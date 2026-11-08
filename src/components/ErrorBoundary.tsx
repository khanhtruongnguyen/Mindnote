import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-3 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 flex flex-col gap-3">
          <div className="flex items-center gap-2 font-semibold text-red-300">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{this.props.fallbackTitle || 'Đã có lỗi xảy ra khi hiển thị khu vực này.'}</span>
          </div>
          <p className="text-xs text-red-200/80 font-mono bg-black/30 p-2.5 rounded-lg overflow-x-auto">
            {this.state.error?.message || 'Lỗi không xác định'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-medium text-red-200 border border-red-500/30 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử tải lại ô này</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
