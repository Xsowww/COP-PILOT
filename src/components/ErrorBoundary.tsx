import { Component, type ReactNode } from 'react';

/** Last safety net: an unexpected error shows this screen instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[app]', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper p-6 text-center">
        <p className="text-[15px] font-semibold">Oups, quelque chose s’est mal passé.</p>
        <p className="max-w-sm text-[13px] text-stone-500">Ton travail est enregistré. Recharge la page pour continuer.</p>
        <button className="btn-primary mt-1 h-9" onClick={() => location.reload()}>
          Recharger
        </button>
      </div>
    );
  }
}
