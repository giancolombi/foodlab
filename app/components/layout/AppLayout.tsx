import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ChefHat, Globe, LogOut, ShoppingBasket } from "lucide-react";
import { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlan } from "@/contexts/PlanContext";
import { LOCALES, type Locale } from "@/i18n/strings";
import { translateAvailable, warmTranslator } from "@/lib/translator";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const { count: planCount } = usePlan();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

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

  const NAV = [
    { to: "/", label: t("nav.match") },
    { to: "/recipes", label: t("nav.recipes") },
    { to: "/plan", label: t("nav.plan") },
    { to: "/profiles", label: t("nav.profiles") },
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
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
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
          <div className="flex items-center gap-2">
            <Link
              to="/plan"
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
              aria-label={t("nav.plan")}
            >
              <ShoppingBasket className="h-4 w-4" />
              {planCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] rounded-full bg-primary text-primary-foreground text-[10px] font-medium inline-flex items-center justify-center px-1">
                  {planCount}
                </span>
              )}
            </Link>
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
                  {currentLocale.value === "pt-BR" ? "PT" : currentLocale.value}
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
        </div>
        <nav className="sm:hidden border-t flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex-1 text-center py-2 text-sm",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        {t("layout.footer")}
      </footer>
    </div>
  );
}
