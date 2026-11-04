export function IdMark({ className = "h-4 w-10 shrink-0 sm:h-5 sm:w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" className={className} aria-hidden="true">
      <rect width="48" height="16" rx="2" fill="#121416" />
      <rect x="2" y="3" width="44" height="10" rx="1" fill="#ecece8" />
      <rect x="2" y="7" width="44" height="2" fill="#1a1c22" />
      <rect width="7" height="16" fill="#9bb6d4" />
    </svg>
  );
}
