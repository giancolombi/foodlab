// Compact language picker for screens that aren't inside AppLayout (signin,
// signup, public landing). The full popover-based switcher in AppLayout has
// presence indicators we don't want on auth screens — this is just a plain
// <select> that hits the same setLocale.

import { useLanguage } from "@/contexts/LanguageContext";
import { LOCALES, type Locale } from "@/i18n/strings";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function LanguagePicker({ className }: Props) {
  const { locale, setLocale } = useLanguage();
  return (
    <label className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="rounded-md border bg-background px-2 py-1 text-base sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Language"
      >
        {LOCALES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
