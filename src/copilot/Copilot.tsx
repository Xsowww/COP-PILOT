import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, RotateCcw, X } from 'lucide-react';
import Character, { CopilotAvatar, type CopilotMood } from './Character';
import { useCopilot, type CopilotLink, type CopilotOffer } from '../store/copilot';
import { useAuth } from '../store/auth';
import { localReply, type BotReply } from './localBrain';
import { acceptOffer, runOffer } from './offers';
import { normalize, cx } from '../lib/utils';

// The AI part (and the Anthropic types it uses) is loaded on first use.
const brain = () => import('./claudeBrain');

const SUGGESTIONS = ['Analyse ma semaine', 'Planifie mes révisions', 'Trouve le dossier Cours', 'Raconte-moi une blague'];
const YES = /^(oui|ouais|ok|okay|vas[- ]y|go|carrement|d'accord|dac|yes|avec plaisir|je veux bien|volontiers)\b/;

function Extras({ links, offers, onGo, onOffer, disabled }: { links?: CopilotLink[]; offers?: CopilotOffer[]; onGo: (to: string) => void; onOffer: (o: CopilotOffer) => void; disabled?: boolean }) {
  if (!links?.length && !offers?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {offers?.map((o, i) => (
        <button
          key={o.label}
          disabled={disabled}
          onClick={() => onOffer(o)}
          className={cx(
            'h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors disabled:opacity-40',
            i === 0 ? 'bg-ink text-white hover:bg-stone-800' : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
          )}
        >
          {o.label}
        </button>
      ))}
      {links?.map(l => (
        <button
          key={l.to + l.label}
          onClick={() => onGo(l.to)}
          className="h-7 max-w-full truncate rounded-md border border-stone-200 bg-white px-2.5 text-[12px] font-medium text-stone-700 transition-colors hover:bg-stone-50"
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
  const { messages, pose, bubble, thinking, aiEnabled, offsetY } = useCopilot();
  const { push, setPose, clearBubble, setThinking, setOffsetY, clearHistory } = useCopilot.getState();

  const [look, setLook] = useState({ x: -1, y: 0 });
  const [blink, setBlink] = useState(false);
  const [talking, setTalking] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [input, setInput] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ startY: number; moved: boolean } | null>(null);

  // Is the AI brain plugged in on the server?
  useEffect(() => {
    void brain().then(m => m.checkAiStatus()).then(ok => useCopilot.getState().setAiEnabled(ok));
  }, []);

  // Eyes follow the mouse; long inactivity sends him to sleep.
  useEffect(() => {
    let frame = 0;
    let sleepTimer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setAsleep(false);
      clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => setAsleep(true), 4 * 60_000);
    };
    const onMove = (e: MouseEvent) => {
      wake();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = rootRef.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.right - 60);
        const dy = e.clientY - (r.top + r.height / 2);
        const len = Math.max(1, Math.hypot(dx, dy));
        setLook({ x: dx / len, y: dy / len });
      });
    };
    wake();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', wake);
      cancelAnimationFrame(frame);
      clearTimeout(sleepTimer);
    };
  }, []);

  // Blinking.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 120);
        loop();
      }, 2400 + Math.random() * 3600);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  // Curious little peeks while hidden.
  useEffect(() => {
    if (pose !== 'hidden' || asleep) return;
    const t = setTimeout(() => {
      if (useCopilot.getState().pose !== 'hidden') return;
      setPose('peek');
      setTimeout(() => {
        const s = useCopilot.getState();
        if (s.pose === 'peek' && !s.bubble) setPose('hidden');
      }, 2200);
    }, 30_000 + Math.random() * 40_000);
    return () => clearTimeout(t);
  }, [pose, asleep, setPose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, thinking, pose]);

  useEffect(() => {
    if (pose !== 'open') return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPose('hidden');
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [pose, setPose]);

  const go = (to: string) => {
    navigate(to);
    clearBubble();
  };

  const speak = (text: string) => {
    setTalking(true);
    setTimeout(() => setTalking(false), Math.min(2200, 300 + text.length * 16));
  };

  const open = () => {
    clearBubble();
    if (messages.length === 0) push('bot', `Salut ${user?.name ?? ''} ! Moi c'est Copilot. Je peux retrouver tes fichiers, organiser tes révisions, créer des notes… ou juste discuter. Dis-moi.`);
    setPose('open');
  };

  const onOffer = (o: CopilotOffer) => {
    const reply = acceptOffer(o);
    speak(reply.text);
  };

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    setInput('');
    const pending = useCopilot.getState().pendingOffer;
    push('user', clean);

    // "oui" to his last proposal → just do it
    if (pending && YES.test(normalize(clean))) {
      const r = runOffer(pending);
      push('bot', r.text, { links: r.links });
      speak(r.text);
      return;
    }

    setThinking(true);
    let reply: BotReply;
    if (aiEnabled) {
      try {
        reply = await (await brain()).claudeReply(clean, user?.name ?? '');
      } catch (e) {
        const local = localReply(clean);
        reply = { text: `${(await brain()).describeApiError(e)} ${local.text}`, links: local.links };
      }
    } else {
      await new Promise(r => setTimeout(r, 350 + Math.random() * 350));
      reply = localReply(clean);
    }
    setThinking(false);
    push('bot', reply.text, { links: reply.links });
    speak(reply.text);
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  // Drag the character along the edge; a click without movement opens/closes him.
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
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

  const mood: CopilotMood = thinking ? 'think' : talking ? 'talk' : bubble ? (bubble.mood ?? 'happy') : asleep && pose === 'hidden' ? 'sleep' : 'idle';
  const isOpen = pose === 'open';
  const lastBot = [...messages].reverse().find(m => m.role === 'bot');

  return (
    <div ref={rootRef} className="pointer-events-none fixed right-0 z-50" style={{ top: `${offsetY * 100}%`, transform: 'translateY(-50%)' }}>
      <div className="relative flex items-center justify-end">
        {/* Conversation */}
        <div
          role="dialog"
          aria-label="Copilot"
          aria-hidden={!isOpen}
          className={cx(
            'absolute right-[104px] top-1/2 flex max-h-[min(540px,78vh)] w-[min(360px,calc(100vw-120px))] -translate-y-1/2 origin-right flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-pop transition-all duration-200',
            isOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
          )}
        >
          <header className="flex items-center gap-2.5 border-b border-stone-100 px-3.5 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100">
              <CopilotAvatar size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight">Copilot</p>
              <p className="flex items-center gap-1.5 text-[11px] text-stone-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Dans le coin
              </p>
            </div>
            <button title="Nouvelle conversation" onClick={() => { clearHistory(); void brain().then(m => m.resetClaudeHistory()); }} className="icon-btn" tabIndex={isOpen ? 0 : -1}>
              <RotateCcw size={15} />
            </button>
            <button title="Fermer (Échap)" onClick={() => setPose('hidden')} className="icon-btn" tabIndex={isOpen ? 0 : -1}>
              <X size={16} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3.5">
            {messages.map(m => (
              <div key={m.id} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cx(
                    'max-w-[86%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-[1.5]',
                    m.role === 'user' ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md bg-stone-100 text-stone-800',
                  )}
                >
                  {m.text}
                  {m.role === 'bot' && <Extras links={m.links} offers={m.offers} onGo={go} onOffer={onOffer} disabled={m !== lastBot} />}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex w-fit gap-1 rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            )}
          </div>

          {messages.length <= 2 && (
            <div className="flex flex-wrap gap-1.5 px-3.5 pb-2.5">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => void send(s)} tabIndex={isOpen ? 0 : -1} className="h-7 rounded-full border border-stone-200 px-2.5 text-[12px] text-stone-600 transition-colors hover:bg-stone-50 hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-stone-100 p-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Écris à Copilot…"
              className="h-9 min-w-0 flex-1 rounded-lg bg-stone-50 px-3 text-[13px] outline-none placeholder:text-stone-400 focus:bg-stone-100"
              tabIndex={isOpen ? 0 : -1}
            />
            <button type="submit" disabled={!input.trim() || thinking} className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-white transition-colors hover:bg-stone-800 disabled:opacity-30" title="Envoyer" tabIndex={isOpen ? 0 : -1}>
              <ArrowUp size={16} />
            </button>
          </form>
        </div>

        {/* Spontaneous remark */}
        {bubble && !isOpen && (
          <div className="pop pointer-events-auto absolute right-[92px] top-1/2 w-[min(270px,calc(100vw-110px))] -translate-y-[85%] rounded-2xl rounded-br-sm border border-stone-200 bg-white px-3.5 py-3 text-[13px] leading-[1.5] text-stone-800 shadow-pop">
            <button onClick={clearBubble} className="absolute right-1.5 top-1.5 rounded p-1 text-stone-300 hover:text-stone-600" title="Fermer">
              <X size={12} />
            </button>
            <p className="pr-3">{bubble.text}</p>
            <Extras links={bubble.links} offers={bubble.offers} onGo={go} onOffer={onOffer} />
          </div>
        )}

        {/* The character */}
        <div
          className="pointer-events-auto cursor-pointer touch-none"
          style={{ clipPath: 'inset(-80px 0 -80px -80px)' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onMouseEnter={() => pose === 'hidden' && setPose('peek')}
          onMouseLeave={() => pose === 'peek' && !bubble && setPose('hidden')}
          title={isOpen ? 'Fermer' : 'Parler à Copilot'}
          role="button"
          aria-label="Copilot"
        >
          <Character pose={pose} look={look} blink={blink} mood={mood} size={104} />
        </div>
      </div>
    </div>
  );
}
