// Togglable pill for selecting dietary profiles. Used in Plan ("cooking for")
// and Cart ("shopping for"). Keeps the same look on both pages so the user
// learns the pattern once.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ProfileChipProps {
  /** Toggled on */
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** Optional leading icon / avatar slot */
  leading?: ReactNode;
  className?: string;
}

export function ProfileChip({
  active,
  onToggle,
  children,
  disabled,
  leading,
  className,
}: ProfileChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-input hover:bg-accent/40",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {leading}
      {children}
    </button>
  );
}
