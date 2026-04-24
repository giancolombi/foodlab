// Design tokens — the single source of truth for spacing, sizing, and
// semantic color roles. Colors themselves are defined as CSS variables in
// index.css so light/dark mode can swap them at runtime; this file exposes
// typed names for the semantic roles so TS code can reference them without
// leaking raw oklch() strings into components.
//
// Anything that styles UI should pull from here (or from the Tailwind classes
// that reference these vars via @theme) so that a theme change in one place
// propagates everywhere.

export const COLOR_VARS = {
  background: "var(--background)",
  foreground: "var(--foreground)",
  card: "var(--card)",
  cardForeground: "var(--card-foreground)",
  primary: "var(--primary)",
  primaryForeground: "var(--primary-foreground)",
  secondary: "var(--secondary)",
  secondaryForeground: "var(--secondary-foreground)",
  muted: "var(--muted)",
  mutedForeground: "var(--muted-foreground)",
  accent: "var(--accent)",
  accentForeground: "var(--accent-foreground)",
  destructive: "var(--destructive)",
  destructiveForeground: "var(--destructive-foreground)",
  border: "var(--border)",
  input: "var(--input)",
  ring: "var(--ring)",
} as const;

// Semantic brand roles — how we *use* colors across the app.
// Use these names in component logic, not the raw vars.
export const BRAND = {
  action: COLOR_VARS.primary, // calls-to-action, active states
  surface: COLOR_VARS.card, // cards, popovers
  line: COLOR_VARS.border, // dividers, chip outlines
  soft: COLOR_VARS.accent, // chip backgrounds, highlights (sage)
  warn: COLOR_VARS.destructive, // unmatched profiles, allergen flags
} as const;

// Layout container widths — keep these consistent across pages so
// breakpoints line up and mobile bottom-nav matches content width.
export const CONTAINER = {
  // Reading-width pages (recipe detail, profile edit).
  prose: "max-w-3xl",
  // Grid / list pages (plan, recipes).
  wide: "max-w-6xl",
} as const;

// Responsive paddings. Matches Tailwind screen breakpoints (sm: 640px,
// md: 768px). Mobile gets tighter side padding to maximize content width.
export const PAGE_PADDING = "px-4 sm:px-6 py-6 sm:py-8";

// Standard spacing between major page sections.
export const SECTION_GAP = "space-y-6";

// Spinner / loading pulse duration — kept short so UI feels responsive.
export const LOADING_PULSE_MS = 600;

export type BrandRole = keyof typeof BRAND;
