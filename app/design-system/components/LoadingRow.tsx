// Inline "still loading…" strip — spinner + label aligned with body text.
// Use wherever a section is fetching but the rest of the page is usable.

import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingRowProps {
  label: ReactNode;
  className?: string;
  size?: "xs" | "sm" | "md";
}

export function LoadingRow({ label, className, size = "sm" }: LoadingRowProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Spinner size={size} label={typeof label === "string" ? label : "Loading"} />
      <span>{label}</span>
    </div>
  );
}
