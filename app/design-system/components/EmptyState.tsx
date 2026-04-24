// Friendly empty-state: centered icon + message + optional CTA. Use this
// anywhere a list/page has nothing to show yet (plan with no assignments,
// cart with no items, recipes page during first load, etc.).

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 py-10 px-4 rounded-lg border border-dashed",
        className,
      )}
    >
      {Icon && (
        <div className="h-10 w-10 rounded-full bg-accent/40 text-accent-foreground flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
