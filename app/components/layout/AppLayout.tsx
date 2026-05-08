import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChefHat,
  Globe,
  LogOut,
  MoreHorizontal,
  Ruler,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import { useState, useRef, useEffect, type ComponentType } from "react";

import { Button } from "@/design-system";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlan } from "@/contexts/PlanContext";
import { useUnits, type UnitSystem } from "@/contexts/UnitsContext";
import { LOCALES, type Locale } from "@/i18n/strings";
import { translateAvailable, warmTranslator } from "@/lib/translator";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const { filledCount: planCount, recipeCount } = usePlan();
  const { boughtCount } = useCart();
  const { units, setUnits } = useUnits();
  // Header cart badge is a presence indicator: "you have recipes planned,
  // go shop for them". The precise unticked count lives on the Cart page to
  // avoid materializing the full shopping list on every layout render.
  const hasSomethingToShop = recipeCount > 0;
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Preload the translation model whenever a non-English locale is active.
  // Fire-and-forget; debounced inside warmTranslator().
  useEffect(() => {
    if (locale === "en") return;
    translateAvailable().then((ok) => {
      if (ok) warmTranslator();
    });
  }, [locale]);

  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (!langRef.current?.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [langOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  // Each entry drives both the desktop top nav (full label) and the mobile
  // bottom tab bar (icon + short label + optional badge).
  const NAV: Array<{
    to: string;
    label: string;
    shortLabel: string;
    icon: ComponentType<{ className?: string }>;
    badge?: number;
    dot?: boolean;
  }> = [
    {
      to: "/",
      label: t("nav.match"),
      shortLabel: t("nav.matchShort"),
      icon: Sparkles,
    },
    {
      to: "/recipes",
      label: t("nav.recipes"),
      shortLabel: t("nav.recipes"),
      icon: ChefHat,
    },
    {
      to: "/plan",
      label: t("nav.plan"),
      shortLabel: t("nav.plan"),
      icon: CalendarDays,
      badge: planCount > 0 ? planCount : undefined,
    },
    {
      to: "/cart",
      label: t("nav.cart"),
      shortLabel: t("nav.cart"),
      icon: ShoppingCart,
      dot: hasSomethingToShop,
    },
    {
      to: "/profiles",
      label: t("nav.profiles"),
      shortLabel: t("nav.profiles"),
      icon: Users,
    },
  ];

  const handleSignOut = () => {
    signOut();
    navigate("/signin");
  };

  const pickLocale = (next: Locale) => {
    setLocale(next);
    setLangOpen(false);
  };

  const currentLocale = LOCALES.find((l) => l.value === locale) ?? LOCALES[0];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div
          className="max-w-6xl mx-auto h-14 flex items-center justify-between px-4"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold text-lg"
          >
            <ChefHat className="h-5 w-5 text-primary" />
            FoodLab
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-1.5 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Plan + Cart shortcuts also live in the mobile bottom tab bar
                with the same badges, so keep these visible only from sm up
                to avoid duplicate affordances on phone. */}
            <Link
              to="/plan"
              className="hidden sm:inline-flex relative items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40"
              aria-label={t("nav.plan")}
              title={t("nav.plan")}
            >
              <CalendarDays className="h-4 w-4" />
              {planCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] rounded-full bg-primary text-primary-foreground text-[10px] font-medium inline-flex items-center justify-center px-1">
                  {planCount}
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              className="hidden sm:inline-flex relative items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40"
              aria-label={t("nav.cart")}
              title={t("nav.cart")}
            >
              <ShoppingCart className="h-4 w-4" />
              {hasSomethingToShop && (
                <span
                  className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary"
                  aria-label={
                    boughtCount > 0
                      ? t("nav.cartPartialHint", { n: boughtCount })
                      : t("nav.cartHasItemsHint")
                  }
                />
              )}
            </Link>
            {/* Inline cluster: Units · Language · (name) · Sign out — only
                from sm up. On mobile these collapse into the overflow menu
                below. */}
            <div className="hidden sm:flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setUnits(units === "imperial" ? "metric" : "imperial")
                }
                aria-label={t("layout.units")}
                title={t("layout.unitsHint")}
                className="gap-1.5"
              >
                <Ruler className="h-4 w-4" />
                <span className="text-xs uppercase">
                  {units === "imperial" ? "US" : "SI"}
                </span>
              </Button>
              <div className="relative" ref={langRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLangOpen((v) => !v)}
                  aria-label={t("layout.language")}
                  aria-expanded={langOpen}
                  className="gap-1.5"
                >
                  <Globe className="h-4 w-4" />
                  <span className="text-xs uppercase">
                    {currentLocale.value === "pt-BR"
                      ? "PT"
                      : currentLocale.value}
                  </span>
                </Button>
                {langOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1 w-40 rounded-md border bg-popover shadow-md z-50 py-1"
                  >
                    {LOCALES.map((l) => (
                      <button
                        key={l.value}
                        role="menuitem"
                        type="button"
                        onClick={() => pickLocale(l.value)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-sm hover:bg-accent",
                          l.value === locale && "font-medium text-primary",
                        )}
                      >
                        {l.native}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {user && (
                <span className="text-sm text-muted-foreground hidden md:block">
                  {user.displayName ?? user.email}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                aria-label={t("nav.signOut")}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile overflow: a single "..." button that opens a sheet with
                Units toggle, Language picker, and Sign out. Keeps the phone
                header to logo + overflow only. */}
            <div className="relative sm:hidden" ref={moreRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMoreOpen((v) => !v)}
                aria-label={t("layout.more")}
                aria-expanded={moreOpen}
                className="h-10 w-10 px-0"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 w-56 rounded-md border bg-popover shadow-md z-50 py-1"
                >
                  {user && (
                    <div className="px-3 py-2 text-xs text-muted-foreground border-b mb-1 truncate">
                      {user.displayName ?? user.email}
                    </div>
                  )}
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setUnits(units === "imperial" ? "metric" : "imperial");
                      setMoreOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                  >
                    <Ruler className="h-4 w-4" />
                    <span>{t("layout.units")}</span>
                    <span className="ml-auto text-xs uppercase text-muted-foreground">
                      {units === "imperial" ? "US" : "SI"}
                    </span>
                  </button>
                  <div className="border-t my-1" />
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("layout.language")}
                  </div>
                  {LOCALES.map((l) => (
                    <button
                      key={l.value}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        pickLocale(l.value);
                        setMoreOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2",
                        l.value === locale && "font-medium text-primary",
                      )}
                    >
                      <Globe className="h-4 w-4" />
                      {l.native}
                    </button>
                  ))}
                  <div className="border-t my-1" />
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("nav.signOut")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:pb-0">
        <Outlet />
      </main>
      <footer className="hidden sm:block border-t py-4 text-center text-xs text-muted-foreground">
        {t("layout.footer")}
      </footer>

      {/* Mobile bottom tab bar — fixed to the viewport so the primary nav
          stays in the thumb zone. Hidden from sm up since the desktop top
          nav covers the same routes. Honors safe-area-inset-bottom so it
          clears the iOS home indicator. */}
      <nav
        className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label={t("layout.primaryNav")}
      >
        <div className="flex">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] leading-none truncate relative",
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground",
                  )
                }
              >
                <span className="relative inline-flex">
                  <Icon className="h-5 w-5" />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 min-w-[1.1rem] h-[1.1rem] rounded-full bg-primary text-primary-foreground text-[10px] font-medium inline-flex items-center justify-center px-1">
                      {item.badge}
                    </span>
                  )}
                  {item.dot && !item.badge && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="truncate max-w-full">{item.shortLabel}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
