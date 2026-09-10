"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AttendanceSessionDetail, AttendanceSessionSummary, AttendanceStoredEntry } from "../lib/attendance-contract";
import { committeeDisplayName, type Committee } from "../lib/committees";
import type { AttendanceStatus } from "../lib/session-state";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

type ListResponse = { ok: true; sessions: AttendanceSessionSummary[] } | { ok: false; error: string };
type DetailResponse = { ok: true; session: AttendanceSessionDetail } | { ok: false; error: string };

export function AttendanceAdmin({ committees }: { committees: Committee[] }) {
  const { language, t } = useLanguage();
  const [sessions, setSessions] = useState<AttendanceSessionSummary[]>([]);
  const [committeeSlug, setCommitteeSlug] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ committeeSlug: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<AttendanceSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.committeeSlug) params.set("committee", appliedFilters.committeeSlug);
    if (appliedFilters.from) params.set("from", appliedFilters.from);
    if (appliedFilters.to) params.set("to", appliedFilters.to);
    return params.toString();
  }, [appliedFilters]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/attendance${query ? `?${query}` : ""}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as ListResponse;
        if (!response.ok || !payload.ok) throw new Error("load-failed");
        if (!cancelled) setSessions(payload.sessions);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, reloadToken]);

  function reload() {
    setLoading(true);
    setError(false);
    setReloadToken((value) => value + 1);
  }

  function applyFilters() {
    setLoading(true);
    setError(false);
    setAppliedFilters({ committeeSlug, from, to });
  }

  const totals = useMemo(() => ({
    committees: new Set(sessions.map((session) => session.committeeId)).size,
    participants: sessions.reduce((sum, session) => sum + session.participantCount, 0),
  }), [sessions]);

  const exportQuery = new URLSearchParams(query);
  exportQuery.set("lang", language);

  function formatDate(value: string) {
    // Los timestamps se guardan en UTC (ISO "...Z"). Fijamos la zona a CDMX
    // para que el ledger no muestre la hora del entorno de render (Workers = UTC).
    return new Intl.DateTimeFormat(language === "es" ? "es-MX" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(value));
  }

  function committeeName(session: AttendanceSessionSummary) {
    return language === "es" ? session.committeeNameEs : session.committeeNameEn;
  }

  function participantName(entry: AttendanceStoredEntry) {
    return language === "es" ? entry.primaryNameEs : entry.primaryNameEn;
  }

  function secondaryName(entry: AttendanceStoredEntry) {
    return language === "es" ? entry.secondaryNameEs : entry.secondaryNameEn;
  }

  function attendanceLabel(status: AttendanceStatus) {
    if (status === "present-voting") return t("presentAndVoting");
    if (status === "pending") return language === "es" ? "Sin registrar" : "Not recorded";
    return t(status);
  }

  async function openDetail(sessionId: string) {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/attendance/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const payload = await response.json() as DetailResponse;
      if (!response.ok || !payload.ok) throw new Error("detail-failed");
      setDetail(payload.session);
    } catch {
      setError(true);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link href="/" className="brand-lockup"><span className="brand-mark">I</span><div><strong>ITAMMUN</strong><span>{t("attendanceAdministration")}</span></div></Link>
        <div className="header-actions"><Link className="secondary-button" href="/">{t("backToCommittees")}</Link><LanguageSwitcher /></div>
      </header>

      <section className="admin-intro">
        <p className="eyebrow">{t("attendanceLedger")}</p>
        <h1>{t("centralizedAttendance")}</h1>
        <p>{t("adminAttendanceIntro")}</p>
        <div className="admin-policy"><strong>{t("immutableRecords")}</strong><span>{t("retentionSixMonths")}</span></div>
      </section>

      <section className="admin-filters" aria-label={t("attendanceFilters")}>
        <label><span>{t("ledgerCommittee")}</span><select value={committeeSlug} onChange={(event) => setCommitteeSlug(event.target.value)}><option value="">{t("allCommittees")}</option>{committees.map((committee) => <option value={committee.slug} key={committee.id}>{committeeDisplayName(committee, language)}</option>)}</select></label>
        <label><span>{t("fromDate")}</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label><span>{t("toDate")}</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="primary-button" onClick={applyFilters}>{t("applyFilters")}</button>
        <button className="secondary-button" onClick={reload}>{t("refreshRecords")}</button>
        <a className="secondary-button" href={`/api/admin/attendance/export.csv?${exportQuery.toString()}`}>{t("exportLedgerCsv")}</a>
      </section>

      <section className="admin-metrics">
        <article><strong>{sessions.length}</strong><span>{t("recordedSessions")}</span></article>
        <article><strong>{totals.committees}</strong><span>{t("representedCommittees")}</span></article>
        <article><strong>{totals.participants}</strong><span>{t("participantRecords")}</span></article>
      </section>

      <section className="admin-ledger">
        {loading && <p className="admin-state">{t("loadingAttendance")}</p>}
        {!loading && error && <div className="admin-state admin-state-error"><p>{t("attendanceLoadError")}</p><button className="primary-button" onClick={reload}>{t("retry")}</button></div>}
        {!loading && !error && sessions.length === 0 && <p className="admin-state">{t("noStoredSessions")}</p>}
        {!loading && !error && sessions.length > 0 && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t("ledgerCommittee")}</th><th>{t("ledgerSession")}</th><th>{t("ledgerClosedAt")}</th><th>{t("ledgerBreakdown")}</th><th>{t("ledgerExpiresAt")}</th><th /></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><strong>{committeeName(session)}</strong><small>{language === "es" ? session.committeeAbbreviationEs : session.committeeAbbreviationEn}</small></td><td><strong>{session.title}</strong><small>{session.id}</small></td><td>{formatDate(session.closedAt)}</td><td><div className="attendance-chips"><span className="status-present">{t("present")} {session.presentCount}</span><span className="status-voting">{t("presentAndVoting")} {session.presentVotingCount}</span><span className="status-absent">{t("absent")} {session.absentCount}</span><span className="status-observer">{t("observer")} {session.observerCount}</span>{session.pendingCount > 0 && <span>{language === "es" ? "Sin registrar" : "Not recorded"} {session.pendingCount}</span>}</div></td><td>{formatDate(session.expiresAt)}</td><td><button className="secondary-button" disabled={detailLoading} onClick={() => void openDetail(session.id)}>{t("viewRecord")}</button></td></tr>)}</tbody></table></div>}
      </section>

      {detail && <section className="admin-detail" aria-live="polite">
        <div className="admin-detail-heading"><div><span className="section-kicker">{committeeName(detail)}</span><h2>{detail.title}</h2><p>{t("ledgerReceivedAt")}: {formatDate(detail.receivedAt)} · {t("ledgerExpiresAt")}: {formatDate(detail.expiresAt)}</p></div><button className="secondary-button" onClick={() => setDetail(null)}>{t("closeRecord")}</button></div>
        <div className="admin-table-wrap"><table className="admin-table admin-detail-table"><thead><tr><th>{t("participantOrJudge")}</th><th>{t("countryOrRepresentation")}</th><th>{t("attendanceStatusLabel")}</th><th>{t("warningLedger")}</th><th>{t("activeWarningsLedger")}</th><th>{t("faultsLedger")}</th></tr></thead><tbody>{detail.participants.map((entry) => <tr key={entry.participantId}><td><strong>{participantName(entry)}</strong><small>{entry.representationKind}</small></td><td>{secondaryName(entry) || participantName(entry)}</td><td><span className={`attendance-status status-${entry.attendanceStatus}`}>{attendanceLabel(entry.attendanceStatus)}</span></td><td>{entry.warningsTotal}</td><td>{entry.warningsActive}</td><td><strong>{entry.faults}</strong></td></tr>)}</tbody></table></div>
      </section>}
    </main>
  );
}
