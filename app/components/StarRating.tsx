import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  /** Server-supplied caller rating, 1-5 or null. */
  myStars: number | null;
  /** Server-supplied average across all users; null when unrated. */
  avgStars: number | null;
  ratingCount: number;
  /** Called after a successful rate so the caller can refresh aggregates. */
  onChange?: (stars: number) => void;
}

/**
 * Five-star rating control. Anonymous viewers see the read-only average;
 * signed-in viewers can click a star to rate. Optimistic update; reverts
 * on API failure.
 */
export function StarRating({
  slug,
  myStars,
  avgStars,
  ratingCount,
  onChange,
}: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stars, setStars] = useState<number | null>(myStars);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const display = hover ?? stars ?? Math.round(avgStars ?? 0);
  const interactive = Boolean(user) && !saving;

  const submit = async (n: number) => {
    if (!user) {
      toast.error(t("rating.signinRequired"));
      return;
    }
    const previous = stars;
    setStars(n);
    setSaving(true);
    try {
      await api("/ratings", {
        method: "POST",
        body: { slug, stars: n },
      });
      onChange?.(n);
      toast.success(t("rating.saved", { n }));
    } catch (err: any) {
      setStars(previous);
      toast.error(err?.message ?? t("rating.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className="inline-flex items-center"
        role={interactive ? "radiogroup" : undefined}
        aria-label={t("rating.label")}
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = display >= n;
          return (
            <button
              key={n}
              type="button"
              role={interactive ? "radio" : undefined}
              aria-checked={interactive ? stars === n : undefined}
              disabled={!interactive}
              onMouseEnter={() => interactive && setHover(n)}
              onFocus={() => interactive && setHover(n)}
              onBlur={() => setHover(null)}
              onClick={() => interactive && submit(n)}
              className={cn(
                "p-0.5 rounded-sm transition-colors",
                interactive ? "cursor-pointer" : "cursor-default",
                filled ? "text-amber-400" : "text-muted-foreground/40",
                interactive && "hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
              )}
              aria-label={t("rating.starN", { n })}
              title={interactive ? t("rating.starN", { n }) : undefined}
            >
              <Star
                className={cn("h-5 w-5", filled && "fill-current")}
              />
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {avgStars != null
          ? t("rating.avg", { avg: avgStars.toFixed(1), n: ratingCount })
          : t("rating.unrated")}
      </span>
    </div>
  );
}
