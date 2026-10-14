/** Kompa's mark: you (the big dot) and your friend (the small blue one), always together. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--color-ink)" />
      <circle cx="13.5" cy="16.5" r="5.5" fill="var(--color-paper)" />
      <circle cx="22" cy="12.5" r="2.75" fill="#3d63dd" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[16px] font-semibold tracking-[-0.035em]">kompa</span>
    </span>
  );
}
