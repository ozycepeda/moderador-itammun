"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Committee } from "../lib/committees";
import type { CommitteeDetail } from "../lib/itammun-api";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import { createInitialState, type AttendanceStatus, type ConsoleTab, type SessionState, type VoteChoice } from "../lib/session-state";
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
  const [speakerParticipantId, setSpeakerParticipantId] = useState("");
  const [topicDraft, setTopicDraft] = useState("");
  const [customTopicMode, setCustomTopicMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(state.speakerTime);
  const [running, setRunning] = useState(false);
  const [caucusRemaining, setCaucusRemaining] = useState(state.caucusDuration);
  const [caucusRunning, setCaucusRunning] = useState(false);
  const [appealAppellant, setAppealAppellant] = useState("");
  const [appealRuling, setAppealRuling] = useState("");
  const [voteDraft, setVoteDraft] = useState("");
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

  const eligibleVoters = useMemo(() => state.participants.filter((participant) => state.attendance[participant.id] === "present-voting"), [state.attendance, state.participants]);
  const topicLocked = state.speakers.length > 0;
  const knownTopic = detail.topics.includes(state.topic);
  const topicSelectValue = customTopicMode || (state.topic && !knownTopic) ? "__custom" : state.topic;
  const currentVoterId = state.vote.status === "active" ? state.vote.queue[state.vote.currentIndex] : undefined;
  const currentVoter = state.participants.find((participant) => participant.id === currentVoterId);
  const voteCounts = Object.values(state.vote.ballots).reduce((counts, choice) => ({ ...counts, [choice]: counts[choice] + 1 }), { for: 0, against: 0 });
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
      speakers: [...current.speakers, { id: crypto.randomUUID(), name: participant.name }],
      events: [{ key: "eventSpeakerAdded", values: { name: participant.name } }, ...current.events],
    }));
    setSpeakerParticipantId("");
  }

  function nextSpeaker() {
    update((current) => {
      const [next, ...rest] = current.speakers;
      if (!next) return current;
      return { ...current, currentSpeaker: next.name, speakers: rest, events: [{ key: "eventSpeakerStarted", values: { name: next.name, time: formatTime(current.speakerTime) } }, ...current.events] };
    });
    setRemaining(state.speakerTime);
    setRunning(false);
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

  function startVote(label: string, context: "substantive" | "appeal" = "substantive", appealId?: string) {
    const queue = eligibleVoters.map((participant) => participant.id);
    if (!label.trim() || queue.length === 0) return;
    update((current) => ({
      ...current,
      vote: { label: label.trim(), context, appealId, queue, currentIndex: 0, ballots: {}, status: "active" },
      events: [{ key: "eventVoteStarted", values: { label: label.trim() } }, ...current.events],
    }));
    setActiveTab("voting");
    setVoteDraft("");
  }

  function castVote(choice: VoteChoice) {
    if (!currentVoterId) return;
    update((current) => {
      const ballots = { ...current.vote.ballots, [currentVoterId]: choice };
      const complete = current.vote.currentIndex >= current.vote.queue.length - 1;
      let appeals = current.appeals;
      const extraEvents: SessionState["events"] = [];
      if (complete && current.vote.context === "appeal" && current.vote.appealId) {
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
            <div className="attendance-summary"><span>{t("inRoom")} <strong>{attendance.inRoom}</strong></span><span>{t("presentAndVoting")} <strong>{attendance.voting}</strong></span><span>{t("simpleMajority")} <strong>{Math.floor(attendance.voting / 2) + 1}</strong></span><span>{t("qualifiedMajority")} <strong>{Math.ceil(attendance.voting * 2 / 3)}</strong></span></div>

            <section className={`topic-editor ${topicLocked ? "is-locked" : ""}`}>
              <div><span className="section-kicker">{t("sessionTopic")}</span><h3>{state.topic || t("selectOrCreateTopic")}</h3>{topicLocked && <p>{t("emptyQueueToChangeTopic")}</p>}</div>
              <div className="topic-editor-controls">
                {detail.topics.length > 0 && <select aria-label={t("sessionTopic")} disabled={topicLocked} value={topicSelectValue} onChange={(event) => {
                  if (event.target.value === "__custom") {
                    setTopicDraft(state.topic && !knownTopic ? state.topic : "");
                    setCustomTopicMode(true);
                    return;
                  }
                  setCustomTopicMode(false);
                  setTopicDraft("");
                  updateTopic(event.target.value);
                }}><option value="">{t("selectTopic")}</option>{detail.topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}<option value="__custom">{t("writeOtherTopic")}</option></select>}
                {(detail.topics.length === 0 || customTopicMode || (state.topic && !knownTopic)) && <form onSubmit={(event) => {
                  event.preventDefault();
                  const topic = topicDraft.trim();
                  if (!topic || topicLocked) return;
                  updateTopic(topic);
                  setTopicDraft(topic);
                  setCustomTopicMode(false);
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
            })}{state.participants.length === 0 && <p className="empty-state">{t("returnToNewSession")}</p>}</div>
          </section>
        )}

        {activeTab === "speakers" && (
          <section className="speakers-layout">
            <div className="speaker-stage">
              <div className="stage-label">{t("currentSpeaker")}</div><h2>{state.currentSpeaker || t("noSpeaker")}</h2><div className="timer-display">{formatTime(remaining)}</div>
              <TimeInput label={t("allottedTime")} seconds={state.speakerTime} onChange={(seconds) => { setRemaining(seconds); update((current) => ({ ...current, speakerTime: seconds })); }} compact />
              <div className="primary-controls"><button onClick={() => { setRemaining(state.speakerTime); setRunning(false); }}>{t("reset")}</button><button className="primary-button" onClick={() => setRunning((value) => !value)}>{t(running ? "pause" : "start")}</button><button onClick={nextSpeaker}>{t("nextSpeaker")}</button></div>
            </div>
            <div className="queue-panel">
              <div className="panel-heading"><div><span className="section-kicker">{t("generalList")}</span><h2>{t("nextSpeakers")}</h2></div><span>{state.speakers.length}</span></div>
              <form className="speaker-form" onSubmit={(event) => { event.preventDefault(); addSpeaker(); }}><select aria-label={t("selectNextSpeaker")} value={speakerParticipantId} onChange={(event) => setSpeakerParticipantId(event.target.value)}><option value="">{t("selectCountryOrRepresentation")}</option>{state.participants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="primary-button" disabled={!speakerParticipantId}>{t("add")}</button></form>
              <SpeakerQueue items={state.speakers} onChange={(speakers, event) => update((current) => ({ ...current, speakers, events: [event, ...current.events] }))} />
            </div>
          </section>
        )}

        {activeTab === "caucus" && (
          <section className="caucus-focus">
            <span className="section-kicker">{t("caucusTopic")}</span><h2>{state.topic}</h2>
            <div className="timer-display">{formatTime(caucusRemaining)}</div>
            <TimeInput label={t("totalDuration")} seconds={state.caucusDuration} onChange={(seconds) => { setCaucusRemaining(seconds); update((current) => ({ ...current, caucusDuration: seconds, caucusExtension: Math.max(0, seconds - 1) })); }} compact />
            <div className="caucus-main-controls"><button onClick={() => { setCaucusRemaining(state.caucusDuration); setCaucusRunning(false); }}>{t("reset")}</button><button className="caucus-primary" onClick={() => setCaucusRunning((value) => !value)}>{t(caucusRunning ? "pause" : "startCaucus")}</button><button className="caucus-extension-button" onClick={() => { const extension = Math.max(0, state.caucusDuration - 1); setCaucusRemaining(extension); setCaucusRunning(false); update((current) => ({ ...current, caucusExtension: extension, events: [{ key: "eventCaucusExtended", values: { time: formatTime(extension) } }, ...current.events] })); }}>{t("applyMinusOne")}</button><button onClick={() => { setCaucusRemaining(0); setCaucusRunning(false); }}>{t("finish")}</button></div>
          </section>
        )}

        {activeTab === "motions" && (
          <section className="module-panel motions-module">
            <div className="module-title-row"><div><span className="section-kicker">{t("immediateVote")}</span><h2>{t("appealsToChair")}</h2></div><span className="rule-tag">{t("onlyPresentAndVoting")}</span></div>
            <p className="module-note">{t("appealExplanation")}</p>
            <form className="appeal-form" onSubmit={(event) => { event.preventDefault(); addAppeal(); }}>
              <label>{t("appellant")}<input list="appeal-participants" value={appealAppellant} onChange={(event) => setAppealAppellant(event.target.value)} placeholder={t("appellantPlaceholder")} /></label>
              <datalist id="appeal-participants">{state.participants.map((item) => <option key={item.id} value={item.name} />)}</datalist>
              <label>{t("appealedRuling")}<textarea value={appealRuling} onChange={(event) => setAppealRuling(event.target.value)} placeholder={t("appealedRulingPlaceholder")} /></label>
              <button className="primary-button">{t("registerAppeal")}</button>
            </form>
            <div className="appeal-list">{state.appeals.length === 0 && <p className="empty-state">{t("noAppeals")}</p>}{state.appeals.map((appeal) => <article key={appeal.id}><div><span>{appeal.appellant}</span><strong>{appeal.ruling}</strong></div>{appeal.status === "pending" ? <button disabled={eligibleVoters.length === 0} title={eligibleVoters.length === 0 ? t("markEligibleVoter") : undefined} onClick={() => startVote(t("overturnQuestion", { ruling: appeal.ruling }), "appeal", appeal.id)}>{t("openVoteCount", { count: eligibleVoters.length })}</button> : <span className={`appeal-status ${appeal.status}`}>{t(appeal.status === "upheld" ? "rulingUpheld" : "rulingOverturned")}</span>}</article>)}</div>
          </section>
        )}

        {activeTab === "voting" && (
          <section className="module-panel voting-module">
            <div className="module-title-row"><div><span className="section-kicker">{t("onlyPresentAndVoting")}</span><h2>{t("nominalVoting")}</h2></div><a className="projector-link" href={`/comite/${sessionKey}/pantalla?nombre=${encodeURIComponent(committee.name)}`} target="_blank" rel="noreferrer">{t("openPublicScreen")}</a></div>
            {state.vote.status === "idle" && <div className="vote-start"><p>{t("eligibleCountries", { count: eligibleVoters.length })}</p><label>{t("matterToVote")}<input value={voteDraft} onChange={(event) => setVoteDraft(event.target.value)} placeholder={t("matterPlaceholder")} /></label><button className="primary-button" disabled={!voteDraft.trim() || eligibleVoters.length === 0} onClick={() => startVote(voteDraft)}>{t("startVoteCount", { count: eligibleVoters.length })}</button>{eligibleVoters.length === 0 && <button className="inline-link" onClick={() => setActiveTab("rollcall")}>{t("goToRollCall")}</button>}</div>}
            {state.vote.status === "active" && currentVoter && <div className="nominal-vote"><div className="vote-progress">{t("voteProgress", { current: state.vote.currentIndex + 1, total: state.vote.queue.length })}</div>{currentVoter.flagUrl && <Image src={currentVoter.flagUrl} alt="" width={96} height={64} unoptimized />}<span>{t("castingVote")}</span><h2>{currentVoter.name}</h2><p>{state.vote.label}</p><div className="vote-actions"><button onClick={() => castVote("for")}>{t("inFavor")}</button><button onClick={() => castVote("against")}>{t("against")}</button></div></div>}
            {state.vote.status === "complete" && <div className="vote-result"><span className="section-kicker">{t("voteComplete")}</span><h2>{state.vote.label}</h2><div className="vote-counts vote-counts-two"><div><strong>{voteCounts.for}</strong><span>{t("inFavor")}</span></div><div><strong>{voteCounts.against}</strong><span>{t("against")}</span></div></div><button onClick={() => update((current) => ({ ...current, vote: { label: "", context: "substantive", queue: [], currentIndex: 0, ballots: {}, status: "idle" } }))}>{t("prepareAnotherVote")}</button></div>}
          </section>
        )}

        {activeTab === "log" && <section className="module-panel"><div className="module-title-row"><div><span className="section-kicker">{t("localRecord")}</span><h2>{t("log")}</h2></div></div><ul className="event-log">{state.events.length === 0 ? <li className="empty-state">{t("noEvents")}</li> : state.events.map((event, index) => <li key={index}><time>{String(index + 1).padStart(2, "0")}</time><span>{typeof event === "string" ? event : t(event.key, event.values)}</span></li>)}</ul></section>}
      </div>
    </main>
  );
}
