const PATHS = {
  close: ['M18 6L6 18M6 6l12 12'],
  search: ['M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'],
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
  directions: ['M21 10V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8', 'M17 14L21 18M5 14L1 18M12 2v12'],
  link: ['M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'],
  pin: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z', 'M12 7a3 3 0 100 6 3 3 0 000-6z'],
  swap: ['M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3'],
  locate: ['M12 9a3 3 0 100 6 3 3 0 000-6z', 'M12 2v2M12 20v2M2 12h2M20 12h2'],
  home: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  list: ['M4 6h16M4 12h16M4 18h16'],
} as const;

export type IconName = keyof typeof PATHS;

/** Small stroke icon (24x24 grid). Decorative: hidden from assistive tech. */
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
