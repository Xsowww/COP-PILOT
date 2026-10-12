import { create } from 'zustand';
import { uid } from '../lib/utils';

export interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'error';
  action?: ToastAction;
}

export interface ToastAction {
  label: string;
  run: () => void;
}

interface DialogRequest {
  kind: 'confirm' | 'prompt';
  title: string;
  message?: string;
  defaultValue?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (value: string | boolean | null) => void;
}

interface UiState {
  toasts: Toast[];
  dialog: DialogRequest | null;
  toast: (text: string, tone?: Toast['tone'], action?: ToastAction) => void;
  dismissToast: (id: string) => void;
  closeDialog: (value: string | boolean | null) => void;
}

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  dialog: null,
  toast(text, tone = 'info', action) {
    const t = { id: uid(), text, tone, action };
    set(s => ({ toasts: [...s.toasts, t] }));
    setTimeout(() => get().dismissToast(t.id), action ? 6000 : 3500);
  },
  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  closeDialog(value) {
    get().dialog?.resolve(value);
    set({ dialog: null });
  },
}));

export const toast = (text: string, tone?: Toast['tone'], action?: ToastAction) => useUi.getState().toast(text, tone, action);

export function askText(title: string, defaultValue = '', confirmLabel = 'Valider'): Promise<string | null> {
  return new Promise(resolve =>
    useUi.setState({ dialog: { kind: 'prompt', title, defaultValue, confirmLabel, resolve: v => resolve(typeof v === 'string' ? v : null) } }),
  );
}

export function confirmAction(title: string, message?: string, confirmLabel = 'Supprimer', danger = true): Promise<boolean> {
  return new Promise(resolve =>
    useUi.setState({ dialog: { kind: 'confirm', title, message, confirmLabel, danger, resolve: v => resolve(v === true) } }),
  );
}
