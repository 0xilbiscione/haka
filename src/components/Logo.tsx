export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="haka-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ee7d8" />
          <stop offset="1" stopColor="#8b9cff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#haka-g)" />
      <path d="M14 42 26 30l8 7 16-17" stroke="#04121a" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="20" r="4" fill="#04121a" />
    </svg>
  );
}
