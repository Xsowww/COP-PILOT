import type { CopilotPose } from '../store/copilot';

interface Props {
  pose: CopilotPose;
  look: { x: number; y: number }; // -1..1
  blink: boolean;
  mood: 'idle' | 'talk' | 'think' | 'happy';
}

// Copilot is drawn facing left, hiding behind the right edge of the screen.
// The fingers stay on the edge; the head slides and tilts out depending on `pose`.
const HEAD_TRANSFORM: Record<CopilotPose, string> = {
  hidden: 'translate(118px, 6px) rotate(-22deg)',
  peek: 'translate(46px, 0px) rotate(-14deg)',
  open: 'translate(8px, 0px) rotate(-4deg)',
};

export default function Character({ pose, look, blink, mood }: Props) {
  const px = look.x * 3.2;
  const py = look.y * 2.6;

  return (
    <svg viewBox="0 0 160 180" width="160" height="180" className="overflow-visible select-none" aria-hidden>
      <defs>
        <linearGradient id="cop-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="cop-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#312e81" />
        </linearGradient>
        <radialGradient id="cop-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
        <filter id="cop-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="-3" dy="6" stdDeviation="6" floodColor="#4338ca" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* Head */}
      <g
        style={{
          transform: HEAD_TRANSFORM[pose],
          transformOrigin: '150px 95px',
          transition: 'transform 520ms cubic-bezier(.34,1.56,.64,1)',
        }}
        filter="url(#cop-shadow)"
      >
        <g className={mood === 'think' ? 'cop-bob-fast' : 'cop-bob'}>
          {/* antenna */}
          <line x1="82" y1="44" x2="78" y2="20" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
          <circle cx="78" cy="16" r="7" fill="url(#cop-glow)" className="cop-antenna" />
          {/* ears */}
          <rect x="22" y="78" width="14" height="30" rx="7" fill="#818cf8" />
          <rect x="126" y="78" width="14" height="30" rx="7" fill="#818cf8" />
          {/* skull */}
          <circle cx="81" cy="93" r="52" fill="url(#cop-skin)" />
          <ellipse cx="62" cy="62" rx="16" ry="8" fill="white" opacity="0.25" transform="rotate(-25 62 62)" />
          {/* face screen */}
          <rect x="44" y="68" width="74" height="52" rx="24" fill="url(#cop-face)" />
          {/* eyes */}
          <g style={{ transform: `scaleY(${blink ? 0.1 : 1})`, transformOrigin: '81px 92px', transition: 'transform 90ms' }}>
            {mood === 'happy' ? (
              <>
                <path d={`M${58 + px} ${94 + py} q7 -9 14 0`} stroke="#67e8f9" strokeWidth="4" fill="none" strokeLinecap="round" />
                <path d={`M${90 + px} ${94 + py} q7 -9 14 0`} stroke="#67e8f9" strokeWidth="4" fill="none" strokeLinecap="round" />
              </>
            ) : (
              <>
                <ellipse cx={65 + px} cy={91 + py} rx="7.5" ry="9.5" fill="#67e8f9" />
                <ellipse cx={97 + px} cy={91 + py} rx="7.5" ry="9.5" fill="#67e8f9" />
                <circle cx={62.5 + px} cy={87.5 + py} r="2.4" fill="white" />
                <circle cx={94.5 + px} cy={87.5 + py} r="2.4" fill="white" />
              </>
            )}
          </g>
          {/* mouth */}
          {mood === 'talk' ? (
            <ellipse cx={81 + px * 0.5} cy="109" rx="5" ry="3.5" fill="#67e8f9" className="cop-talk" />
          ) : mood === 'think' ? (
            <line x1={75 + px * 0.5} y1="110" x2={87 + px * 0.5} y2="108" stroke="#67e8f9" strokeWidth="3" strokeLinecap="round" />
          ) : (
            <path d={`M${74 + px * 0.5} 107 q7 6 14 0`} stroke="#67e8f9" strokeWidth="3" fill="none" strokeLinecap="round" />
          )}
          {/* cheeks */}
          <circle cx="40" cy="112" r="6" fill="#f472b6" opacity="0.45" />
          <circle cx="122" cy="112" r="6" fill="#f472b6" opacity="0.35" />
        </g>
      </g>

      {/* Fingers gripping the screen edge (always visible) */}
      <g style={{ transform: pose === 'hidden' ? 'translateX(4px)' : 'translateX(0)', transition: 'transform 300ms' }}>
        {[46, 132].map((y, hand) => (
          <g key={y} className={hand === 0 ? 'cop-tap' : undefined}>
            {[0, 11, 22].map(dy => (
              <rect key={dy} x="138" y={y + dy} width="26" height="10" rx="5" fill="url(#cop-skin)" stroke="#4f46e5" strokeOpacity="0.25" />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
