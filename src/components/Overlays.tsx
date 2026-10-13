import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useUi } from '../store/ui';
import { cx } from '../lib/utils';

export function Toasts() {
  const toasts = useUi(s => s.toasts);
  const dismiss = useUi(s => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2 md:bottom-6">
      {toasts.slice(-3).map(t => (
        <div key={t.id} className="pop flex items-center gap-2 rounded-lg bg-inverse px-3.5 py-2 text-[13px] text-on-inverse shadow-pop">
          {t.tone === 'success' ? <CheckCircle2 size={15} className="text-emerald-400" /> : t.tone === 'error' ? <XCircle size={15} className="text-red-400" /> : <Info size={15} className="text-stone-400" />}
          {t.text}
          {t.action && (
            <button
              className="pointer-events-auto -my-1 -mr-1.5 ml-1.5 rounded-md px-2 py-1 font-medium text-brand-200 transition-colors hover:bg-on-inverse/10 hover:text-on-inverse dark:text-brand-700"
              onClick={() => {
                dismiss(t.id);
                t.action!.run();
              }}
            >
              {t.action.label}
            </button>
          )}
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/25 p-4 dark:bg-black/60" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className="pop w-full rounded-2xl border border-stone-200 bg-surface p-5 shadow-pop" style={{ maxWidth: width }} onMouseDown={e => e.stopPropagation()}>
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
      <h3 className="text-[15px] font-semibold">{dialog.title}</h3>
      {dialog.message && <p className="mt-1 text-[13px] text-stone-500">{dialog.message}</p>}
      {dialog.kind === 'prompt' && <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)} className="field mt-4 w-full" />}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => close(null)}>
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
  /** Custom row (e.g. a colour palette) rendered instead of a button. */
  content?: React.ReactNode;
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
      className="enter fixed z-[65] min-w-52 rounded-xl border border-stone-200 bg-surface p-1 shadow-pop"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((it, i) =>
        it.divider ? (
          <div key={i} className="my-1 h-px bg-stone-100" />
        ) : it.content ? (
          <div key={i}>{it.content}</div>
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick();
            }}
            className={cx(
              'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] transition-colors disabled:opacity-40',
              it.danger ? 'text-red-600 hover:bg-red-50' : 'text-stone-700 hover:bg-stone-100',
            )}
          >
            <span className="flex w-4 justify-center text-stone-400 [&>svg]:h-[15px] [&>svg]:w-[15px]">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="font-mono text-[10px] text-stone-400">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
