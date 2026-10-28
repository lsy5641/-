export default function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="JobCoach 标志" className="brand-logo">
      <rect width="32" height="32" rx="9" fill="#0a0a0a" />
      <path
        d="M20.6 8.6v9.6a4.2 4.2 0 0 1-4.2 4.2h-.7a4.2 4.2 0 0 1-4.2-4.2"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="24.4" cy="9" r="1.45" fill="#ffffff" />
    </svg>
  );
}