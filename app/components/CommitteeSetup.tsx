"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { committeeDisplayAbbreviation, committeeDisplaySecretariat, type Committee } from "../lib/committees";
import { representationFullName, representationMatches, representationSecondaryName, type CommitteeDetail, type Representation } from "../lib/itammun-api";
import { selectedParticipants } from "../lib/participant-selection";
import { setupStorageKey, type StoredSetup } from "../lib/setup-state";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

export function CommitteeSetup({ committee, detail, sessionKey }: {
  committee: Committee;
  detail: CommitteeDetail;
  sessionKey: string;
}) {
  const [selected, setSelected] = useState(() => new Set(detail.initiallyAssignedRepresentationIds));
  const [customParticipants, setCustomParticipants] = useState<Representation[]>([]);
  const [customName, setCustomName] = useState("");
  const [search, setSearch] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const { language, t } = useLanguage();

  const visible = useMemo(() => detail.representations.filter((item) => representationMatches(item, search, language)), [detail.representations, language, search]);
  const participants = [...detail.representations, ...customParticipants];
  const assignedParticipantIds = [...selected, ...customParticipants.map((participant) => participant.id)];
  const secretariat = committee.slug.startsWith("lienzo-") ? t("blankCanvas") : committeeDisplaySecretariat(committee, language);
  const abbreviation = committee.slug.startsWith("lienzo-") ? (committee.abbreviation || t("unnamedCommittee")) : committeeDisplayAbbreviation(committee, language);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addCustomParticipant() {
    const name = customName.trim();
    if (!name) return;
    setCustomParticipants((current) => [...current, {
      id: `custom-${crypto.randomUUID()}`,
      name,
      nameByLanguage: { es: name, en: name },
      observer: false,
      kind: "custom",
      status: "occupied",
      searchTerms: [name],
    }]);
    setCustomName("");
  }

  function startSession() {
    const title = sessionTitle.trim();
    const activeParticipants = selectedParticipants(participants, assignedParticipantIds);
    if (activeParticipants.length === 0 || !title) return;
    const setup: StoredSetup = {
      participants: activeParticipants,
      assignedParticipantIds,
      sessionId: crypto.randomUUID(),
      sessionTitle: title,
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(setupStorageKey(sessionKey), JSON.stringify(setup));
    window.localStorage.removeItem(`itammun:session:${sessionKey}`);
    window.location.assign(`/comite/${sessionKey}?nombre=${encodeURIComponent(committee.name)}`);
  }

  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;

  return (
    <main className="setup-shell" style={cssVars}>
      <header className="console-header">
        <Link href="/" className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></Link>
        <div className="committee-heading"><span>{secretariat}</span><h1>{abbreviation}</h1></div>
        <div className="header-actions"><span className="setup-step">{t("prepareSession")}</span><LanguageSwitcher dark /></div>
      </header>

      <section className="setup-intro">
        <p className="eyebrow">{t("localPreparation")}</p>
        <h2>{t("markInitialSeats")}</h2>
        <p>{t("setupExplanation")}</p>
      </section>

      <div className="setup-grid setup-grid-single">
        <section className="setup-panel participants-panel">
          <div className="session-title-field">
            <label htmlFor="session-title">{t("sessionTitle")}</label>
            <input id="session-title" value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} placeholder={t("sessionTitlePlaceholder")} autoFocus />
            <p>{t("sessionTitleHelp")}</p>
          </div>
          {detail.source === "live" && <div className="catalog-status catalog-status-live"><strong>{t("liveCatalogLoaded")}</strong><span>{t("liveCatalogHelp")}</span></div>}
          {detail.source === "unavailable" && <div className="catalog-status catalog-status-error" role="alert"><strong>{t("catalogUnavailable")}</strong><span>{t("catalogUnavailableHelp")}</span><button type="button" onClick={() => window.location.reload()}>{t("retry")}</button></div>}
          <div className="setup-panel-heading"><div><span className="section-kicker">{t("countriesAndPeople")}</span><h2>{t("initialSeats")}</h2></div><strong>{assignedParticipantIds.length}</strong></div>
          {detail.representations.length > 0 && (
            <>
              <div className="catalog-tools">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchCatalog")} aria-label={t("searchCatalog")} />
                <button onClick={() => setSelected(new Set(detail.representations.map((item) => item.id)))}>{t("markAll")}</button>
                <button onClick={() => setSelected(new Set())}>{t("clearMarks")}</button>
              </div>
              <div className="setup-country-list">
                {visible.map((item) => (
                  <label key={item.id} className="setup-country-row">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                    {item.flagUrl ? <Image src={item.flagUrl} alt="" width={28} height={19} unoptimized /> : <span className="flag-placeholder" />}
                    <span>{representationFullName(item, language)}</span>
                    {representationSecondaryName(item, language) && <em>{t("judgeRepresentation")}</em>}
                  </label>
                ))}
              </div>
            </>
          )}

          <form className="custom-participant-form" onSubmit={(event) => { event.preventDefault(); addCustomParticipant(); }}>
            <label htmlFor="custom-participant">{t("addParticipant")}</label>
            <div><input id="custom-participant" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder={t("freeName")} /><button>{t("add")}</button></div>
          </form>
          {customParticipants.length > 0 && <ul className="custom-participants">{customParticipants.map((item) => <li key={item.id}><span>{item.name}</span><button onClick={() => setCustomParticipants((current) => current.filter((entry) => entry.id !== item.id))}>{t("remove")}</button></li>)}</ul>}
        </section>
      </div>

      <footer className="setup-footer">
        <div><strong>{t("initialSeatsCount", { count: assignedParticipantIds.length })}</strong><span>{t("availableParticipantsCount", { count: participants.length })}</span></div>
        <button className="primary-button" disabled={assignedParticipantIds.length === 0 || !sessionTitle.trim()} onClick={startSession}>{t("startSession")}</button>
      </footer>
    </main>
  );
}
