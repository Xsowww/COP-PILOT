import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useUi } from '../store/ui';
import { cx } from '../lib/utils';

export function Toasts() {
  const toasts = useUi(s => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map(t => (
        <div key={t.id} className="fade-up flex items-center gap-2 rounded-2xl bg-slate-900/90 px-4 py-2.5 text-sm text-white shadow-xl backdrop-blur">
          {t.tone === 'success' ? <CheckCircle2 size={16} className="text-emerald-400" /> : t.tone === 'error' ? <XCircle size={16} className="text-rose-400" /> : <Info size={16} className="text-indigo-300" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, children, width = 420 }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className="fade-up w-full rounded-3xl bg-white p-6 shadow-2xl" style={{ maxWidth: width }} onMouseDown={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function DialogBody() {
  const dialog = useUi(s => s.dialog)!;
  const close = useUi(s => s.closeDialog);
  const [value, setValue] = useState(dialog.defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    // Select the name without its extension, like a real file manager.
    const dot = el.value.lastIndexOf('.');
    el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
  }, []);

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        close(dialog.kind === 'prompt' ? value : true);
      }}
    >
      <h3 className="text-lg font-semibold text-slate-900">{dialog.title}</h3>
      {dialog.message && <p className="mt-1.5 text-sm text-slate-500">{dialog.message}</p>}
      {dialog.kind === 'prompt' && <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)} className="field mt-4 w-full" />}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => close(null)}>
          Annuler
        </button>
        <button type="submit" className={dialog.danger ? 'btn-danger' : 'btn-primary'} disabled={dialog.kind === 'prompt' && !value.trim()} autoFocus={dialog.kind === 'confirm'}>
          {dialog.confirmLabel}
        </button>
      </div>
    </form>
  );
}

export function DialogHost() {
  const dialog = useUi(s => s.dialog);
  const close = useUi(s => s.closeDialog);
  return (
    <Modal open={!!dialog} onClose={() => close(null)}>
      {dialog && <DialogBody key={dialog.title + (dialog.defaultValue ?? '')} />}
    </Modal>
  );
}

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
    }
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [x, y, onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[65] min-w-52 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl shadow-slate-900/15 backdrop-blur-xl"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((it, i) =>
        it.divider ? (
          <div key={i} className="my-1 h-px bg-slate-100" />
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick();
            }}
            className={cx(
              'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition disabled:opacity-40',
              it.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100',
            )}
          >
            <span className="flex w-4 justify-center text-slate-400">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="text-[11px] text-slate-400">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
