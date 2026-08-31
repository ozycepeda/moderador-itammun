"use client";

import { useState } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

export function AccessGate() {
  const { t } = useLanguage();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!pin || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const next = new URLSearchParams(window.location.search).get("next") ?? "/";
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, next }),
      });
      const result = await response.json() as { ok?: boolean; next?: string; error?: string };
      if (!response.ok) {
        setError(result.error === "not_configured" ? t("accessUnavailable") : t("invalidPin"));
        return;
      }
      window.location.assign(result.next || "/");
    } catch {
      setError(t("accessUnavailable"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="access-shell">
      <header className="access-header">
        <div className="brand-lockup"><span className="brand-mark">I</span><div><strong>ITAMMUN</strong><span>{t("moderator")}</span></div></div>
        <LanguageSwitcher />
      </header>
      <section className="access-card">
        <span className="eyebrow">ITAM Model United Nations</span>
        <h1>{t("accessRequired")}</h1>
        <p>{t("accessIntro")}</p>
        <form onSubmit={submit}>
          <label htmlFor="access-pin">{t("accessPin")}</label>
          <input id="access-pin" type="password" autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder={t("accessPinPlaceholder")} autoFocus />
          {error && <p className="access-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={!pin || submitting}>{t("enterModerator")}</button>
        </form>
      </section>
    </main>
  );
}
