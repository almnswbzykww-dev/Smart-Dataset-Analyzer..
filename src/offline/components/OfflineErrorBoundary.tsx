import React from 'react';

interface OfflineErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class OfflineErrorBoundary extends React.Component<
  { children: React.ReactNode },
  OfflineErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): OfflineErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'حدث خطأ غير متوقع في النسخة المحلية للتطبيق.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen w-full emerald-wallpaper flex items-center justify-center p-6 text-white"
          dir="rtl"
        >
          <div className="max-w-lg w-full glass-panel-emerald emerald-glow-border rounded-2xl shadow-xl p-6 space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-950/80 border border-rose-400/50 text-rose-300 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h2 className="text-lg font-black text-white">تعذر إكمال العملية في النسخة المحلية</h2>
            <p className="text-sm text-slate-200 bg-emeraldos-950/90 border border-white/10 rounded-xl p-3 font-medium break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl platgold-gradient text-emeraldos-950 text-sm font-black cursor-pointer transition"
            >
              🔄 إعادة تحميل التطبيق المحلي
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
