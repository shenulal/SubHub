interface BrandLogoProps {
  size?: number;
}

export function BrandLogo({ size = 32 }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="brand-bg"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect x="4" y="4" width="72" height="72" rx="18" fill="url(#brand-bg)" />

      {/* Layered cards — higher opacity for better visibility */}
      {/* Back card */}
      <rect
        x="18"
        y="33"
        width="24"
        height="22"
        rx="5"
        fill="rgba(255,255,255,0.30)"
        stroke="rgba(255,255,255,0.70)"
        strokeWidth="1.5"
      />
      {/* Middle card */}
      <rect
        x="26"
        y="23"
        width="24"
        height="22"
        rx="5"
        fill="rgba(255,255,255,0.55)"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="1.5"
      />
      {/* Front card (opaque white) */}
      <rect x="34" y="13" width="24" height="22" rx="5" fill="white" />

      {/* Magnifier — thicker stroke and larger size for sharper rendering */}
      <circle
        cx="51"
        cy="51"
        r="11"
        fill="none"
        stroke="white"
        strokeWidth="3.5"
      />
      <line
        x1="59"
        y1="59"
        x2="67"
        y2="67"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
