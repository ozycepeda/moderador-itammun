"use client";

import Image from "next/image";
import type { Committee } from "../lib/committees";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import { createInitialState, getDisciplinaryCounts } from "../lib/session-state";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

export function ProjectorView({ committee, sessionKey }: { committee: Committee; sessionKey: string }) {
  const { t } = useLanguage();
  const { state } = useLocalCommitteeState(sessionKey, createInitialState([]));
  const appealVoterId = state.vote.status === "active" ? state.vote.queue[state.vote.currentIndex] : undefined;
  const appealVoter = state.participants.find((participant) => participant.id === appealVoterId);
  const appealBallots = Object.values(state.vote.ballots);
  const appealCounts = {
    for: appealBallots.filter((choice) => choice === "for").length,
    against: appealBallots.filter((choice) => choice === "against").length,
  };
  const finalParticipantId = state.finalVote.phase === "explanations"
    ? state.finalVote.explanationQueue[state.finalVote.explanationIndex]
    : state.finalVote.queue[state.finalVote.currentIndex];
  const finalParticipant = state.participants.find((participant) => participant.id === finalParticipantId);
  const finalBallots = Object.values(state.finalVote.roundThree);
  const finalCounts = {
    for: finalBallots.filter((choice) => choice === "for").length,
    against: finalBallots.filter((choice) => choice === "against").length,
  };
  const finalRoundKey = state.finalVote.phase === "round-one" ? "finalRoundOne" : state.finalVote.phase === "round-two" ? "finalRoundTwo" : "finalRoundThree";
  const secretariat = committee.slug.startsWith("lienzo-") ? t("blankCanvas") : committee.secretariat;
  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;
  const disciplinaryLabel = (totalWarnings: number) => {
    const discipline = getDisciplinaryCounts(totalWarnings);
    return t("disciplinaryBadge", { warnings: discipline.activeWarnings, faults: discipline.faults });
  };

  return (
    <main className="projector-shell" style={cssVars}>
      <header className="projector-header">
        <span className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></span>
        <div className="projector-header-actions"><LanguageSwitcher dark /><div className="projector-committee-heading"><span>{secretariat}</span><strong>{committee.abbreviation}</strong></div></div>
      </header>

      <section className="projector-content">
        {state.vote.status === "active" && appealVoter ? (
          <div className="projector-vote">
            <span className="projector-kicker">{t("immediateVote")} · {t("voteProgress", { current: state.vote.currentIndex + 1, total: state.vote.queue.length })}</span>
            <p>{state.vote.label}</p>
            {appealVoter.flagUrl && <Image src={appealVoter.flagUrl} alt="" width={192} height={128} unoptimized priority />}
            <span className="projector-action">{t("castingVote")}</span><h1>{appealVoter.name}</h1>
          </div>
        ) : (state.finalVote.phase === "round-one-complete" || state.finalVote.phase === "round-two-complete" || state.finalVote.phase === "explanations-complete") ? (
          <div className="projector-transition">
            <span className="projector-kicker">{t("votingStageComplete")}</span>
            <p>{state.finalVote.label}</p>
            <h1>{t(state.finalVote.phase === "round-one-complete" ? "firstRoundComplete" : state.finalVote.phase === "round-two-complete" ? "secondRoundComplete" : "explanationsComplete")}</h1>
            <div className="projector-stage-divider" aria-hidden="true"><span>✓</span><i /><span>{state.finalVote.phase === "round-one-complete" ? "2" : "3"}</span></div>
            <strong>{t("waitingForChair")}</strong>
          </div>
        ) : state.finalVote.phase === "explanations" && finalParticipant ? (
          <div className="projector-vote projector-explanation">
            <span className="projector-kicker">{t("voteExplanations")} · {state.finalVote.explanationIndex + 1}/{state.finalVote.explanationQueue.length}</span>
            <p>{state.finalVote.label}</p>
            {finalParticipant.flagUrl && <Image src={finalParticipant.flagUrl} alt="" width={192} height={128} unoptimized priority />}
            <span className="projector-action">{t("explainingVote")}</span><h1>{finalParticipant.name}</h1>
            <strong className="projector-choice">{t(state.finalVote.roundTwo[finalParticipant.id] === "for-explanation" ? "forWithExplanation" : "againstWithExplanation")}</strong>
            {(state.warnings[finalParticipant.id] ?? 0) > 0 && <span className="projector-warning">{disciplinaryLabel(state.warnings[finalParticipant.id])}</span>}
          </div>
        ) : (state.finalVote.phase === "round-one" || state.finalVote.phase === "round-two" || state.finalVote.phase === "round-three") && finalParticipant ? (
          <div className="projector-vote">
            <span className="projector-kicker">{t("roundProgress", { round: t(finalRoundKey), current: state.finalVote.currentIndex + 1, total: state.finalVote.queue.length })}</span>
            <p>{state.finalVote.label}</p>
            {finalParticipant.flagUrl && <Image src={finalParticipant.flagUrl} alt="" width={192} height={128} unoptimized priority />}
            <span className="projector-action">{t("castingVote")}</span><h1>{finalParticipant.name}</h1>
            {(state.warnings[finalParticipant.id] ?? 0) > 0 && <span className="projector-warning">{disciplinaryLabel(state.warnings[finalParticipant.id])}</span>}
          </div>
        ) : state.finalVote.phase === "complete" ? (
          <div className="projector-result">
            <span className="projector-kicker">{t("finalVoteResult")}</span><h1>{state.finalVote.label}</h1>
            <div className="projector-counts projector-counts-two"><div><strong>{finalCounts.for}</strong><span>{t("inFavor")}</span></div><div><strong>{finalCounts.against}</strong><span>{t("against")}</span></div></div>
          </div>
        ) : state.vote.status === "complete" ? (
          <div className="projector-result">
            <span className="projector-kicker">{t("voteComplete")}</span><h1>{state.vote.label}</h1>
            <div className="projector-counts projector-counts-two"><div><strong>{appealCounts.for}</strong><span>{t("inFavor")}</span></div><div><strong>{appealCounts.against}</strong><span>{t("against")}</span></div></div>
          </div>
        ) : (
          <div className="projector-idle"><span className="projector-kicker">{t("sessionInProgress")}</span><h1>{state.topic || t("waitingForDebate")}</h1>{state.currentSpeaker && <p>{t("atPodium")} <strong>{state.currentSpeaker}</strong></p>}</div>
        )}
      </section>
    </main>
  );
}
