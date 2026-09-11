"use client";

import Image from "next/image";
import { committeeDisplayAbbreviation, committeeDisplaySecretariat, type Committee } from "../lib/committees";
import { features } from "../lib/features";
import { representationFullName } from "../lib/itammun-api";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import { createInitialState, getDisciplinaryCounts } from "../lib/session-state";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";
import { formatTime } from "./TimeInput";

export function ProjectorView({ committee, sessionKey }: { committee: Committee; sessionKey: string }) {
  const { language, t } = useLanguage();
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
  const secretariat = committee.slug.startsWith("lienzo-") ? t("blankCanvas") : committeeDisplaySecretariat(committee, language);
  const abbreviation = committee.slug.startsWith("lienzo-") ? (committee.abbreviation || t("unnamedCommittee")) : committeeDisplayAbbreviation(committee, language);
  const displayedTopic = state.topicByLanguage?.[language] ?? state.topic;
  const currentSpeaker = state.participants.find((participant) => participant.id === state.currentSpeakerParticipantId);
  const currentSpeakerName = currentSpeaker ? representationFullName(currentSpeaker, language) : state.currentSpeaker;
  const interactionMode = state.currentSpeakerYield === "questions" || state.currentSpeakerYield === "comments";
  const unlimitedDocument = state.unlimitedQuestionDocument === "custom"
    ? state.unlimitedQuestionCustomLabel
    : state.unlimitedQuestionDocument
      ? t(state.unlimitedQuestionDocument === "working-a1" ? "workingPaperA1" : state.unlimitedQuestionDocument === "working-b1" ? "workingPaperB1" : state.unlimitedQuestionDocument === "possible-resolution-a1" ? "possibleResolutionA1" : "possibleResolutionB1")
      : "";
  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;
  const disciplinaryLabel = (totalWarnings: number) => {
    const discipline = getDisciplinaryCounts(totalWarnings);
    return t("disciplinaryBadge", { warnings: discipline.activeWarnings, faults: discipline.faults });
  };

  return (
    <main className="projector-shell" style={cssVars}>
      <header className="projector-header">
        <span className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></span>
        <div className="projector-header-actions"><LanguageSwitcher dark /><div className="projector-committee-heading"><span>{secretariat}</span><strong>{abbreviation}</strong></div></div>
      </header>

      <section className="projector-content">
        {features.motionsAndAppeals && state.vote.status === "active" && appealVoter ? (
          <div className="projector-vote">
            <span className="projector-kicker">{t("immediateVote")} · {t("voteProgress", { current: state.vote.currentIndex + 1, total: state.vote.queue.length })}</span>
            <p>{state.vote.label}</p>
            {appealVoter.flagUrl && <Image src={appealVoter.flagUrl} alt="" width={192} height={128} unoptimized priority />}
            <span className="projector-action">{t("castingVote")}</span><h1>{representationFullName(appealVoter, language)}</h1>
          </div>
        ) : (state.finalVote.phase === "round-one-complete" || state.finalVote.phase === "round-two-complete" || state.finalVote.phase === "explanations-complete") ? (
          <div className="projector-transition">
            <span className="projector-kicker">{t("votingStageComplete")}</span>
            <p>{displayedTopic || state.finalVote.label}</p>
            <h1>{t(state.finalVote.phase === "round-one-complete" ? "firstRoundComplete" : state.finalVote.phase === "round-two-complete" ? "secondRoundComplete" : "explanationsComplete")}</h1>
            <div className="projector-stage-divider" aria-hidden="true"><span>✓</span><i /><span>{state.finalVote.phase === "round-one-complete" ? "2" : "3"}</span></div>
            <strong>{t("waitingForChair")}</strong>
          </div>
        ) : state.finalVote.phase === "explanations" && finalParticipant ? (
          <div className="projector-vote projector-explanation">
            <span className="projector-kicker">{t("voteExplanations")} · {state.finalVote.explanationIndex + 1}/{state.finalVote.explanationQueue.length}</span>
            <p>{displayedTopic || state.finalVote.label}</p>
            {finalParticipant.flagUrl && <Image src={finalParticipant.flagUrl} alt="" width={192} height={128} unoptimized priority />}
            <span className="projector-action">{t("explainingVote")}</span><h1>{representationFullName(finalParticipant, language)}</h1>
            <strong className="projector-choice">{t(state.finalVote.roundTwo[finalParticipant.id] === "for-explanation" ? "forWithExplanation" : "againstWithExplanation")}</strong>
            {(state.warnings[finalParticipant.id] ?? 0) > 0 && <span className="projector-warning">{disciplinaryLabel(state.warnings[finalParticipant.id])}</span>}
          </div>
        ) : (state.finalVote.phase === "round-one" || state.finalVote.phase === "round-two" || state.finalVote.phase === "round-three") && finalParticipant ? (
          <div className="projector-vote">
            <span className="projector-kicker">{t("roundProgress", { round: t(finalRoundKey), current: state.finalVote.currentIndex + 1, total: state.finalVote.queue.length })}</span>
            <p>{displayedTopic || state.finalVote.label}</p>
            {finalParticipant.flagUrl && <Image src={finalParticipant.flagUrl} alt="" width={192} height={128} unoptimized priority />}
            <span className="projector-action">{t("castingVote")}</span><h1>{representationFullName(finalParticipant, language)}</h1>
            {(state.warnings[finalParticipant.id] ?? 0) > 0 && <span className="projector-warning">{disciplinaryLabel(state.warnings[finalParticipant.id])}</span>}
          </div>
        ) : state.finalVote.phase === "complete" ? (
          <div className="projector-result">
            <span className="projector-kicker">{t("finalVoteResult")}</span><h1>{displayedTopic || state.finalVote.label}</h1>
            <div className="projector-counts projector-counts-two"><div><strong>{finalCounts.for}</strong><span>{t("inFavor")}</span></div><div><strong>{finalCounts.against}</strong><span>{t("against")}</span></div></div>
          </div>
        ) : features.motionsAndAppeals && state.vote.status === "complete" ? (
          <div className="projector-result">
            <span className="projector-kicker">{t("voteComplete")}</span><h1>{state.vote.label}</h1>
            <div className="projector-counts projector-counts-two"><div><strong>{appealCounts.for}</strong><span>{t("inFavor")}</span></div><div><strong>{appealCounts.against}</strong><span>{t("against")}</span></div></div>
          </div>
        ) : interactionMode && state.currentSpeaker ? (
          <div className="projector-speaker-interaction">
            <span className="projector-kicker">{displayedTopic}</span>
            <p>{t(state.currentSpeakerYield === "comments" ? "commentsWithSpeaker" : "questionsWithSpeaker", { name: currentSpeakerName })}</p>
            <h1>{formatTime(state.currentSpeakerRemainingTime)}</h1>
            <strong>{currentSpeakerName}</strong>
          </div>
        ) : state.activeModule === "unlimited-questions" ? (
          <div className="projector-unlimited-questions">
            <span className="projector-kicker">{t("freeParticipation")} · {t("noTimerNoQueue")}</span>
            <h1>{t("unlimitedQuestionsSession")}</h1>
            <p>{unlimitedDocument || t("noDocumentSelected")}</p>
          </div>
        ) : state.activeModule === "speakers" && state.currentSpeaker ? (
          <div className="projector-speaker-interaction">
            <span className="projector-kicker">{t("currentSpeaker")} · {displayedTopic}</span>
            <h1>{formatTime(state.currentSpeakerRemainingTime)}</h1>
            <strong>{currentSpeakerName}</strong>
          </div>
        ) : (
          <div className="projector-idle"><span className="projector-kicker">{t("sessionInProgress")}</span><h1>{displayedTopic || t("waitingForDebate")}</h1>{state.currentSpeaker && <p>{t("atPodium")} <strong>{state.currentSpeakerParticipantId ? representationFullName(state.participants.find((participant) => participant.id === state.currentSpeakerParticipantId) ?? { id: "legacy", name: state.currentSpeaker, observer: false }, language) : state.currentSpeaker}</strong></p>}</div>
        )}
      </section>
    </main>
  );
}
