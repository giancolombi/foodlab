// Toggles a recipe's membership in the weekly plan. Uses sonner toasts for
// feedback so the action feels acknowledged even when the button is tucked
// into a small corner of a card.

import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlan } from "@/contexts/PlanContext";

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
  const { has, add, remove } = usePlan();
  const { t } = useLanguage();
  const inPlan = has(slug);

  const onClick = (e: React.MouseEvent) => {
    // Recipe cards are wrapped in <Link>; don't navigate when the button is
    // clicked. Card-level <Link>s in this codebase are inside the card body,
    // but stop propagation defensively so nested anchors don't fire.
    e.preventDefault();
    e.stopPropagation();
    if (inPlan) {
      remove(slug);
      toast.success(t("plan.toastRemoved", { title }));
    } else {
      add(slug);
      toast.success(t("plan.toastAdded", { title }));
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={inPlan ? "secondary" : "outline"}
      onClick={onClick}
      className={className}
      aria-pressed={inPlan}
    >
      {inPlan ? (
        <>
          <Check className="h-3.5 w-3.5" /> {t("plan.inPlan")}
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5" /> {t("plan.add")}
        </>
      )}
    </Button>
  );
}
