// Inline loading spinner. Uses Lucide's Loader2 with Tailwind's animate-spin
// so we avoid bundling a second icon lib or custom SVG.
//
// Usage:
//   <Spinner />                      — 1rem, aligns with text baseline
//   <Spinner size="sm" label="…" />  — small + aria-label for a11y
//
// Pair with sr-only text or a visible label when used alone to convey state
// for screen readers.

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "xs" | "sm" | "md";
  className?: string;
  /** Accessible label for screen readers. Defaults to "Loading". */
  label?: string;
}

const SIZE: Record<NonNullable<SpinnerProps["size"]>, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

export function Spinner({ size = "sm", className, label = "Loading" }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin", SIZE[size], className)}
      role="status"
      aria-label={label}
    />
  );
}
