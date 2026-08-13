import type { ReactNode } from "react";

// docs/primitive-inventory.md flags "inline technical icon" (13 uses) as
// needing a semantic registry — an unknown IconName is now a compile error
// instead of a silently-blank glyph. The original 6 (browser..user) come
// from Phase 0's visuals.tsx verbatim; the rest cover the eval set's other
// two videos (MQ backpressure → queue/lock; DB index → database/document)
// plus the StepReveal failure state (cross).
export type IconName =
  | "browser"
  | "server"
  | "key"
  | "shield"
  | "check"
  | "cross"
  | "user"
  | "database"
  | "queue"
  | "lock"
  | "document";

// Each entry is the inner shape only (no fill, no stroke, no <svg> wrapper)
// — Icon.tsx supplies those so every icon shares one 48x48 viewBox and one
// visual language.
export const ICON_PATHS: Record<IconName, ReactNode> = {
  browser: (
    <>
      <rect x="4" y="6" width="40" height="34" rx="5" />
      <path d="M4 15h40M11 10.5h.1M17 10.5h.1" />
    </>
  ),
  server: (
    <>
      <rect x="7" y="5" width="34" height="13" rx="3" />
      <rect x="7" y="30" width="34" height="13" rx="3" />
      <path d="M13 11.5h.1M13 36.5h.1M20 11.5h15M20 36.5h15M24 18v12" />
    </>
  ),
  key: (
    <>
      <circle cx="17" cy="25" r="9" />
      <path d="M26 25h17M37 25v6M32 25v4" />
    </>
  ),
  shield: (
    <>
      <path d="M24 4 41 11v12c0 11-7 18-17 22C14 41 7 34 7 23V11Z" />
      <path d="m16 24 5 5 11-12" />
    </>
  ),
  check: <path d="m9 25 10 10L40 13" />,
  cross: <path d="M13 13 35 35M35 13 13 35" />,
  user: (
    <>
      <circle cx="24" cy="16" r="9" />
      <path d="M8 43c1-10 7-15 16-15s15 5 16 15" />
    </>
  ),
  database: (
    <>
      <ellipse cx="24" cy="10" rx="17" ry="6" />
      <path d="M7 10v14c0 3.3 7.6 6 17 6s17-2.7 17-6V10M7 24v14c0 3.3 7.6 6 17 6s17-2.7 17-6V24" />
    </>
  ),
  queue: (
    <>
      <rect x="5" y="8" width="38" height="10" rx="3" />
      <rect x="5" y="22" width="38" height="10" rx="3" opacity="0.7" />
      <rect x="5" y="36" width="38" height="6" rx="3" opacity="0.4" />
    </>
  ),
  lock: (
    <>
      <rect x="10" y="21" width="28" height="21" rx="4" />
      <path d="M16 21v-6a8 8 0 0 1 16 0v6" />
    </>
  ),
  document: (
    <>
      <path d="M12 5h16l8 8v30H12Z" />
      <path d="M28 5v8h8M17 24h14M17 31h14M17 38h8" />
    </>
  ),
};
