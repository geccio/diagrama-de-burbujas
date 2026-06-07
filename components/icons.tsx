// Inline SVG icon set (Lucide-style, consistent 1.75 stroke width).
// Replaces emoji icons for crisp, theme-able, professional rendering.

import type { SVGProps } from "react";

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function svgProps({ size, ...rest }: IconProps) {
  return { ...base, ...(size ? { width: size, height: size } : {}), ...rest };
}

/** Cursor / select-move arrow. */
export function IconCursor(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="m4 4 7.07 17 2.51-7.39L21 11.07z" />
    </svg>
  );
}

/** Link / connect. */
export function IconLink(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/** Ruler / measure. */
export function IconRuler(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
      <path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2" />
    </svg>
  );
}

/** Upload. */
export function IconUpload(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

/** Download. */
export function IconDownload(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

/** Plus. */
export function IconPlus(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Close / X. */
export function IconX(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Trash / delete. */
export function IconTrash(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/** Rotate / reset. */
export function IconReset(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

/** Save to disk (floppy). */
export function IconSave(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}

/** Open folder. */
export function IconFolderOpen(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M6 14l1.5-3.5A2 2 0 0 1 9.3 9H20a1 1 0 0 1 1 1.2l-1.3 6A2 2 0 0 1 17.8 18H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.7.9l.8 1.2a2 2 0 0 0 1.7.9H18a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** File spreadsheet (upload empty state / dialog). */
export function IconSpreadsheet(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}

/** Bubbles brand mark (two overlapping circles). */
export function IconBubbles(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <circle cx="9" cy="13" r="6" />
      <circle cx="17" cy="8" r="3.5" />
    </svg>
  );
}

/** Layers / floors (stacked sheets). */
export function IconLayers(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </svg>
  );
}

/** Sparkles (AI). */
export function IconSparkles(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
    </svg>
  );
}

/** Grid / matrix table. */
export function IconMatrix(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

/** Undo (curved arrow left). */
export function IconUndo(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

/** Redo (curved arrow right). */
export function IconRedo(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9a6 6 0 0 0 0 12h3" />
    </svg>
  );
}

/** Layout / auto-arrange (grid of dots). */
export function IconArrange(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/** Eraser (clear drawings). */
export function IconEraser(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="m7 21-4-4a2 2 0 0 1 0-2.8L13.5 3.7a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L11 20" />
      <path d="M22 21H7M5 12l6 6" />
    </svg>
  );
}

/** Calibrate / target (set scale from known length). */
export function IconCalibrate(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

/** Maximize / zoom-to-fit. */
export function IconFit(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

/** Sun (light mode). */
export function IconSun(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Moon (dark mode). */
export function IconMoon(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/** Image / picture. */
export function IconImage(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.5-4.5L5 21" />
    </svg>
  );
}

/** Lock (closed). */
export function IconLock(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** Lock (open). */
export function IconUnlock(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.9-1" />
    </svg>
  );
}

/** Warning triangle. */
export function IconWarning(props: IconProps) {
  return (
    <svg {...svgProps(props)} aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
