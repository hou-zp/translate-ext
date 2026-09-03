type P = { className?: string };

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 品牌标识：文 / A 双气泡交叠 */
export function Logo({ className = "h-7 w-7" }: P) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="3" y="5" width="24" height="19" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 24v5l5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <text x="15" y="19" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" fontFamily="'Noto Serif SC',serif">
        文
      </text>
      <rect x="15" y="17" width="22" height="18" rx="5" fill="#0b0d10" stroke="#d5482f" strokeWidth="2" />
      <text x="26" y="30.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#d5482f" fontFamily="'IBM Plex Mono',monospace">
        A
      </text>
    </svg>
  );
}

export function IconBilingual({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M4 6h16M4 10h10" />
      <path d="M4 15h16M4 19h12" opacity=".45" />
      <path d="M19 13.5v7M16.5 16h5" opacity=".9" />
    </svg>
  );
}

export function IconHover({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M5 4l6.5 15 2-6 6-2.2z" />
      <path d="M14 15l5 5" />
      <path d="M4 9h6M4 12h4" opacity=".45" />
    </svg>
  );
}

export function IconInput({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <path d="M7 11h.01M11 11h.01M15 11h.01M8 14.5h8" />
      <path d="M19 3.5v3M17.5 5h3" opacity=".7" />
    </svg>
  );
}

export function IconSelect({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M4 6h16M4 18h16" opacity=".4" />
      <rect x="6" y="9.5" width="12" height="5" rx="1" fill="currentColor" fillOpacity=".18" />
      <path d="M6 9.5h12v5H6z" />
    </svg>
  );
}

export function IconShield({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </svg>
  );
}

export function IconRoute({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <circle cx="5.5" cy="6" r="2.2" />
      <circle cx="18.5" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M7.7 6h8.6M6.5 8l4 8M17.5 8l-4 8" opacity=".7" />
    </svg>
  );
}

export function IconSliders({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="17" r="2" />
    </svg>
  );
}

export function IconCopy({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 012-2h9" />
    </svg>
  );
}

export function IconCheck({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function IconClose({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconLock({ className = "h-3.5 w-3.5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  );
}

export function IconReload({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M20 12a8 8 0 11-2.34-5.66" />
      <path d="M20 4v4h-4" />
    </svg>
  );
}

export function IconBack({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function IconPlus({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconSpark({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M12 3l1.8 5.6L19.5 10l-5.7 1.4L12 17l-1.8-5.6L4.5 10l5.7-1.4z" />
      <path d="M18.5 16.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" opacity=".7" />
    </svg>
  );
}

export function IconPin({ className = "h-3.5 w-3.5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M9 4h6l-1 7 3 3v2H7v-2l3-3z" />
      <path d="M12 16v5" />
    </svg>
  );
}

export function IconArrowDown({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M12 4v16M5.5 13.5L12 20l6.5-6.5" />
    </svg>
  );
}

export function IconGear({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8l1.2 2.6 2.8-.6 1 2.7 2.8.8-.6 2.8 2 2-2 2 .6 2.8-2.8.8-1 2.7-2.8-.6L12 21.2l-1.2-2.6-2.8.6-1-2.7-2.8-.8.6-2.8-2-2 2-2-.6-2.8 2.8-.8 1-2.7 2.8.6z" />
    </svg>
  );
}

export function IconPanelRight({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M15 4.5v15" />
      <path d="M17.5 9h1.5M17.5 12h1.5" opacity=".7" />
    </svg>
  );
}

export function IconBall({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" fill="currentColor" fillOpacity=".25" />
      <path d="M12 4a8 8 0 010 16" opacity=".5" />
    </svg>
  );
}

export function IconCaption({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 12h4M7 15h7M13 12h4" />
    </svg>
  );
}

export function IconImage({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M4 17l5-4.5 4 3.5 3.5-3 3.5 3" />
    </svg>
  );
}

export function IconKeyboard({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <rect x="2.5" y="7" width="19" height="10.5" rx="2" />
      <path d="M6 10.5h.01M9.5 10.5h.01M13 10.5h.01M16.5 10.5h.01M6 13.8h.01M18 10.5h.01M18 13.8h.01M9 13.8h6" />
    </svg>
  );
}

export function IconDb({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </svg>
  );
}

export function IconInfo({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </svg>
  );
}

export function IconBot({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <rect x="4.5" y="8" width="15" height="10.5" rx="3" />
      <path d="M12 8V4.8M12 4.8a1.4 1.4 0 10-.01 0z" />
      <path d="M9.3 12.6h.01M14.7 12.6h.01M9.5 15.6h5" />
    </svg>
  );
}

export function IconBook({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15.5H6.5A2.5 2.5 0 004 21z" />
      <path d="M4 18.5A2.5 2.5 0 016.5 16H20" />
      <path d="M9 7.5h7M9 10.5h5" opacity=".7" />
    </svg>
  );
}

export function IconGlobe({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...S}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5s1.2-6.2 3.6-8.5z" />
    </svg>
  );
}

export function IconPlay({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

export function IconPause({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
      <rect x="7" y="5.5" width="3.4" height="13" rx="1" />
      <rect x="13.6" y="5.5" width="3.4" height="13" rx="1" />
    </svg>
  );
}
