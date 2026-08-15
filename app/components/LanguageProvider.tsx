"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { interpolate, translations, type Language, type TranslationKey } from "../lib/i18n";

const STORAGE_KEY = "itammun:language";
const CHANGE_EVENT = "itammun:language-change";
let volatileLanguage: Language = "es";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") volatileLanguage = stored;
  } catch { /* use the in-memory preference when storage is unavailable */ }
  return volatileLanguage;
}

function subscribe(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, readLanguage, () => "es" as const);

  useEffect(() => {
    document.documentElement.lang = language === "es" ? "es-MX" : "en";
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    volatileLanguage = nextLanguage;
    try { window.localStorage.setItem(STORAGE_KEY, nextLanguage); } catch { /* keep the in-memory preference */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => (
    interpolate(translations[language][key], values)
  ), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
