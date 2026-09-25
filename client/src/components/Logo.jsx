/*
 * The Vòng mark: one continuous cursive stroke that loops over itself and falls
 * into a V. Drawn as a path so it stays crisp at any size and inherits colour
 * from CSS (currentColor).
 */

const MARK_PATH =
  'M 8 76 C 52 76 84 70 96 44 C 104 26 96 14 84 16 C 70 18 66 40 76 62 L 120 146 ' +
  'C 124 152 130 152 134 144 L 172 40 C 176 28 184 24 192 28';

export function LogoMark({ size = 32, className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 170"
      width={size}
      height={(size * 170) / 200}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={MARK_PATH}
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark inside the blue rounded square, as on the app icon. */
export function LogoTile({ size = 56, className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="120" height="120" rx="28" fill="#1463F3" />
      <g transform="translate(24.67 31.38) scale(0.3533)">
        <path
          d={MARK_PATH}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Mark plus the wordmark, used in the header and the footer. */
export function Logo({ size = 30 }) {
  return (
    <>
      <LogoMark size={size} />
      <span className="brand__word">Vòng</span>
    </>
  );
}
