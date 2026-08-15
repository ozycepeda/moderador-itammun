"use client";

import { useState } from "react";
import type { Committee } from "../lib/committees";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

export function CommitteePicker({ committees }: { committees: Committee[] }) {
  const [customName, setCustomName] = useState("");
  const { t } = useLanguage();

  function openBlankCanvas() {
    const name = customName.trim() || t("unnamedCommittee");
    const key = `lienzo-${crypto.randomUUID()}`;
    window.location.assign(`/comite/${key}/setup?nombre=${encodeURIComponent(name)}`);
  }

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <div className="brand-lockup">
          <span className="brand-mark">I</span>
          <div><strong>ITAMMUN</strong><span>{t("moderator")}</span></div>
        </div>
        <div className="landing-actions"><span className="open-access">{t("openAccess")}</span><LanguageSwitcher /></div>
      </header>

      <section className="landing-intro">
        <p className="eyebrow">ITAM Model United Nations</p>
        <h1>{t("landingQuestion")}</h1>
        <p>{t("landingIntro")}</p>
      </section>

      <section className="committee-grid" aria-label={t("availableCommittees")}>
        {committees.map((committee, index) => (
          <a
            className="committee-card"
            href={`/comite/${committee.slug}/setup`}
            key={committee.id}
            style={{ "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties}
          >
            <span className="committee-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="committee-secretariat">{committee.secretariat}</span>
            <h2>{committee.abbreviation}</h2>
            <p>{committee.name}</p>
            <div className="committee-meta">
              <span>{committee.language}</span><span>{committee.level === "Bajo" ? t("lowLevel") : committee.level === "Alto" ? t("highLevel") : t("intermediateLevel")}</span><span>{t("places", { count: committee.representationsCount })}</span>
            </div>
            <span className="card-action">{t("prepareDebate")} <span aria-hidden>↗</span></span>
          </a>
        ))}

        <article className="committee-card blank-card">
          <span className="committee-number">+</span>
          <span className="committee-secretariat">{t("blankCanvas")}</span>
          <h2>{t("otherCommittee")}</h2>
          <label htmlFor="custom-name">{t("committeeName")}</label>
          <input id="custom-name" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder={t("committeeNamePlaceholder")} />
          <button onClick={openBlankCanvas}>{t("prepareCanvas")} <span aria-hidden>↗</span></button>
        </article>
      </section>

      <footer className="landing-footer">
        <span>{t("shareableLinks")}</span>
        <span>{t("eventData")}</span>
      </footer>
    </main>
  );
}
