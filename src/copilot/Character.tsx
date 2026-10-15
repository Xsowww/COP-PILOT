import { useId } from 'react';
import type { CopilotPose } from '../store/copilot';

export type CopilotMood = 'idle' | 'happy' | 'talk' | 'think' | 'alert' | 'sleep';

interface Props {
  pose: CopilotPose;
  look?: { x: number; y: number }; // -1..1
  blink?: boolean;
  mood?: CopilotMood;
  size?: number;
}

const INK = '#16181d';
const ORANGE = 'var(--color-brand-500)'; // follows the accent colour chosen in settings

// Kompaly is a small round character wearing a pilot headset. He hides behind the
// right edge of the screen: his hands hold the edge, his head slides out.
const HEAD: Record<CopilotPose, string> = {
  hidden: 'translate(74px, 4px) rotate(-18deg)',
  peek: 'translate(30px, 0px) rotate(-11deg)',
  open: 'translate(4px, 0px) rotate(-3deg)',
};

function Eyes({ mood, x, y, blink }: { mood: CopilotMood; x: number; y: number; blink: boolean }) {
  const L = { cx: 47 + x, cy: 66 + y };
  const R = { cx: 67 + x, cy: 66 + y };
  if (mood === 'happy') {
    return (
      <g stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d={`M${L.cx - 4.5} ${L.cy + 1.5} q4.5 -6 9 0`} />
        <path d={`M${R.cx - 4.5} ${R.cy + 1.5} q4.5 -6 9 0`} />
      </g>
    );
  }
  if (mood === 'sleep' || blink) {
    return (
      <g stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d={`M${L.cx - 4} ${L.cy} q4 3 8 0`} />
        <path d={`M${R.cx - 4} ${R.cy} q4 3 8 0`} />
      </g>
    );
  }
  const ry = mood === 'alert' ? 7 : 6;
  return (
    <g>
      <ellipse cx={L.cx} cy={L.cy} rx="4.6" ry={ry} fill={INK} />
      <ellipse cx={R.cx} cy={R.cy} rx="4.6" ry={ry} fill={INK} />
      <circle cx={L.cx - 1.5} cy={L.cy - 2.4} r="1.6" fill="#fff" />
      <circle cx={R.cx - 1.5} cy={R.cy - 2.4} r="1.6" fill="#fff" />
    </g>
  );
}

function Mouth({ mood, x }: { mood: CopilotMood; x: number }) {
  const cx = 57 + x * 0.6;
  switch (mood) {
    case 'talk':
      return <ellipse cx={cx} cy="80" rx="3.6" ry="3.2" fill={INK} className="cop-talk" />;
    case 'alert':
      return <circle cx={cx} cy="80.5" r="2.6" fill="none" stroke={INK} strokeWidth="2.2" />;
    case 'think':
      return <path d={`M${cx - 3} 80 h6`} stroke={INK} strokeWidth="2.2" strokeLinecap="round" />;
    case 'sleep':
      return <ellipse cx={cx} cy="80" rx="2" ry="1.6" fill={INK} />;
    case 'happy':
      return <path d={`M${cx - 5} 77.5 q5 6 10 0 z`} fill={INK} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />;
    default:
      return <path d={`M${cx - 4} 78 q4 3.6 8 0`} stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />;
  }
}

function Hand({ y }: { y: number }) {
  // three little fingers curled over the edge
  return (
    <g>
      {[0, 7.5, 15].map(dy => (
        <rect key={dy} x="106" y={y + dy} width="20" height="8" rx="4" fill="#fff" stroke={INK} strokeWidth="2.2" />
      ))}
    </g>
  );
}

export default function Character({ pose, look = { x: -1, y: 0 }, blink = false, mood = 'idle', size = 112 }: Props) {
  const lx = mood === 'think' ? -1.6 : look.x * 2.4;
  const ly = mood === 'think' ? -2.2 : look.y * 2;
  const shadowId = `cop-shadow-${useId().replace(/[^\w-]/g, '')}`; // several Copilots can be on screen

  return (
    <svg viewBox="0 0 124 140" width={size} height={(size * 140) / 124} className="overflow-visible select-none" aria-hidden>
      <defs>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="-1.5" dy="3" stdDeviation="3" floodColor="#1c1b19" floodOpacity="0.16" />
        </filter>
      </defs>

      <g style={{ transform: HEAD[pose], transformOrigin: '118px 72px', transition: 'transform 480ms cubic-bezier(.34,1.45,.64,1)' }}>
        <g filter={`url(#${shadowId})`}className={mood === 'alert' ? 'cop-bounce' : 'cop-breathe'}>
          <g className={mood === 'alert' ? 'cop-wiggle' : undefined}>
            {/* headset band (behind the head) */}
            <path d="M94 66 C 96 30, 52 18, 30 44" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
            <path d="M94 66 C 96 30, 52 18, 30 44" fill="none" stroke={ORANGE} strokeWidth="4.6" strokeLinecap="round" />

            {/* head */}
            <rect x="20" y="32" width="80" height="74" rx="36" fill="#fff" stroke={INK} strokeWidth="2.6" />
            <path d="M30 56 q4 -16 20 -19" stroke="#ece9e3" strokeWidth="4" strokeLinecap="round" fill="none" />

            {/* cheeks */}
            <ellipse cx={39 + lx * 0.5} cy="77" rx="5.2" ry="3.2" fill="#f6a99a" opacity="0.75" />
            <ellipse cx={76 + lx * 0.5} cy="77" rx="5.2" ry="3.2" fill="#f6a99a" opacity="0.6" />

            <Eyes mood={mood} x={lx} y={ly} blink={blink} />
            <Mouth mood={mood} x={lx} />

            {/* ear cup + microphone */}
            <path d="M95 76 C 94 90, 82 96, 70 94" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="69" cy="94" r="3.6" fill={ORANGE} stroke={INK} strokeWidth="2" />
            <rect x="88" y="58" width="17" height="24" rx="8.5" fill={ORANGE} stroke={INK} strokeWidth="2.6" />
            <rect x="92.5" y="63" width="3" height="13" rx="1.5" fill="#fff" opacity="0.55" />

            {mood === 'sleep' && (
              <g fill={INK} fontFamily="Geist, sans-serif" fontWeight="700">
                <text x="26" y="34" fontSize="11" className="cop-z">z</text>
                <text x="18" y="26" fontSize="8" className="cop-z" style={{ animationDelay: '1.1s' }}>z</text>
              </g>
            )}
            {mood === 'think' && (
              <g fill={INK}>
                <circle cx="18" cy="38" r="2.4" opacity="0.35" />
                <circle cx="11" cy="29" r="3" opacity="0.55" />
              </g>
            )}
          </g>
        </g>
      </g>

      {/* hands holding the edge of the screen */}
      <g className="cop-tap">
        <Hand y={30} />
      </g>
      <Hand y={92} />
    </svg>
  );
}

/** Small face used as an avatar in the conversation panel. */
export function CopilotAvatar({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="16 26 96 86" width={size} height={size} aria-hidden>
      <path d="M94 66 C 96 30, 52 18, 30 44" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M94 66 C 96 30, 52 18, 30 44" fill="none" stroke={ORANGE} strokeWidth="4.6" strokeLinecap="round" />
      <rect x="20" y="32" width="80" height="74" rx="36" fill="#fff" stroke={INK} strokeWidth="3" />
      <ellipse cx="45" cy="66" rx="4.8" ry="6.2" fill={INK} />
      <ellipse cx="65" cy="66" rx="4.8" ry="6.2" fill={INK} />
      <path d="M51 78 q4 3.6 8 0" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <ellipse cx="37" cy="77" rx="5" ry="3" fill="#f6a99a" opacity="0.75" />
      <rect x="88" y="58" width="17" height="24" rx="8.5" fill={ORANGE} stroke={INK} strokeWidth="3" />
    </svg>
  );
}
