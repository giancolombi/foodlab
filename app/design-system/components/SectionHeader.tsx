// H2 for in-page sections. Not a "card header" — use Card's CardHeader when
// the section lives inside a card. This is for loose sections like "Recipes"
// and "Shopping list" that share the page background.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: ReactNode;
  /** Small text after the title, e.g. count "(12)" */
  hint?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  hint,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 flex-wrap",
        className,
      )}
    >
      <h2 className="font-medium flex items-baseline gap-1.5">
        {title}
        {hint && (
          <span className="text-muted-foreground text-sm font-normal">
            {hint}
          </span>
        )}
      </h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
