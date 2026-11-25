import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Đã xảy ra lỗi ngoài ý muốn.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F7F8] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3">
            <h1 className="text-lg font-bold text-slate-900">Đã xảy ra sự cố hiển thị</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Vui lòng tải lại trang để tiếp tục sử dụng ứng dụng.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold cursor-pointer"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
