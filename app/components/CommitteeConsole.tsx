"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Committee } from "../lib/committees";
import type { CommitteeDetail } from "../lib/itammun-api";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import {
  advanceFinalVoteExplanation,
  castFinalVote,
  createInitialFinalVoteState,
  createInitialState,
  startFinalVote,
  type AttendanceStatus,
  type CaucusMode,
  type ConsoleTab,
  type FinalVoteRoundTwoChoice,
  type SessionState,
  type VoteChoice,
} from "../lib/session-state";
import { formatTime, TimeInput } from "./TimeInput";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";
import { SpeakerQueue } from "./SpeakerQueue";

const tabIds: ConsoleTab[] = ["rollcall", "speakers", "caucus", "motions", "voting", "log"];
const attendanceValues: Array<Exclude<AttendanceStatus, "pending">> = ["present", "present-voting", "absent", "observer"];

export function CommitteeConsole({ committee, detail, sessionKey }: {
  committee: Committee;
  detail: CommitteeDetail;
  sessionKey: string;
}) {
  const { language, t } = useLanguage();
  const { state, update } = useLocalCommitteeState(sessionKey, createInitialState(detail.representations));
  const [activeTab, setActiveTab] = useState<ConsoleTab>("rollcall");
  const [rollCallView, setRollCallView] = useState<"attendance" | "warnings">("attendance");
  const [speakerView, setSpeakerView] = useState<"list" | "questions">("list");
  const [speakerParticipantId, setSpeakerParticipantId] = useState("");
  const [questionParticipantId, setQuestionParticipantId] = useState("");
  const [topicDraft, setTopicDraft] = useState("");
  const [customTopicMode, setCustomTopicMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(state.currentSpeakerAllottedTime);
  const [running, setRunning] = useState(false);
  const [questionRemaining, setQuestionRemaining] = useState(state.speakerTime);
  const [questionRunning, setQuestionRunning] = useState(false);
  const [caucusMode, setCaucusMode] = useState<CaucusMode>("moderated");
  const [caucusRemaining, setCaucusRemaining] = useState(state.caucuses.moderated.duration);
  const [caucusRunning, setCaucusRunning] = useState(false);
  const [appealAppellant, setAppealAppellant] = useState("");
  const [appealRuling, setAppealRuling] = useState("");

  const tabLabels: Record<ConsoleTab, string> = {
    rollcall: t("rollCall"), speakers: t("speakers"), caucus: t("caucusAndExtensions"),
    motions: t("motions"), voting: t("nominalVoting"), log: t("log"),
  };
  const attendanceLabels: Record<Exclude<AttendanceStatus, "pending">, string> = {
    present: t("present"), "present-voting": t("presentAndVoting"), absent: t("absent"), observer: t("observer"),
  };

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((value) => {
      if (value <= 1) setRunning(false);
      return Math.max(0, value - 1);
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running, remaining]);

  useEffect(() => {
    if (!questionRunning || questionRemaining <= 0) return;
    const timer = window.setInterval(() => setQuestionRemaining((value) => {
      if (value <= 1) setQuestionRunning(false);
      return Math.max(0, value - 1);
    }), 1000);
    return () => window.clearInterval(timer);
  }, [questionRemaining, questionRunning]);

  useEffect(() => {
    if (!caucusRunning || caucusRemaining <= 0) return;
    const timer = window.setInterval(() => setCaucusRemaining((value) => {
      if (value <= 1) setCaucusRunning(false);
      return Math.max(0, value - 1);
    }), 1000);
    return () => window.clearInterval(timer);
  }, [caucusRunning, caucusRemaining]);

  const attendance = useMemo(() => {
    const values = Object.values(state.attendance);
    const inRoom = values.filter((value) => value === "present" || value === "present-voting" || value === "observer").length;
    const membersPresent = values.filter((value) => value === "present" || value === "present-voting").length;
    const voting = values.filter((value) => value === "present-voting").length;
    const assigned = new Set(state.assignedParticipantIds);
    const memberCount = state.participants.filter((participant) => !participant.observer && (
      assigned.has(participant.id) || (state.attendance[participant.id] !== "pending" && state.attendance[participant.id] !== "observer")
    )).length;
    return { inRoom, voting, quorum: membersPresent > 0 && membersPresent >= Math.floor(memberCount / 2) + 1 };
  }, [state.assignedParticipantIds, state.attendance, state.participants]);

  const orderedParticipants = useMemo(() => {
    const assigned = new Set(state.assignedParticipantIds);
    return [...state.participants].sort((left, right) => {
      const assignmentDifference = Number(assigned.has(right.id)) - Number(assigned.has(left.id));
      return assignmentDifference || left.name.localeCompare(right.name, language);
    });
  }, [language, state.assignedParticipantIds, state.participants]);

  const eligibleVoters = useMemo(
    () => state.participants.filter((participant) => state.attendance[participant.id] === "present-voting"),
    [state.attendance, state.participants],
  );
  const topicLocked = state.speakers.length > 0;
  const knownTopic = detail.topics.includes(state.topic);
  const topicSelectValue = customTopicMode || (state.topic && !knownTopic) ? "__custom" : state.topic;
  const currentAppealVoterId = state.vote.status === "active" ? state.vote.queue[state.vote.currentIndex] : undefined;
  const currentAppealVoter = state.participants.find((participant) => participant.id === currentAppealVoterId);
  const appealVoteCounts = Object.values(state.vote.ballots).reduce((counts, choice) => ({ ...counts, [choice]: counts[choice] + 1 }), { for: 0, against: 0 });
  const finalVoteParticipantId = state.finalVote.phase === "explanations"
    ? state.finalVote.explanationQueue[state.finalVote.explanationIndex]
    : state.finalVote.queue[state.finalVote.currentIndex];
  const finalVoteParticipant = state.participants.find((participant) => participant.id === finalVoteParticipantId);
  const finalVoteCounts = Object.values(state.finalVote.roundThree).reduce((counts, choice) => ({ ...counts, [choice]: counts[choice] + 1 }), { for: 0, against: 0 });
  const activeCaucus = state.caucuses[caucusMode];
  const secretariat = committee.slug.startsWith("lienzo-") ? t("blankCanvas") : committee.secretariat;

  function updateTopic(topic: string) {
    update((current) => ({
      ...current,
      topic,
      events: topic && topic !== current.topic ? [{ key: "eventTopicDefined", values: { topic } }, ...current.events] : current.events,
    }));
  }

  function addSpeaker() {
    const participant = state.participants.find((item) => item.id === speakerParticipantId);
    if (!participant || !state.topic) return;
    update((current) => ({
      ...current,
      speakers: [...current.speakers, { id: crypto.randomUUID(), participantId: participant.id, name: participant.name, bonusSeconds: 0 }],
      events: [{ key: "eventSpeakerAdded", values: { name: participant.name } }, ...current.events],
    }));
    setSpeakerParticipantId("");
  }

  function beginNextSpeaker(donatedSeconds = 0) {
    const next = state.speakers[0];
    if (!next) return;
    const bonus = (next.bonusSeconds ?? 0) + donatedSeconds;
    const allotted = state.speakerTime + bonus;
    const priorSpeaker = state.currentSpeaker;
    update((current) => ({
      ...current,
      speakers: current.speakers.slice(1),
      currentSpeaker: next.name,
      currentSpeakerParticipantId: next.participantId ?? "",
      currentSpeakerAllottedTime: allotted,
      currentSpeakerReceivedDonation: donatedSeconds > 0 || (next.bonusSeconds ?? 0) > 0,
      events: [
        ...(donatedSeconds > 0 && priorSpeaker ? [{ key: "eventSpeakerYieldedNext" as const, values: { name: priorSpeaker, time: formatTime(donatedSeconds), recipient: next.name } }] : []),
        { key: "eventSpeakerStarted", values: { name: next.name, time: formatTime(allotted) } },
        ...current.events,
      ],
    }));
    setRemaining(allotted);
    setRunning(false);
  }

  function yieldToChair() {
    if (!state.currentSpeaker || remaining <= 0) return;
    const name = state.currentSpeaker;
    update((current) => ({
      ...current,
      currentSpeaker: "",
      currentSpeakerParticipantId: "",
      currentSpeakerAllottedTime: current.speakerTime,
      currentSpeakerReceivedDonation: false,
      events: [{ key: "eventSpeakerYieldedChair", values: { name, time: formatTime(remaining) } }, ...current.events],
    }));
    setRemaining(state.speakerTime);
    setRunning(false);
  }

  function addQuestioner() {
    const participant = state.participants.find((item) => item.id === questionParticipantId);
    if (!participant || !state.currentSpeaker) return;
    update((current) => ({
      ...current,
      questionQueue: [...current.questionQueue, { id: crypto.randomUUID(), participantId: participant.id, name: participant.name }],
      events: [{ key: "eventQuestionerAdded", values: { name: participant.name } }, ...current.events],
    }));
    setQuestionParticipantId("");
  }

  function nextQuestioner() {
    const next = state.questionQueue[0];
    if (!next || !state.currentSpeaker) return;
    update((current) => ({
      ...current,
      questionQueue: current.questionQueue.slice(1),
      currentQuestioner: next.name,
      events: [{ key: "eventQuestionStarted", values: { name: next.name, time: formatTime(current.speakerTime) } }, ...current.events],
    }));
    setQuestionRemaining(state.speakerTime);
    setQuestionRunning(false);
  }

  function addWarning(participantId: string, name: string) {
    update((current) => {
      const count = (current.warnings[participantId] ?? 0) + 1;
      return { ...current, warnings: { ...current.warnings, [participantId]: count }, events: [{ key: "eventWarningAdded", values: { name, count } }, ...current.events] };
    });
  }

  function undoWarning(participantId: string, name: string) {
    update((current) => {
      const count = Math.max(0, (current.warnings[participantId] ?? 0) - 1);
      return { ...current, warnings: { ...current.warnings, [participantId]: count }, events: [{ key: "eventWarningRemoved", values: { name, count } }, ...current.events] };
    });
  }

  function selectCaucusMode(mode: CaucusMode) {
    setCaucusMode(mode);
    setCaucusRemaining(state.caucuses[mode].duration);
    setCaucusRunning(false);
  }

  async function share() {
    const setupUrl = new URL(`/comite/${sessionKey}/setup`, window.location.origin);
    setupUrl.searchParams.set("nombre", committee.name);
    await navigator.clipboard.writeText(setupUrl.toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function addAppeal() {
    const appellant = appealAppellant.trim();
    const ruling = appealRuling.trim();
    if (!appellant || !ruling) return;
    update((current) => ({
      ...current,
      appeals: [{ id: crypto.randomUUID(), appellant, ruling, status: "pending" }, ...current.appeals],
      events: [{ key: "eventAppealAdded", values: { name: appellant } }, ...current.events],
    }));
    setAppealAppellant("");
    setAppealRuling("");
  }

  function startAppealVote(label: string, appealId: string) {
    const queue = eligibleVoters.map((participant) => participant.id);
    if (!label.trim() || queue.length === 0) return;
    update((current) => ({
      ...current,
      vote: { label: label.trim(), context: "appeal", appealId, queue, currentIndex: 0, ballots: {}, status: "active" },
      events: [{ key: "eventVoteStarted", values: { label: label.trim() } }, ...current.events],
    }));
  }

  function castAppealVote(choice: VoteChoice) {
    if (!currentAppealVoterId) return;
    update((current) => {
      const ballots = { ...current.vote.ballots, [currentAppealVoterId]: choice };
      const complete = current.vote.currentIndex >= current.vote.queue.length - 1;
      let appeals = current.appeals;
      const extraEvents: SessionState["events"] = [];
      if (complete && current.vote.appealId) {
        const values = Object.values(ballots);
        const forOverturn = values.filter((value) => value === "for").length;
        const againstOverturn = values.filter((value) => value === "against").length;
        const overturned = forOverturn > againstOverturn;
        appeals = current.appeals.map((appeal) => appeal.id === current.vote.appealId ? { ...appeal, status: overturned ? "overturned" as const : "upheld" as const } : appeal);
        extraEvents.push({ key: overturned ? "eventRulingOverturned" : "eventRulingUpheld" });
      }
      return {
        ...current,
        appeals,
        vote: { ...current.vote, ballots, currentIndex: complete ? current.vote.currentIndex : current.vote.currentIndex + 1, status: complete ? "complete" : "active" },
        events: [...extraEvents, ...current.events],
      };
    });
  }

  function beginFinalVote() {
    const queue = eligibleVoters.map((participant) => participant.id);
    if (!state.topic || queue.length === 0) return;
    update((current) => ({
      ...current,
      finalVote: startFinalVote(current.topic, queue),
      events: [{ key: "eventFinalVoteStarted", values: { label: current.topic } }, ...current.events],
    }));
  }

  function recordFinalVote(choice: FinalVoteRoundTwoChoice) {
    if (!finalVoteParticipantId) return;
    update((current) => {
      const finalVote = castFinalVote(current.finalVote, finalVoteParticipantId, choice);
      const completedNow = current.finalVote.phase !== "complete" && finalVote.phase === "complete";
      return {
        ...current,
        finalVote,
        events: completedNow ? [{ key: "eventFinalVoteCompleted", values: { label: finalVote.label } }, ...current.events] : current.events,
      };
    });
  }

  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;

  return (
    <main className="console-shell" style={cssVars}>
      <header className="console-header">
        <Link href="/" className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></Link>
        <div className="committee-heading"><span>{secretariat}</span><h1>{committee.abbreviation}</h1></div>
        <div className="sharing-tools">
          <span className="sync-state sync-local">{t("savedLocally")}</span>
          <a className="secondary-button" href={`/comite/${sessionKey}/setup?nombre=${encodeURIComponent(committee.name)}`}>{t("newSession")}</a>
          <a className="secondary-button" href={`/comite/${sessionKey}/pantalla?nombre=${encodeURIComponent(committee.name)}`} target="_blank" rel="noreferrer">{t("screen")}</a>
          <button className="secondary-button" onClick={share}>{t(copied ? "linkCopied" : "share")}</button>
          <LanguageSwitcher dark />
        </div>
      </header>

      <section className={`session-topic-strip ${state.topic ? "topic-ready" : ""}`}>
        <span className="section-kicker">{t("topic")}</span>
        <strong>{state.topic || t("topicPending")}</strong>
      </section>

      <nav className="console-tabs" aria-label={t("committeeModules")}>
        {tabIds.map((tabId) => {
          const disabled = tabId !== "rollcall" && !state.topic;
          return <button key={tabId} disabled={disabled} title={disabled ? t("defineTopicHint") : undefined} className={activeTab === tabId ? "active" : ""} onClick={() => setActiveTab(tabId)}>{tabLabels[tabId]}</button>;
        })}
      </nav>

      <div className="console-workspace">
        {activeTab === "rollcall" && (
          <section className="module-panel rollcall-module">
            <div className="module-title-row"><div><span className="section-kicker">{t("alwaysEditable")}</span><h2>{t("rollCall")}</h2></div><div className={`quorum-pill ${attendance.quorum ? "has-quorum" : ""}`}>{t("inRoomQuorum", { inRoom: attendance.inRoom, total: state.participants.length, quorum: t(attendance.quorum ? "hasQuorum" : "noQuorum") })}</div></div>
            <div className="console-subtabs" role="group" aria-label={t("rollCall")}><button className={rollCallView === "attendance" ? "active" : ""} onClick={() => setRollCallView("attendance")}>{t("attendanceView")}</button><button className={rollCallView === "warnings" ? "active" : ""} onClick={() => setRollCallView("warnings")}>{t("warningsView")}</button></div>

            {rollCallView === "attendance" ? <>
              <div className="attendance-summary"><span>{t("inRoom")} <strong>{attendance.inRoom}</strong></span><span>{t("presentAndVoting")} <strong>{attendance.voting}</strong></span><span>{t("simpleMajority")} <strong>{Math.floor(attendance.voting / 2) + 1}</strong></span><span>{t("qualifiedMajority")} <strong>{Math.ceil(attendance.voting * 2 / 3)}</strong></span></div>
              <section className={`topic-editor ${topicLocked ? "is-locked" : ""}`}>
                <div><span className="section-kicker">{t("sessionTopic")}</span><h3>{state.topic || t("selectOrCreateTopic")}</h3>{topicLocked && <p>{t("emptyQueueToChangeTopic")}</p>}</div>
                <div className="topic-editor-controls">
                  {detail.topics.length > 0 && <select aria-label={t("sessionTopic")} disabled={topicLocked} value={topicSelectValue} onChange={(event) => {
                    if (event.target.value === "__custom") { setTopicDraft(state.topic && !knownTopic ? state.topic : ""); setCustomTopicMode(true); return; }
                    setCustomTopicMode(false); setTopicDraft(""); updateTopic(event.target.value);
                  }}><option value="">{t("selectTopic")}</option>{detail.topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}<option value="__custom">{t("writeOtherTopic")}</option></select>}
                  {(detail.topics.length === 0 || customTopicMode || (state.topic && !knownTopic)) && <form onSubmit={(event) => {
                    event.preventDefault(); const topic = topicDraft.trim(); if (!topic || topicLocked) return; updateTopic(topic); setTopicDraft(topic); setCustomTopicMode(false);
                  }}><input disabled={topicLocked} value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} placeholder={t("writeTopic")} aria-label={t("newTopic")} /><button type="submit" disabled={topicLocked || !topicDraft.trim()}>{t("defineTopic")}</button></form>}
                </div>
              </section>
              <div className="attendance-list">{orderedParticipants.map((representation) => {
                const value = state.attendance[representation.id] || "pending";
                const initiallyAssigned = state.assignedParticipantIds.includes(representation.id);
                return <article className="attendance-row" key={representation.id}>
                  <div className="attendance-person">{representation.flagUrl && <Image src={representation.flagUrl} alt="" width={32} height={22} unoptimized />}<span>{representation.name}</span><em>{t(initiallyAssigned ? "initialSeat" : "available")}</em></div>
                  <div className="attendance-buttons" role="group" aria-label={t("attendanceFor", { name: representation.name })}>{attendanceValues.map((option) => <button key={option} type="button" aria-pressed={value === option} className={`attendance-button status-${option}`} onClick={() => update((current) => ({ ...current, attendance: { ...current.attendance, [representation.id]: option } }))}>{attendanceLabels[option]}</button>)}<button type="button" className="attendance-clear" disabled={value === "pending"} onClick={() => update((current) => ({ ...current, attendance: { ...current.attendance, [representation.id]: "pending" } }))}>{t("clear")}</button></div>
                </article>;
              })}</div>
            </> : <div className="warnings-panel">
              <p className="module-note">{t("warningsIntro")}</p>
              <div className="warnings-list">{orderedParticipants.map((participant) => {
                const count = state.warnings[participant.id] ?? 0;
                return <article className="warning-row" key={participant.id}>
                  <div className="attendance-person">{participant.flagUrl && <Image src={participant.flagUrl} alt="" width={32} height={22} unoptimized />}<span>{participant.name}</span>{count > 0 && <em>{t("warningCount", { count })}</em>}</div>
                  <strong>{count}</strong>
                  <div><button className="warning-add" onClick={() => addWarning(participant.id, participant.name)}>{t("addWarning")}</button><button disabled={count === 0} onClick={() => undoWarning(participant.id, participant.name)}>{t("undoWarning")}</button></div>
                </article>;
              })}</div>
            </div>}
          </section>
        )}

        {activeTab === "speakers" && (
          <section className="speakers-module">
            <div className="console-subtabs speakers-subtabs" role="group" aria-label={t("speakers")}><button className={speakerView === "list" ? "active" : ""} onClick={() => setSpeakerView("list")}>{t("speakerListMode")}</button><button className={speakerView === "questions" ? "active" : ""} onClick={() => setSpeakerView("questions")}>{t("extraordinaryQuestions")}</button></div>
            {speakerView === "list" ? <div className="speakers-layout">
              <div className="speaker-stage">
                <div className="stage-label">{t("currentSpeaker")}</div><h2>{state.currentSpeaker || t("noSpeaker")}</h2><div className="timer-display">{formatTime(remaining)}</div>
                {state.currentSpeakerReceivedDonation && <span className="donation-note">{t("allottedWithDonation", { base: formatTime(state.speakerTime), donation: formatTime(Math.max(0, state.currentSpeakerAllottedTime - state.speakerTime)) })}</span>}
                <TimeInput label={t("allottedTime")} seconds={state.speakerTime} onChange={(seconds) => { if (!state.currentSpeaker) setRemaining(seconds); update((current) => ({ ...current, speakerTime: seconds, currentSpeakerAllottedTime: current.currentSpeaker ? current.currentSpeakerAllottedTime : seconds })); }} compact />
                <div className="primary-controls"><button onClick={() => { setRemaining(state.currentSpeaker ? state.currentSpeakerAllottedTime : state.speakerTime); setRunning(false); }}>{t("reset")}</button><button className="primary-button" disabled={!state.currentSpeaker} onClick={() => setRunning((value) => !value)}>{t(running ? "pause" : "start")}</button><button disabled={state.speakers.length === 0} onClick={() => beginNextSpeaker()}>{t("nextSpeaker")}</button></div>
                {state.currentSpeaker && remaining > 0 && <div className="yield-panel"><span>{t("yieldRemainingTime")}</span><div><button onClick={yieldToChair}>{t("yieldToChair")}</button><button disabled={state.speakers.length === 0 || state.currentSpeakerReceivedDonation} onClick={() => beginNextSpeaker(remaining)}>{t("yieldToNextSpeaker")}</button></div></div>}
              </div>
              <div className="queue-panel">
                <div className="panel-heading"><div><span className="section-kicker">{t("generalList")}</span><h2>{t("nextSpeakers")}</h2></div><span>{state.speakers.length}</span></div>
                <form className="speaker-form" onSubmit={(event) => { event.preventDefault(); addSpeaker(); }}><select aria-label={t("selectNextSpeaker")} value={speakerParticipantId} onChange={(event) => setSpeakerParticipantId(event.target.value)}><option value="">{t("selectCountryOrRepresentation")}</option>{state.participants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="primary-button" disabled={!speakerParticipantId}>{t("add")}</button></form>
                <SpeakerQueue items={state.speakers} onChange={(speakers, event) => update((current) => ({ ...current, speakers, events: [event, ...current.events] }))} />
              </div>
            </div> : <div className="speakers-layout questions-layout">
              <div className="speaker-stage">
                <div className="stage-label">{t("currentQuestioner")}</div><h2>{state.currentQuestioner || t("noQuestioner")}</h2><div className="timer-display">{formatTime(questionRemaining)}</div>
                <TimeInput label={t("allottedTime")} seconds={state.speakerTime} onChange={(seconds) => { setQuestionRemaining(seconds); update((current) => ({ ...current, speakerTime: seconds })); }} compact />
                <div className="primary-controls"><button onClick={() => { setQuestionRemaining(state.speakerTime); setQuestionRunning(false); }}>{t("reset")}</button><button className="primary-button" disabled={!state.currentQuestioner} onClick={() => setQuestionRunning((value) => !value)}>{t(questionRunning ? "pause" : "start")}</button><button disabled={!state.currentSpeaker || state.questionQueue.length === 0} onClick={nextQuestioner}>{t("nextQuestioner")}</button></div>
              </div>
              <div className="queue-panel">
                <div className="question-target"><span className="section-kicker">{t("questionTarget")}</span><h2>{state.currentSpeaker ? t("questionTargetName", { name: state.currentSpeaker }) : t("noQuestionTarget")}</h2></div>
                <div className="panel-heading"><div><span className="section-kicker">{t("extraordinaryQuestions")}</span><h2>{t("questionQueue")}</h2></div><span>{state.questionQueue.length}</span></div>
                <form className="speaker-form" onSubmit={(event) => { event.preventDefault(); addQuestioner(); }}><select disabled={!state.currentSpeaker} aria-label={t("selectQuestioner")} value={questionParticipantId} onChange={(event) => setQuestionParticipantId(event.target.value)}><option value="">{t("selectCountryOrRepresentation")}</option>{state.participants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="primary-button" disabled={!state.currentSpeaker || !questionParticipantId}>{t("add")}</button></form>
                <SpeakerQueue emptyText={t("emptyQuestionQueue")} items={state.questionQueue} onChange={(questionQueue, event) => update((current) => ({ ...current, questionQueue, events: [event, ...current.events] }))} />
              </div>
            </div>}
          </section>
        )}

        {activeTab === "caucus" && (
          <section className="caucus-module">
            <div className="console-subtabs caucus-subtabs" role="group" aria-label={t("caucusAndExtensions")}><button className={caucusMode === "moderated" ? "active" : ""} onClick={() => selectCaucusMode("moderated")}>{t("moderatedCaucus")}</button><button className={caucusMode === "simple" ? "active" : ""} onClick={() => selectCaucusMode("simple")}>{t("simpleCaucus")}</button></div>
            <div className="caucus-focus">
              <span className="section-kicker">{t(caucusMode === "moderated" ? "moderatedCaucus" : "simpleCaucus")} · {t("topic")}</span><h2>{state.topic}</h2><p className="caucus-mode-hint">{t(caucusMode === "moderated" ? "moderatedCaucusHint" : "simpleCaucusHint")}</p>
              <div className="timer-display">{formatTime(caucusRemaining)}</div>
              <TimeInput label={t("totalDuration")} seconds={activeCaucus.duration} onChange={(seconds) => { setCaucusRemaining(seconds); update((current) => ({ ...current, caucuses: { ...current.caucuses, [caucusMode]: { duration: seconds, extension: Math.max(0, seconds - 1) } } })); }} compact />
              <div className="caucus-main-controls"><button onClick={() => { setCaucusRemaining(activeCaucus.duration); setCaucusRunning(false); }}>{t("reset")}</button><button className="caucus-primary" onClick={() => setCaucusRunning((value) => !value)}>{t(caucusRunning ? "pause" : "startCaucus")}</button><button className="caucus-extension-button" onClick={() => { const extension = Math.max(0, activeCaucus.duration - 1); setCaucusRemaining(extension); setCaucusRunning(false); update((current) => ({ ...current, caucuses: { ...current.caucuses, [caucusMode]: { ...current.caucuses[caucusMode], extension } }, events: [{ key: "eventCaucusModeExtended", values: { mode: t(caucusMode === "moderated" ? "moderatedCaucus" : "simpleCaucus"), time: formatTime(extension) } }, ...current.events] })); }}>{t("applyMinusOne")}</button><button onClick={() => { setCaucusRemaining(0); setCaucusRunning(false); }}>{t("finish")}</button></div>
            </div>
          </section>
        )}

        {activeTab === "motions" && (
          <section className="module-panel motions-module">
            <div className="module-title-row"><div><span className="section-kicker">{t("immediateVote")}</span><h2>{t("appealsToChair")}</h2></div><span className="rule-tag">{t("onlyPresentAndVoting")}</span></div>
            {state.vote.status === "active" && currentAppealVoter ? <div className="nominal-vote procedural-vote"><div className="vote-progress">{t("voteProgress", { current: state.vote.currentIndex + 1, total: state.vote.queue.length })}</div>{currentAppealVoter.flagUrl && <Image src={currentAppealVoter.flagUrl} alt="" width={96} height={64} unoptimized />}<span>{t("castingVote")}</span><h2>{currentAppealVoter.name}</h2><p>{state.vote.label}</p><div className="vote-actions"><button onClick={() => castAppealVote("for")}>{t("inFavor")}</button><button onClick={() => castAppealVote("against")}>{t("against")}</button></div></div> : state.vote.status === "complete" ? <div className="vote-result procedural-vote"><span className="section-kicker">{t("voteComplete")}</span><h2>{state.vote.label}</h2><div className="vote-counts vote-counts-two"><div><strong>{appealVoteCounts.for}</strong><span>{t("inFavor")}</span></div><div><strong>{appealVoteCounts.against}</strong><span>{t("against")}</span></div></div><button onClick={() => update((current) => ({ ...current, vote: { label: "", context: "appeal", queue: [], currentIndex: 0, ballots: {}, status: "idle" } }))}>{t("closeProceduralVote")}</button></div> : <>
              <p className="module-note">{t("appealExplanation")}</p>
              <form className="appeal-form" onSubmit={(event) => { event.preventDefault(); addAppeal(); }}>
                <label>{t("appellant")}<input list="appeal-participants" value={appealAppellant} onChange={(event) => setAppealAppellant(event.target.value)} placeholder={t("appellantPlaceholder")} /></label>
                <datalist id="appeal-participants">{state.participants.map((item) => <option key={item.id} value={item.name} />)}</datalist>
                <label>{t("appealedRuling")}<textarea value={appealRuling} onChange={(event) => setAppealRuling(event.target.value)} placeholder={t("appealedRulingPlaceholder")} /></label>
                <button className="primary-button">{t("registerAppeal")}</button>
              </form>
              <div className="appeal-list">{state.appeals.length === 0 && <p className="empty-state">{t("noAppeals")}</p>}{state.appeals.map((appeal) => <article key={appeal.id}><div><span>{appeal.appellant}</span><strong>{appeal.ruling}</strong></div>{appeal.status === "pending" ? <button disabled={eligibleVoters.length === 0} title={eligibleVoters.length === 0 ? t("markEligibleVoter") : undefined} onClick={() => startAppealVote(t("overturnQuestion", { ruling: appeal.ruling }), appeal.id)}>{t("openVoteCount", { count: eligibleVoters.length })}</button> : <span className={`appeal-status ${appeal.status}`}>{t(appeal.status === "upheld" ? "rulingUpheld" : "rulingOverturned")}</span>}</article>)}</div>
            </>}
          </section>
        )}

        {activeTab === "voting" && (
          <section className="module-panel voting-module final-voting-module">
            <div className="module-title-row"><div><span className="section-kicker">{t("onlyPresentAndVoting")}</span><h2>{t("finalVoting")}</h2></div><a className="projector-link" href={`/comite/${sessionKey}/pantalla?nombre=${encodeURIComponent(committee.name)}`} target="_blank" rel="noreferrer">{t("openPublicScreen")}</a></div>
            {state.finalVote.phase === "idle" && <div className="vote-start final-vote-start"><p>{t("finalVotingIntro")}</p><div className="final-topic-card"><span>{t("finalVoteTopic")}</span><strong>{state.topic}</strong></div><p>{t("eligibleCountries", { count: eligibleVoters.length })}</p><button className="primary-button" disabled={!state.topic || eligibleVoters.length === 0} onClick={beginFinalVote}>{t("startFinalVote", { count: eligibleVoters.length })}</button>{eligibleVoters.length === 0 && <button className="inline-link" onClick={() => setActiveTab("rollcall")}>{t("goToRollCall")}</button>}</div>}
            {(state.finalVote.phase === "round-one" || state.finalVote.phase === "round-two" || state.finalVote.phase === "round-three") && finalVoteParticipant && <div className="nominal-vote final-vote-stage">
              <div className="vote-progress">{t("roundProgress", { round: t(state.finalVote.phase === "round-one" ? "finalRoundOne" : state.finalVote.phase === "round-two" ? "finalRoundTwo" : "finalRoundThree"), current: state.finalVote.currentIndex + 1, total: state.finalVote.queue.length })}</div>
              {finalVoteParticipant.flagUrl && <Image src={finalVoteParticipant.flagUrl} alt="" width={96} height={64} unoptimized />}<span>{t("castingVote")}</span><h2>{finalVoteParticipant.name}</h2><p>{state.finalVote.label}</p>{(state.warnings[finalVoteParticipant.id] ?? 0) > 0 && <strong className="warning-badge">{t("warningBadge", { count: state.warnings[finalVoteParticipant.id] })}</strong>}
              <div className={`vote-actions final-vote-actions ${state.finalVote.phase === "round-two" ? "five-options" : ""}`}><button onClick={() => recordFinalVote("for")}>{t("inFavor")}</button><button onClick={() => recordFinalVote("against")}>{t("against")}</button>{state.finalVote.phase !== "round-three" && <button onClick={() => recordFinalVote("abstain")}>{t("abstention")}</button>}{state.finalVote.phase === "round-two" && <><button onClick={() => recordFinalVote("for-explanation")}>{t("forWithExplanation")}</button><button onClick={() => recordFinalVote("against-explanation")}>{t("againstWithExplanation")}</button></>}</div>
            </div>}
            {state.finalVote.phase === "explanations" && finalVoteParticipant && <div className="nominal-vote explanation-stage"><div className="vote-progress">{t("explanationProgress", { current: state.finalVote.explanationIndex + 1, total: state.finalVote.explanationQueue.length })}</div>{finalVoteParticipant.flagUrl && <Image src={finalVoteParticipant.flagUrl} alt="" width={96} height={64} unoptimized />}<span>{t("explainingVote")}</span><h2>{finalVoteParticipant.name}</h2><p>{t(state.finalVote.roundTwo[finalVoteParticipant.id] === "for-explanation" ? "forWithExplanation" : "againstWithExplanation")}</p>{(state.warnings[finalVoteParticipant.id] ?? 0) > 0 && <strong className="warning-badge">{t("warningBadge", { count: state.warnings[finalVoteParticipant.id] })}</strong>}<button className="primary-button explanation-next" onClick={() => update((current) => ({ ...current, finalVote: advanceFinalVoteExplanation(current.finalVote) }))}>{t(state.finalVote.explanationIndex < state.finalVote.explanationQueue.length - 1 ? "nextExplanation" : "beginThirdRound")}</button></div>}
            {state.finalVote.phase === "complete" && <div className="vote-result final-vote-result"><span className="section-kicker">{t("finalVoteResult")}</span><h2>{state.finalVote.label}</h2><div className="vote-counts vote-counts-two"><div><strong>{finalVoteCounts.for}</strong><span>{t("inFavor")}</span></div><div><strong>{finalVoteCounts.against}</strong><span>{t("against")}</span></div></div><div className="final-vote-audit">{state.finalVote.queue.map((participantId) => { const participant = state.participants.find((item) => item.id === participantId); if (!participant) return null; const warnings = state.warnings[participantId] ?? 0; return <div key={participantId}><span>{participant.name}</span><strong>{t(state.finalVote.roundThree[participantId] === "for" ? "inFavor" : "against")}</strong>{warnings > 0 && <em>{t("warningBadge", { count: warnings })}</em>}</div>; })}</div><button onClick={() => update((current) => ({ ...current, finalVote: createInitialFinalVoteState() }))}>{t("resetFinalVote")}</button></div>}
          </section>
        )}

        {activeTab === "log" && <section className="module-panel"><div className="module-title-row"><div><span className="section-kicker">{t("localRecord")}</span><h2>{t("log")}</h2></div></div><ul className="event-log">{state.events.length === 0 ? <li className="empty-state">{t("noEvents")}</li> : state.events.map((event, index) => <li key={index}><time>{String(index + 1).padStart(2, "0")}</time><span>{typeof event === "string" ? event : t(event.key, event.values)}</span></li>)}</ul></section>}
      </div>
    </main>
  );
}
