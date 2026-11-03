import type { SVGProps } from "react";
import { cx } from "@/lib/utils/cx";

// Single outline set, 1.75 stroke, 24px grid (DESIGN.md §5.5). Platform glyphs
// are custom marks drawn to the same weight, never brand logos.
const PATHS = {
  today: ["M4 11.5 12 5l8 6.5", "M6 10v9h12v-9", "M10 19v-5h4v5"],
  calendar: [
    "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z",
    "M4 10h16",
    "M8 3v4",
    "M16 3v4",
  ],
  "calendar-plus": [
    "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5",
    "M4 7v12a2 2 0 0 0 2 2h6",
    "M4 10h16",
    "M8 3v4",
    "M16 3v4",
    "M18 15v6",
    "M15 18h6",
  ],
  create: ["M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z", "M13.5 6.5l4 4"],
  archive: ["M4 5h16v4H4Z", "M5 9v10h14V9", "M10 13h4"],
  settings: [
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12Z",
  ],
  check: ["M5 12.5 10 17l9-10"],
  lock: ["M6 10h12v10H6Z", "M8 10V7a4 4 0 0 1 8 0v3", "M12 14v3"],
  shield: ["M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6Z", "M9 12l2 2 4-4"],
  "check-circle": ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 12.5l3 3 5-6"],
  alert: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M12 7.5v5.5",
    "M12 16.5v.01",
  ],
  close: ["M6 6l12 12", "M18 6 6 18"],
  "chevron-left": ["M15 5l-7 7 7 7"],
  "chevron-right": ["M9 5l7 7-7 7"],
  copy: ["M9 9h10v11H9Z", "M5 15V4h10"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  "plus-circle": [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M12 8v8",
    "M8 12h8",
  ],
  sparkle: [
    "M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z",
    "M19 16v4",
    "M17 18h4",
  ],
  layers: ["M12 4 3 9l9 5 9-5Z", "M3 14l9 5 9-5"],
  filter: ["M4 6h16", "M7 12h10", "M10 18h4"],
  "cloud-off": [
    "M4 4l16 16",
    "M8.5 8.6A5 5 0 0 0 7 18h10",
    "M11 6.2A5 5 0 0 1 17 9.5a4 4 0 0 1 3 5.8",
  ],
  image: [
    "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z",
    "M4 16l5-5 4 4 2-2 5 5",
    "M15.5 9.5v.01",
  ],
  "external-link": [
    "M14 4h6v6",
    "M20 4l-9 9",
    "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  ],
  refresh: [
    "M20 11a8 8 0 0 0-14.7-4.3L4 8",
    "M4 4v4h4",
    "M4 13a8 8 0 0 0 14.7 4.3L20 16",
    "M20 20v-4h-4",
  ],
  instagram: [
    "M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z",
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M16.8 7.2v.01",
  ],
  linkedin: [
    "M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    "M8 11v5",
    "M8 8v.01",
    "M12 16v-5",
    "M12 13a2 2 0 0 1 4 0v3",
  ],
  whatsapp: ["M4 20l1.3-3.9A8 8 0 1 1 8 19Z", "M9 10c0 2.5 2.5 5 5 5"],
  // Generic platform glyphs for catalogue platforms without a custom mark.
  platform: [
    "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z",
    "M10.5 8 9.5 16",
    "M14.5 8l-1 8",
    "M8 10.5h8",
    "M7.5 13.5h8",
  ],
  globe: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M3 12h18",
    "M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9Z",
  ],
  video: [
    "M4 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z",
    "M16 10l4-2.5v9L16 14",
  ],
  chat: [
    "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  ],
  briefcase: [
    "M4 8h16v11H4Z",
    "M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2",
    "M4 13h16",
  ],
  megaphone: [
    "M4 10v4h3l8 4V6l-8 4Z",
    "M18 9.5a3 3 0 0 1 0 5",
    "M7 14l1.5 5H11l-1-4.5",
  ],
  carousel: ["M7 6h10v12H7Z", "M4 8v8", "M20 8v8"],
  reel: [
    "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z",
    "M4 9h16",
    "M8 4l2 5",
    "M13 4l2 5",
    "M10.5 12.5v4l3.5-2Z",
  ],
  post: ["M5 5h14v14H5Z", "M8 15l3-3 2 2 3-3"],
  story: [
    "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
    "M10 6h4",
  ],
  meme: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M8 14a4.5 4.5 0 0 0 8 0",
    "M9 9.5v.01",
    "M15 9.5v.01",
  ],
  poll: ["M5 20V10", "M12 20V4", "M19 20v-7"],
} as const;

export type IconName = keyof typeof PATHS;

export const ICON_NAMES = Object.keys(PATHS) as IconName[];

const SIZES = {
  chip: "size-5",
  default: "size-6",
  nav: "size-7",
  empty: "size-8",
  spinner: "size-4",
} as const;

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: IconName;
  size?: keyof typeof SIZES;
  /** Provide only when the icon carries meaning on its own. */
  label?: string;
};

export function Icon({
  name,
  size = "default",
  label,
  className,
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("shrink-0", SIZES[size], className)}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
      focusable="false"
      {...props}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
