import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useAuthStore } from './stores/authStore';
import './index.css';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown | null }
> {
  state: { error: unknown | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error('App crashed:', error);
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' &&
              err !== null &&
              'message' in err &&
              typeof (err as any).message === 'string'
            ? String((err as any).message)
            : String(err);
      return (
        <div className="min-h-screen bg-[color:var(--pcrs-bg)] flex items-center justify-center text-[color:var(--pcrs-text)] p-10">
          <div className="max-w-3xl w-full bg-[color:var(--pcrs-surface)] border border-[color:var(--pcrs-border)] rounded-2xl p-6">
            <div className="text-xs text-slate-400 tracking-[0.35em] font-black uppercase">
              Application Error
            </div>
            <div className="mt-4 text-lg font-black">UI failed to render</div>
            <div className="mt-3 text-sm text-slate-300 whitespace-pre-wrap break-words">
              {msg}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] bg-blue-600 hover:bg-blue-500"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

const root = ReactDOM.createRoot(rootElement);

const globalAny = globalThis as any;
if (!globalAny.__PCRS_AUTH_INIT_STARTED__) {
  globalAny.__PCRS_AUTH_INIT_STARTED__ = true;
  void useAuthStore
    .getState()
    .initAuth()
    .catch(err => {
      console.error('Authentication initialization failed:', err);
    });
}

root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
