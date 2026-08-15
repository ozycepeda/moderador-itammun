"use client";

import Image from "next/image";
import type { Committee } from "../lib/committees";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import { createInitialState } from "../lib/session-state";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

export function ProjectorView({ committee, sessionKey }: { committee: Committee; sessionKey: string }) {
  const { t } = useLanguage();
  const { state } = useLocalCommitteeState(sessionKey, createInitialState([]));
  const voterId = state.vote.status === "active" ? state.vote.queue[state.vote.currentIndex] : undefined;
  const voter = state.participants.find((participant) => participant.id === voterId);
  const ballots = Object.values(state.vote.ballots);
  const counts = {
    for: ballots.filter((choice) => choice === "for").length,
    against: ballots.filter((choice) => choice === "against").length,
  };
  const secretariat = committee.slug.startsWith("lienzo-") ? t("blankCanvas") : committee.secretariat;
  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;

  return (
    <main className="projector-shell" style={cssVars}>
      <header className="projector-header">
        <span className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></span>
        <div className="projector-header-actions"><LanguageSwitcher dark /><div className="projector-committee-heading"><span>{secretariat}</span><strong>{committee.abbreviation}</strong></div></div>
      </header>

      <section className="projector-content">
        {state.vote.status === "active" && voter ? (
          <div className="projector-vote">
            <span className="projector-kicker">{t("nominalVoteProgress", { current: state.vote.currentIndex + 1, total: state.vote.queue.length })}</span>
            <p>{state.vote.label}</p>
            {voter.flagUrl && <Image src={voter.flagUrl} alt="" width={192} height={128} unoptimized priority />}
            <span className="projector-action">{t("castingVote")}</span>
            <h1>{voter.name}</h1>
          </div>
        ) : state.vote.status === "complete" ? (
          <div className="projector-result">
            <span className="projector-kicker">{t("voteComplete")}</span>
            <h1>{state.vote.label}</h1>
            <div className="projector-counts projector-counts-two"><div><strong>{counts.for}</strong><span>{t("inFavor")}</span></div><div><strong>{counts.against}</strong><span>{t("against")}</span></div></div>
          </div>
        ) : (
          <div className="projector-idle">
            <span className="projector-kicker">{t("sessionInProgress")}</span>
            <h1>{state.topic || t("waitingForDebate")}</h1>
            {state.currentSpeaker && <p>{t("atPodium")} <strong>{state.currentSpeaker}</strong></p>}
          </div>
        )}
      </section>
    </main>
  );
}
