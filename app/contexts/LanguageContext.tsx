import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { translate, type Locale, type StringKey } from "@/i18n/strings";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  translateContent: boolean;
  setTranslateContent: (v: boolean) => void;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "foodlab_locale";
const TRANSLATE_KEY = "foodlab_translate_content";

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "es" || stored === "pt-BR") return stored;
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("pt")) return "pt-BR";
  if (nav.startsWith("es")) return "es";
  return "en";
}

function detectInitialTranslate(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TRANSLATE_KEY) === "1";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);
  const [translateContent, setTranslateContentState] = useState<boolean>(
    detectInitialTranslate,
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next === "pt-BR" ? "pt-BR" : next;
  }, []);

  const setTranslateContent = useCallback((next: boolean) => {
    setTranslateContentState(next);
    localStorage.setItem(TRANSLATE_KEY, next ? "1" : "0");
  }, []);

  const t = useCallback<LanguageContextValue["t"]>(
    (key, params) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, translateContent, setTranslateContent, t }),
    [locale, setLocale, translateContent, setTranslateContent, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

/** Convenience hook for components that only need t(). */
export function useT() {
  return useLanguage().t;
}

/** Read the current locale for non-React code paths (streamMatch etc.). */
export function getStoredLocale(): Locale {
  return detectInitialLocale();
}
