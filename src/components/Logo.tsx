export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#3ddc84" />
        <rect x="6" y="7" width="20" height="18" rx="2" fill="none" stroke="#04210f" strokeWidth="2" />
        <line x1="16" y1="7" x2="16" y2="25" stroke="#04210f" strokeWidth="2" />
        <circle cx="16" cy="16" r="3.5" fill="none" stroke="#04210f" strokeWidth="2" />
        <circle cx="11" cy="12" r="1.6" fill="#04210f" />
        <circle cx="21" cy="20" r="1.6" fill="#ffd23f" />
      </svg>
      {!compact && <span className="font-display text-xl font-bold uppercase tracking-wider">Prancheta <span className="text-[var(--color-accent)]">FC</span></span>}
    </span>
  );
}
