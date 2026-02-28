import { X, Bot, Sparkles } from 'lucide-react';
import { useCopStore } from '../../store/copStore';
import { useChatStore } from '../../store/chatStore';
import type { CopSuggestion } from '../../types';

function Toast({ suggestion }: { suggestion: CopSuggestion }) {
  const { dismissSuggestion } = useCopStore();

  return (
    <div
      className="animate-toastIn rounded-2xl p-4 flex flex-col gap-3 max-w-sm"
      style={{
        background: 'rgba(14,14,26,0.95)',
        border: '1px solid rgba(99,102,241,0.32)',
        backdropFilter: 'blur(30px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(99,102,241,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
        >
          <Bot size={14} color="white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs font-semibold" style={{ color: '#818cf8' }}>COP</span>
            <Sparkles size={10} color="#a78bfa" />
          </div>
          <p className="text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>
            {suggestion.message}
          </p>
        </div>
        <button
          onClick={() => dismissSuggestion(suggestion.id)}
          className="shrink-0 mt-0.5 opacity-35 hover:opacity-75 transition-opacity"
        >
          <X size={14} color="white" />
        </button>
      </div>

      {/* Actions */}
      {suggestion.actions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {suggestion.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => { action.handler(); dismissSuggestion(suggestion.id); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
              style={
                i === 0
                  ? { background: 'rgba(99,102,241,0.9)', color: 'white' }
                  : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)' }
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CopToastContainer() {
  const { suggestions } = useCopStore();
  const { isOpen: chatIsOpen } = useChatStore();

  if (suggestions.length === 0) return null;

  // Shift toasts left when chat panel is open to avoid overlap
  const rightOffset = chatIsOpen ? 380 : 24;

  return (
    <div
      className="fixed flex flex-col gap-3 z-[70]"
      style={{
        bottom: 100,
        right: rightOffset,
        maxWidth: '360px',
        transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {suggestions.map(s => (
        <Toast key={s.id} suggestion={s} />
      ))}
    </div>
  );
}
