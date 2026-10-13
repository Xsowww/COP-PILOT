export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--color-ink)" />
      <path d="M8 17.5 24 9l-5.2 15-3.6-5.6L8 17.5Z" fill="var(--color-paper)" />
      <path d="m15.2 18.4 3.6-4.4" stroke="var(--color-ink)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="24" cy="9" r="2.2" fill="var(--color-brand-500)" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">
        cop<span className="text-stone-500">·</span>pilot
      </span>
    </span>
  );
}
