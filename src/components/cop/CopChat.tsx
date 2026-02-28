import { useRef, useEffect, useState } from 'react';
import { X, Minus, Send, Sparkles, Bot } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAppStore } from '../../store/appStore';
import type { ChatMessage } from '../../types';

// ── Response engine ──────────────────────────────────────────────────────────
function getCopResponse(input: string, currentView: string): string {
  const q = input.toLowerCase().trim();

  // Greetings
  if (/^(salut|bonjour|hello|hey|yo|cc|coucou|bjr|bonsoir|kikou|wesh|allo)/.test(q)) {
    const r = [
      "Hey hey ! 👋 Toujours là, toujours prêt !",
      "Salut l'ami ! COP à ton service 🫡",
      "Yooo ! T'as besoin de quelque chose ?",
      "Coucou ! 🤜 T'es tombé sur le bon assistant !",
      "Bien le bonjour ! Comment je peux t'aider aujourd'hui ? 😎",
    ];
    return r[Math.floor(Math.random() * r.length)];
  }

  // Notes
  if (/note|écrire|rédiger|texte|contenu|éditeur/.test(q)) {
    return "Les notes c'est mon rayon 📝 Tu peux en créer via « Notes » dans le menu gauche. Tu veux de l'aide pour structurer quelque chose ?";
  }

  // Drive / Files
  if (/fichier|dossier|drive|document|pdf|image|upload|télécharger|importer|organis/.test(q)) {
    return "Le Drive c'est là où tous tes fichiers squattent 📁 Création de dossiers, upload de docs, liaison avec tes notes — tout est possible. Un coup de main ?";
  }

  // Calendar
  if (/calendrier|événement|event|date|planning|agenda|révision|examen|cours|deadline/.test(q)) {
    return "Le Calendrier c'est mon côté organisé 📅 Événements avec priorités, liés à tes notes et fichiers. Les examens sont en violet — pratique pour paniquer avec style 😂";
  }

  // Dashboard
  if (/dashboard|tableau|accueil|home|stats|résumé|overview/.test(q)) {
    return "Le Dashboard c'est ton quartier général 🏠 Vue d'ensemble : stats, événements du jour, derniers fichiers. Tout en un coup d'œil !";
  }

  // Help
  if (/aide|help|comment|que faire|quoi faire|j'sais pas|sais pas|perdu|comprends pas|expliqu/.test(q)) {
    return "Pas de panique, je suis là ! 💪 Dis-moi ce qui te bloque — notes, calendrier, drive, n'importe quoi. Je vais t'expliquer ça simplement et efficacement.";
  }

  // Thanks
  if (/merci|thanks|thx|super|génial|cool|parfait|nickel|top|au top|trop bien|excellent/.test(q)) {
    const r = [
      "Avec plaisir ! C'est pour ça que je suis là 😎",
      "De rien mon pote ! T'as d'autres questions ?",
      "Toujours ! Je suis là quand tu veux 🤜",
      "C'est mon job et je le fais avec amour 🫶",
      "Ça fait plaisir ! Tu sais où me trouver 😄",
    ];
    return r[Math.floor(Math.random() * r.length)];
  }

  // Humor
  if (/blague|joke|drôle|rigolo|humour|rire|marrant/.test(q)) {
    const r = [
      "Pourquoi les devs aiment le noir ? Parce que la lumière attire les bugs 🐛😂",
      "Qu'est-ce qu'un informaticien fait quand il a froid ? Il ferme les fenêtres 😏",
      "J'aurais voulu faire une blague sur le cloud... mais je risque de passer par-dessus ta tête ☁️😂",
    ];
    return r[Math.floor(Math.random() * r.length)];
  }

  // Who are you
  if (/qui es|c'est quoi|qu'est.ce|kesté|tu fais quoi|t'es quoi|présente/.test(q)) {
    return "Je suis COP, ton assistant IA intégré dans COP-PILOT ! 🤖 Mon job : t'aider à être plus efficace, te proposer des actions utiles, et rester sympa en toutes circonstances. Et franchement, je fais ça avec classe 😎";
  }

  // Productivity tips
  if (/astuce|conseil|tip|productif|efficace|mieux travailler/.test(q)) {
    const r = [
      "Astuce pro 💡 : Lie tes notes à tes événements du calendrier pour retrouver facilement les cours liés à un exam !",
      "Astuce du jour 🚀 : Crée des dossiers thématiques dans le Drive et ajoute une note d'index dans chacun. T'auras tout bien rangé !",
      "Tip de COP 🎯 : Utilise la recherche globale en haut pour trouver n'importe quoi en un clic, même dans tes notes et fichiers !",
    ];
    return r[Math.floor(Math.random() * r.length)];
  }

  // Navigation help
  if (/aller|naviguer|ouvrir|accéder|voir|afficher|trouver/.test(q)) {
    return "Pour naviguer : utilise le menu à gauche ! Dashboard, Drive, Calendrier et Notes — chaque section a ses outils. Tu cherches quelque chose de particulier ? 🧭";
  }

  // Context-aware fallback
  const contextResponses: Record<string, string[]> = {
    notes: [
      "Je vois que t'es sur les Notes ! Tu veux de l'aide pour organiser ton contenu ? 📝",
      "Notes, notes, notes... j'adore ! Tu cherches à créer quelque chose de particulier ?",
      "T'es sur la bonne page pour rédiger ! Dis-moi si tu veux de l'aide.",
    ],
    drive: [
      "Le Drive est là ! Tu cherches un fichier ou tu veux créer quelque chose ? 📁",
      "Organisation du Drive — mon truc ! T'as besoin de structurer tes dossiers ?",
      "Beau Drive bien rangé ! T'as besoin de quelque chose de particulier ?",
    ],
    calendar: [
      "Le Calendrier — j'aime garder un œil sur les dates 📅 Un événement à ajouter ?",
      "Planning en cours ! Tu veux de l'aide pour gérer tes échéances ?",
      "Le temps c'est précieux — bonne idée de le gérer avec soin ! Je peux t'aider ?",
    ],
    dashboard: [
      "Vue d'ensemble activée 👀 Tout va bien ? T'as besoin de naviguer quelque part ?",
      "Le Dashboard c'est le quartier général 🎯 Tu veux qu'on regarde quelque chose ensemble ?",
      "Belle vue d'ensemble ! Tu veux des astuces pour mieux organiser ton espace ?",
    ],
  };

  const ctxR = contextResponses[currentView] || [];
  const fallbacks = [
    "Hmm, je suis pas sûr de bien capter... Tu peux reformuler ? 🤔",
    "Je capte pas encore tout — dis-moi autrement et je fais de mon mieux !",
    "Bonne question... mais là tu me perds 😅 Donne-moi un peu plus de contexte !",
    "Je suis intelligent, mais pas devin 😂 Tu veux dire quoi exactement ?",
    "Intéressant comme question ! Mais j'ai besoin de plus d'infos pour t'aider correctement 🧐",
  ];

  const all = [...ctxR, ...fallbacks];
  return all[Math.floor(Math.random() * all.length)];
}

// ── COP Logo ─────────────────────────────────────────────────────────────────
function CopLogo({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 10px rgba(99,102,241,0.45)',
        flexShrink: 0,
      }}
    >
      <Bot size={Math.round(size * 0.52)} color="white" strokeWidth={2} />
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 7,
        marginBottom: 10,
        animation: 'fadeUp 0.2s ease forwards',
      }}
    >
      {!isUser && <CopLogo size={24} />}
      <div
        style={{
          maxWidth: '76%',
          padding: '9px 13px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser
            ? 'linear-gradient(135deg, #6366f1, #a855f7)'
            : 'rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.92)',
          fontSize: 13,
          lineHeight: 1.55,
          border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
          wordBreak: 'break-word',
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, marginBottom: 10 }}>
      <CopLogo size={24} />
      <div
        style={{
          padding: '10px 14px',
          borderRadius: '16px 16px 16px 4px',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: 5,
          alignItems: 'center',
        }}
      >
        {[0, 0.2, 0.4].map((delay, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'rgba(129,140,248,0.8)',
              animation: `typingDot 1.1s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Chat Widget ──────────────────────────────────────────────────────────
export default function CopChat() {
  const {
    messages, isOpen, unreadCount, isTyping,
    addMessage, toggleChat, markAsRead, setTyping,
  } = useChatStore();
  const { view } = useAppStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input & mark read when chat opens
  useEffect(() => {
    if (isOpen) {
      markAsRead();
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen, markAsRead]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMessage('user', text);

    setTyping(true);
    const delay = 500 + Math.random() * 900;
    setTimeout(() => {
      setTyping(false);
      addMessage('cop', getCopResponse(text, view));
    }, delay);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Chat panel ── */}
      {isOpen && (
        <div
          className="animate-chatSlideUp"
          style={{
            position: 'fixed',
            bottom: 92,
            right: 24,
            width: 340,
            maxHeight: 490,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 20,
            overflow: 'hidden',
            background: 'rgba(14,14,26,0.98)',
            border: '1px solid rgba(99,102,241,0.28)',
            boxShadow: '0 28px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.08)',
            backdropFilter: 'blur(32px)',
            zIndex: 60,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '13px 14px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(168,85,247,0.08))',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            <CopLogo size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
                  COP
                </span>
                <Sparkles size={11} color="#a78bfa" />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                Ton copilote perso ✨
              </div>
            </div>
            <button
              onClick={toggleChat}
              title="Réduire"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.45)',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            >
              <Minus size={13} />
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 13px 6px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexShrink: 0,
              background: 'rgba(0,0,0,0.15)',
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Envoie un message..."
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '8px 12px',
                fontSize: 13,
                color: '#f1f5f9',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.55)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              title="Envoyer"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: input.trim()
                  ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                  : 'rgba(255,255,255,0.07)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'all 0.2s',
                boxShadow: input.trim() ? '0 4px 14px rgba(99,102,241,0.4)' : 'none',
              }}
            >
              <Send size={15} color={input.trim() ? 'white' : 'rgba(255,255,255,0.28)'} />
            </button>
          </div>
        </div>
      )}

      {/* ── Toggle button (always visible) ── */}
      <button
        onClick={toggleChat}
        title={isOpen ? 'Fermer COP' : 'Ouvrir COP'}
        className={!isOpen ? 'animate-copPulse' : ''}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 61,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.65)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        {isOpen ? (
          <X size={22} color="white" strokeWidth={2.5} />
        ) : (
          <>
            <Bot size={24} color="white" strokeWidth={2} />
            {/* Unread badge */}
            {unreadCount > 0 && (
              <div
                className="animate-badgePop"
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  background: '#ef4444',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  border: '2px solid #0e0e1a',
                  lineHeight: 1,
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </>
        )}
      </button>
    </>
  );
}
