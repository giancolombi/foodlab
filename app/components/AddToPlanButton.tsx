// Slot picker for assigning a recipe to one or more day/meal slots in the
// weekly plan. Pops open a small 7-day × 3-meal grid; each cell shows either
// a check (this recipe is already there) or empty. Tapping toggles that
// slot's assignment.
//
// If the recipe already occupies at least one slot we render the button in
// its "in plan" state so lists can visually flag it without opening the
// popover.

import { useEffect, useRef, useState } from "react";
import { Check, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DAY_KEYS,
  DAYS,
  MEALS,
  usePlan,
  type Day,
  type Meal,
} from "@/contexts/PlanContext";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  title: string;
  size?: ButtonProps["size"];
  className?: string;
}

export function AddToPlanButton({
  slug,
  title,
  size = "sm",
  className,
}: Props) {
  const { t } = useLanguage();
  const { assignments, assign, unassign, isInPlan } = usePlan();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inPlan = isInPlan(slug);

  // Close on outside click so the popover doesn't linger after selection.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const onToggleButton = (e: React.MouseEvent) => {
    // Card-level <Link>s would otherwise swallow the click or navigate.
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const toggleSlot = (day: Day, meal: Meal) => {
    const key = `${day}-${meal}` as const;
    const existing = assignments[key];
    if (existing?.slug === slug) {
      unassign(day, meal);
      toast.success(t("plan.toastRemoved", { title }));
    } else {
      assign(day, meal, slug);
      toast.success(t("plan.toastAdded", { title }));
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-block">
      <Button
        type="button"
        size={size}
        variant={inPlan ? "secondary" : "outline"}
        onClick={onToggleButton}
        className={className}
        aria-pressed={inPlan}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {inPlan ? (
          <>
            <Check className="h-3.5 w-3.5" /> {t("plan.inPlan")}
          </>
        ) : (
          <>
            <CalendarPlus className="h-3.5 w-3.5" /> {t("plan.add")}
          </>
        )}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label={t("plan.assignRecipe")}
          className={cn(
            "absolute z-50 mt-1 p-3 rounded-md border bg-popover shadow-md",
            // Right-align under the button on desktop. On mobile, anchor to
            // the right edge of the button and grow leftward up to the
            // viewport — never wider than 90vw so it can't clip on a phone.
            "right-0 w-[min(90vw,20rem)] sm:w-80",
          )}
        >
          <p className="text-xs text-muted-foreground mb-2">
            {t("plan.assignHint")}
          </p>
          <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1 text-[11px]">
            <div />
            {MEALS.map((m) => (
              <div
                key={m}
                className="text-center text-muted-foreground capitalize"
              >
                {t(`plan.slot.${m}` as const)}
              </div>
            ))}
            {DAYS.map((d) => (
              <Row
                key={d}
                day={d}
                dayKey={DAY_KEYS[d]}
                slug={slug}
                assignments={assignments}
                onToggle={toggleSlot}
                label={t(`plan.day.${DAY_KEYS[d]}` as const)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  day: Day;
  dayKey: string;
  label: string;
  slug: string;
  assignments: ReturnType<typeof usePlan>["assignments"];
  onToggle: (day: Day, meal: Meal) => void;
}

function Row({ day, label, slug, assignments, onToggle }: RowProps) {
  return (
    <>
      <div className="py-1 pr-2 text-muted-foreground text-xs">{label}</div>
      {MEALS.map((m) => {
        const existing = assignments[`${day}-${m}` as const];
        const mine = existing?.slug === slug;
        const occupiedByOther = existing && !mine;
        return (
          <button
            type="button"
            key={m}
            onClick={() => onToggle(day, m)}
            className={cn(
              "h-8 rounded border text-[10px] font-medium transition-colors",
              mine
                ? "bg-primary text-primary-foreground border-primary"
                : occupiedByOther
                  ? "bg-muted text-muted-foreground border-input hover:border-primary/40"
                  : "bg-background text-muted-foreground border-input hover:bg-accent/30",
            )}
            aria-pressed={mine}
            title={existing?.slug}
          >
            {mine ? <Check className="h-3 w-3 mx-auto" /> : occupiedByOther ? "•" : ""}
          </button>
        );
      })}
    </>
  );
}
