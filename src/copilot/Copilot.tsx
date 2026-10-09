import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Settings2, Trash2, X, Sparkles, KeyRound } from 'lucide-react';
import Character from './Character';
import { useCopilot, type CopilotLink } from '../store/copilot';
import { useAuth } from '../store/auth';
import { localReply } from './localBrain';
import { cx } from '../lib/utils';

// The Anthropic SDK is only downloaded once the user turns on the AI mode.
const claudeBrain = () => import('./claudeBrain');

const SUGGESTIONS = ['Analyse mon calendrier', 'Trouve le dossier Cours', 'Crée une note Idées', "Qu'est-ce que j'ai demain ?"];

function LinkChips({ links, onGo }: { links?: CopilotLink[]; onGo: (to: string) => void }) {
  if (!links?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {links.map(l => (
        <button
          key={l.to + l.label}
          onClick={() => onGo(l.to)}
          className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
        >
          {l.label} →
        </button>
      ))}
    </div>
  );
}

export default function Copilot() {
  const navigate = useNavigate();
  const user = useAuth(s => s.user);
  const { messages, pose, bubble, thinking, apiKey, offsetY } = useCopilot();
  const { push, setPose, clearBubble, setThinking, setApiKey, setOffsetY, clearHistory } = useCopilot.getState();

  const [look, setLook] = useState({ x: -1, y: 0 });
  const [blink, setBlink] = useState(false);
  const [talking, setTalking] = useState(false);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ startY: number; moved: boolean } | null>(null);

  // Eyes follow the mouse.
  useEffect(() => {
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = rootRef.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width * 0.45);
        const dy = e.clientY - (r.top + r.height * 0.5);
        const len = Math.max(1, Math.hypot(dx, dy));
        setLook({ x: dx / len, y: dy / len });
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Blinking.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        loop();
      }, 2200 + Math.random() * 3500);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  // Curious idle peeks while hidden.
  useEffect(() => {
    if (pose !== 'hidden') return;
    const t = setTimeout(() => {
      if (useCopilot.getState().pose !== 'hidden') return;
      setPose('peek');
      setTimeout(() => {
        const s = useCopilot.getState();
        if (s.pose === 'peek' && !s.bubble) setPose('hidden');
      }, 2600);
    }, 20000 + Math.random() * 25000);
    return () => clearTimeout(t);
  }, [pose, setPose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, thinking, pose]);

  useEffect(() => {
    if (pose === 'open') setTimeout(() => inputRef.current?.focus(), 250);
  }, [pose]);

  // Escape closes the conversation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useCopilot.getState().pose === 'open') setPose('hidden');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPose]);

  const go = (to: string) => {
    navigate(to);
    clearBubble();
  };

  const open = () => {
    clearBubble();
    if (messages.length === 0) {
      push('bot', `Hey ${user?.name ?? ''} ! 👋 Je suis Copilot. Demande-moi de trouver un dossier, d'analyser ton calendrier, de créer une note… je m'occupe du reste.`);
    }
    setPose('open');
  };

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    setInput('');
    push('user', clean);
    setThinking(true);
    let reply;
    if (apiKey) {
      try {
        reply = await (await claudeBrain()).claudeReply(clean, apiKey, user?.name ?? 'toi');
      } catch (e) {
        const local = localReply(clean);
        const why = await claudeBrain().then(m => m.describeClaudeError(e), () => 'Mode IA indisponible.');
        reply = { text: `${why}\n\n${local.text}`, links: local.links };
      }
    } else {
      await new Promise(r => setTimeout(r, 450 + Math.random() * 400));
      reply = localReply(clean);
    }
    setThinking(false);
    push('bot', reply.text, reply.links);
    setTalking(true);
    setTimeout(() => setTalking(false), Math.min(2400, 300 + reply.text.length * 18));
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  // Drag the character up/down along the edge; a click without movement toggles it.
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    if (Math.abs(e.clientY - drag.current.startY) > 5) drag.current.moved = true;
    if (drag.current.moved) setOffsetY(e.clientY / window.innerHeight);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      if (pose === 'open') setPose('hidden');
      else open();
    }
  };

  const mood = thinking ? 'think' : talking ? 'talk' : bubble ? 'happy' : 'idle';
  const isOpen = pose === 'open';

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed right-0 z-50"
      style={{ top: `${offsetY * 100}%`, transform: 'translateY(-50%)' }}
    >
      <div className="relative flex items-center justify-end">
        {/* Conversation bubble */}
        <div
          className={cx(
            'absolute right-[150px] top-1/2 flex max-h-[min(560px,80vh)] w-[min(370px,calc(100vw-170px))] -translate-y-1/2 origin-right flex-col rounded-[26px] border border-white/70 bg-white/95 shadow-2xl shadow-indigo-900/15 backdrop-blur-xl transition-all duration-300',
            isOpen ? 'pointer-events-auto scale-100 opacity-100' : 'scale-75 opacity-0',
          )}
          role="dialog"
          aria-label="Copilot"
          aria-hidden={!isOpen}
        >
          <span className="absolute -right-2 top-1/2 h-5 w-5 -translate-y-1/2 rotate-45 rounded-sm border-r border-t border-white/70 bg-white" />
          <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Copilot</p>
              <p className="flex items-center gap-1 text-[11px] text-slate-500">
                {apiKey ? (
                  <>
                    <Sparkles size={11} className="text-violet-500" /> Mode IA (Claude)
                  </>
                ) : (
                  'Mode local · commandes rapides'
                )}
              </p>
            </div>
            <button title="Réglages" onClick={() => { setKeyDraft(apiKey); setShowSettings(v => !v); }} className="icon-btn">
              <Settings2 size={16} />
            </button>
            <button title="Effacer la conversation" onClick={() => { clearHistory(); void claudeBrain().then(m => m.resetClaudeHistory()); }} className="icon-btn">
              <Trash2 size={16} />
            </button>
            <button title="Fermer (Échap)" onClick={() => setPose('hidden')} className="icon-btn">
              <X size={16} />
            </button>
          </header>

          {showSettings && (
            <div className="space-y-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
              <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                <KeyRound size={13} /> Brancher Copilot sur Claude
              </p>
              <p>
                Sans clé, je comprends des commandes simples. Avec une clé API Anthropic, je peux répondre à tout et agir sur ton espace.
                La clé reste dans ce navigateur.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyDraft}
                  onChange={e => setKeyDraft(e.target.value)}
                  placeholder="sk-ant-…"
                  className="field flex-1 py-1.5 text-xs"
                />
                <button
                  className="btn-primary px-3 py-1.5 text-xs"
                  onClick={() => {
                    setApiKey(keyDraft);
                    void claudeBrain().then(m => m.resetClaudeHistory());
                    setShowSettings(false);
                  }}
                >
                  OK
                </button>
              </div>
              {apiKey && (
                <button className="text-rose-600 hover:underline" onClick={() => { setApiKey(''); setKeyDraft(''); }}>
                  Retirer la clé
                </button>
              )}
            </div>
          )}

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map(m => (
              <div key={m.id} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cx(
                    'max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed',
                    m.role === 'user' ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800',
                  )}
                >
                  {m.text}
                  {m.role === 'bot' && <LinkChips links={m.links} onGo={go} />}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex gap-1 px-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            )}
          </div>

          {messages.length <= 2 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => void send(s)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
                  {s}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-slate-100 p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Demande-moi n'importe quoi…"
              className="field flex-1"
              tabIndex={isOpen ? 0 : -1}
            />
            <button type="submit" disabled={!input.trim() || thinking} className="btn-primary h-10 w-10 justify-center p-0" title="Envoyer" tabIndex={isOpen ? 0 : -1}>
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Short proactive remark */}
        {bubble && !isOpen && (
          <div className="pointer-events-auto absolute right-[118px] top-2 w-64 animate-[pop_.3s_ease-out] rounded-2xl rounded-br-sm border border-white/70 bg-white px-3.5 py-2.5 text-[13px] text-slate-700 shadow-xl shadow-indigo-900/10">
            <button onClick={clearBubble} className="absolute right-1.5 top-1.5 text-slate-300 hover:text-slate-500" title="Fermer">
              <X size={13} />
            </button>
            <p className="pr-3">{bubble.text}</p>
            <LinkChips links={bubble.links} onGo={go} />
          </div>
        )}

        {/* The character itself */}
        <div
          className="pointer-events-auto cursor-pointer touch-none"
          style={{ clipPath: 'inset(-60px 0 -60px -60px)' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onMouseEnter={() => pose === 'hidden' && setPose('peek')}
          onMouseLeave={() => pose === 'peek' && !bubble && setPose('hidden')}
          title={isOpen ? 'Fermer Copilot' : 'Parler à Copilot (glisser pour déplacer)'}
          role="button"
          aria-label="Copilot"
        >
          <Character pose={pose} look={look} blink={blink} mood={mood} />
        </div>
      </div>
    </div>
  );
}
