"use client";

import { useLanguage } from "./LanguageProvider";

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className={`language-switcher ${dark ? "language-switcher-dark" : ""}`} role="group" aria-label={t("languageControl")}>
      <button type="button" aria-pressed={language === "es"} aria-label={t("spanish")} onClick={() => setLanguage("es")}>ES</button>
      <button type="button" aria-pressed={language === "en"} aria-label={t("english")} onClick={() => setLanguage("en")}>EN</button>
    </div>
  );
}
