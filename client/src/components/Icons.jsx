/* Inline icons, sized by the CSS around them. All decorative. */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

export const HeartIcon = ({ filled = false, size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.5s-7.5-4.6-7.5-9.7a4.3 4.3 0 0 1 7.5-2.9 4.3 4.3 0 0 1 7.5 2.9c0 5.1-7.5 9.7-7.5 9.7Z" />
  </svg>
);

export const SearchIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const PlusIcon = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ArrowLeftIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
  </svg>
);

export const MenuIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const CloseIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const SunIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </svg>
);

export const MoonIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <path d="M20 14.3A8.2 8.2 0 0 1 9.7 4a8.3 8.3 0 1 0 10.3 10.3Z" />
  </svg>
);

export const BoxIcon = ({ size = 64 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z" />
    <path d="m3 8.5 9 4.5 9-4.5M12 13v7" />
  </svg>
);

export const PhoneIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6.5 3Z" />
  </svg>
);

export const CheckIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);
