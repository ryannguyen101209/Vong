/*
 * The Vòng mark: one continuous cursive stroke that loops over itself and falls
 * into a V. Drawn as a path so it stays crisp at any size and inherits colour
 * from CSS (currentColor), which is what makes it work in both themes.
 */

const MARK_PATH =
  'M 8 76 C 52 76 84 70 96 44 C 104 26 96 14 84 16 C 70 18 66 40 76 62 L 120 146 ' +
  'C 124 152 130 152 134 144 L 172 40 C 176 28 184 24 192 28';

/*
 * In the wordmark the mark is the V of "Vòng". It is drawn heavier than the
 * standalone mark so its stroke matches DM Sans Bold, and its viewBox is cropped
 * to the stroke so the bottom of the V sits on the text baseline and the top of
 * the loop lines up with the cap height.
 */
const WORD_STROKE = 20;
const WORD_TOP = 14 - WORD_STROKE / 2;
const WORD_HEIGHT = 150.5 + WORD_STROKE / 2 - WORD_TOP;

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

/** Mark inside the green rounded square, as on the app icon (follows light/dark theme). */
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
      <rect width="120" height="120" rx="28" style={{ fill: 'var(--accent)' }} />
      <g transform="translate(24.67 31.38) scale(0.3533)">
        <path
          d={MARK_PATH}
          fill="none"
          style={{ stroke: 'var(--page)' }}
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** The wordmark: the looped mark is the V, followed by "òng". Used in the header and the footer. */
export function Logo({ className = '' }) {
  return (
    <span className={`brand__word ${className}`.trim()} role="img" aria-label="Vòng">
      <svg
        className="brand__v"
        viewBox={`-10 ${WORD_TOP} 216 ${WORD_HEIGHT}`}
        aria-hidden="true"
        focusable="false"
      >
        <path
          d={MARK_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth={WORD_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span aria-hidden="true">òng</span>
    </span>
  );
}
