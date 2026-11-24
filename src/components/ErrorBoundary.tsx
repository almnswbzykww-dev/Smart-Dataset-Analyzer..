import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'حدث خطأ غير متوقع في التطبيق.';
    try {
      const parsed = JSON.parse(readable) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        readable = `خطأ في قاعدة البيانات (${parsed.operationType || 'عملية'}): ${parsed.error}`;
      }
    } catch {
      // plain text error
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full auth-analytics-bg flex items-center justify-center p-6 text-slate-900" dir="rtl">
          <div className="max-w-lg w-full bg-white border border-rose-200 rounded-2xl shadow-xl p-6 space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h2 className="text-lg font-black text-slate-900">تعذر إكمال العملية</h2>
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold cursor-pointer transition"
            >
              🔄 إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
