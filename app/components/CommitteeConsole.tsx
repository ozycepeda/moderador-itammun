"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { committeeDisplayAbbreviation, committeeDisplayName, committeeDisplaySecretariat, type Committee } from "../lib/committees";
import { features } from "../lib/features";
import { representationFullName, representationMatches, representationPrimaryName, representationSecondaryName, topicDisplayTitle, type CommitteeDetail, type CommitteeTopic, type Representation } from "../lib/itammun-api";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import { attendanceCsvFilename, buildAttendanceCsv } from "../lib/attendance-csv";
import { buildAttendanceClosePayload } from "../lib/attendance-submission";
import { selectedParticipants } from "../lib/participant-selection";
import {
  advanceFinalVoteExplanation,
  advanceFinalVoteStage,
  advanceToNextSpeaker,
  applySpeakerYield,
  castFinalVote,
  createInitialFinalVoteState,
  createInitialState,
  getDisciplinaryCounts,
  isParticipantInDebate,
  sessionTitle,
  startFinalVote,
  type AttendanceStatus,
  type CaucusMode,
  type ConsoleTab,
  type FinalVoteRoundTwoChoice,
  type SessionState,
  type SessionNumber,
  type UnlimitedQuestionDocument,
  type VoteChoice,
} from "../lib/session-state";
import { formatTime, TimeInput } from "./TimeInput";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";
import { SpeakerQueue } from "./SpeakerQueue";

const tabIds: ConsoleTab[] = ["warnings", "speakers", "caucus", "unlimited-questions", ...(features.motionsAndAppeals ? ["motions" as const] : []), "voting", "log"];
const attendanceValues: Array<Exclude<AttendanceStatus, "pending">> = ["present", "present-voting", "absent", "observer"];
const sessionNumbers: SessionNumber[] = [1, 2, 3, 4, 5, 6, 7];
const unlimitedDocuments: Exclude<UnlimitedQuestionDocument, "" | "custom">[] = ["working-a1", "working-b1", "possible-resolution-a1", "possible-resolution-b1"];

export function CommitteeConsole({ committee, detail, sessionKey }: {
  committee: Committee;
  detail: CommitteeDetail;
  sessionKey: string;
}) {
  const { language, t } = useLanguage();
  const { state, update, closeSession, hydrated } = useLocalCommitteeState(
    sessionKey,
    createInitialState(selectedParticipants(detail.representations, detail.initiallyAssignedRepresentationIds)),
  );
  const activeTab = state.activeModule;
  const [speakerView, setSpeakerView] = useState<"list" | "questions">("list");
  const [speakerParticipantId, setSpeakerParticipantId] = useState("");
  const [questionParticipantId, setQuestionParticipantId] = useState("");
  const [donationParticipantId, setDonationParticipantId] = useState("");
  const [catalogParticipantId, setCatalogParticipantId] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [customParticipantName, setCustomParticipantName] = useState("");
  const [customParticipantCountry, setCustomParticipantCountry] = useState("");
  const [topicDraft, setTopicDraft] = useState("");
  const [customTopicMode, setCustomTopicMode] = useState(false);
  const [topicLoadStatus, setTopicLoadStatus] = useState<"idle" | "loading" | "missing" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const remaining = state.currentSpeakerRemainingTime;
  const running = state.currentSpeakerRunning;
  const [caucusMode, setCaucusMode] = useState<CaucusMode>("moderated");
  const [caucusRemaining, setCaucusRemaining] = useState(state.caucuses.moderated.duration);
  const [caucusRunning, setCaucusRunning] = useState(false);
  const [appealAppellant, setAppealAppellant] = useState("");
  const [appealRuling, setAppealRuling] = useState("");
  const [closeStatus, setCloseStatus] = useState<"idle" | "saving" | "error">("idle");
  const [closeError, setCloseError] = useState<"generic" | "conflict" | null>(null);
  const closeTimestampRef = useRef<string | null>(null);

  const tabLabels: Record<ConsoleTab, string> = {
    warnings: t("warningsView"), speakers: t("speakers"), caucus: t("caucusAndExtensions"),
    "unlimited-questions": t("unlimitedQuestionsSession"), motions: t("motions"), voting: t("nominalVoting"), log: t("log"),
  };
  const attendanceLabels: Record<Exclude<AttendanceStatus, "pending">, string> = {
    present: t("present"), "present-voting": t("presentAndVoting"), absent: t("absent"), observer: t("observer"),
  };

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = window.setInterval(() => update((current) => ({
      ...current,
      currentSpeakerRemainingTime: Math.max(0, current.currentSpeakerRemainingTime - 1),
      currentSpeakerRunning: current.currentSpeakerRemainingTime > 1,
    })), 1000);
    return () => window.clearInterval(timer);
  }, [running, remaining, update]);

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

  const attendanceComplete = state.participants.length > 0
    && state.participants.every((participant) => state.attendance[participant.id] && state.attendance[participant.id] !== "pending");
  const sessionReady = state.session.number > 0 && attendanceComplete && attendance.quorum;
  const sessionDisplayTitle = state.session.number ? sessionTitle(state.session.number, language) : "";
  const participantIds = useMemo(() => new Set(state.participants.map((participant) => participant.id)), [state.participants]);
  const availableCatalogParticipants = useMemo(
    () => detail.representations.filter((participant) => !participantIds.has(participant.id) && representationMatches(participant, participantSearch, language)),
    [detail.representations, language, participantIds, participantSearch],
  );

  const orderedParticipants = useMemo(() => {
    const assigned = new Set(state.assignedParticipantIds);
    return [...state.participants].sort((left, right) => {
      const assignmentDifference = Number(assigned.has(right.id)) - Number(assigned.has(left.id));
      return assignmentDifference || representationFullName(left, language).localeCompare(representationFullName(right, language), language);
    });
  }, [language, state.assignedParticipantIds, state.participants]);

  const participantsInDebate = useMemo(
    () => state.participants.filter((participant) => isParticipantInDebate(state.attendance[participant.id])),
    [state.attendance, state.participants],
  );

  const eligibleVoters = useMemo(
    () => state.participants.filter((participant) => state.attendance[participant.id] === "present-voting"),
    [state.attendance, state.participants],
  );
  const currentAppealVoterId = state.vote.status === "active" ? state.vote.queue[state.vote.currentIndex] : undefined;
  const currentAppealVoter = state.participants.find((participant) => participant.id === currentAppealVoterId);
  const appealVoteCounts = Object.values(state.vote.ballots).reduce((counts, choice) => ({ ...counts, [choice]: counts[choice] + 1 }), { for: 0, against: 0 });
  const finalVoteParticipantId = state.finalVote.phase === "explanations"
    ? state.finalVote.explanationQueue[state.finalVote.explanationIndex]
    : state.finalVote.queue[state.finalVote.currentIndex];
  const finalVoteParticipant = state.participants.find((participant) => participant.id === finalVoteParticipantId);
  const finalVoteCounts = Object.values(state.finalVote.roundThree).reduce((counts, choice) => ({ ...counts, [choice]: counts[choice] + 1 }), { for: 0, against: 0 });
  const activeCaucus = state.caucuses[caucusMode];
  const secretariat = committee.slug.startsWith("lienzo-") ? t("blankCanvas") : committeeDisplaySecretariat(committee, language);
  const abbreviation = committee.slug.startsWith("lienzo-") ? committee.abbreviation : committeeDisplayAbbreviation(committee, language);
  const committeeName = committee.slug.startsWith("lienzo-") ? (committee.name || t("unnamedCommittee")) : committeeDisplayName(committee, language);
  const displayedTopic = state.topicByLanguage?.[language] ?? state.topic;
  const currentSpeakerParticipant = state.participants.find((participant) => participant.id === state.currentSpeakerParticipantId);
  const currentSpeakerName = currentSpeakerParticipant ? representationFullName(currentSpeakerParticipant, language) : state.currentSpeaker;
  const currentQuestionerParticipant = state.participants.find((participant) => participant.id === state.currentQuestionerParticipantId);
  const currentQuestionerName = currentQuestionerParticipant ? representationFullName(currentQuestionerParticipant, language) : state.currentQuestioner;
  const donationRecipients = participantsInDebate.filter((participant) => participant.id !== state.currentSpeakerParticipantId);
  const interactionMode = state.currentSpeakerYield === "questions" || state.currentSpeakerYield === "comments";

  function setActiveTab(tab: ConsoleTab) {
    update((current) => ({ ...current, activeModule: tab }));
  }

  function setSpeakerTimer(values: { remaining?: number; running?: boolean }) {
    update((current) => ({
      ...current,
      currentSpeakerRemainingTime: values.remaining ?? current.currentSpeakerRemainingTime,
      currentSpeakerRunning: values.running ?? current.currentSpeakerRunning,
    }));
  }

  function participantName(participantId: string | undefined, fallback = "") {
    const participant = state.participants.find((item) => item.id === participantId);
    return participant ? representationFullName(participant, language) : fallback;
  }

  function queueItemName(item: { participantId?: string; name: string }) {
    return participantName(item.participantId, item.name);
  }

  function localizedEventValues(event: Extract<SessionState["events"][number], { key: string }>) {
    const values = { ...(event.values ?? {}) };
    if (typeof values.participantId === "string" && values.participantId) {
      values.name = participantName(values.participantId, typeof values.name === "string" ? values.name : "");
    }
    if (typeof values.recipientId === "string" && values.recipientId) {
      values.recipient = participantName(values.recipientId, typeof values.recipient === "string" ? values.recipient : "");
    }
    if (typeof values.topicId === "string" && values.topicId) {
      const topic = detail.topics.find((item) => item.id === values.topicId);
      if (topic) {
        values.topic = topicDisplayTitle(topic, language);
        values.label = topicDisplayTitle(topic, language);
      }
    }
    if (values.modeId === "moderated" || values.modeId === "simple") {
      values.mode = t(values.modeId === "moderated" ? "moderatedCaucus" : "simpleCaucus");
    }
    return values;
  }

  function disciplinaryLabel(totalWarnings: number) {
    const discipline = getDisciplinaryCounts(totalWarnings);
    return t("disciplinaryBadge", { warnings: discipline.activeWarnings, faults: discipline.faults });
  }

  function selectSessionNumber(number: SessionNumber) {
    update((current) => ({
      ...current,
      session: { ...current.session, number, title: sessionTitle(number, "es") },
    }));
    setTopicLoadStatus("idle");
  }

  function addParticipant(participant: Representation) {
    update((current) => {
      if (current.participants.some((item) => item.id === participant.id)) return current;
      return {
        ...current,
        participants: [...current.participants, participant],
        assignedParticipantIds: [...current.assignedParticipantIds, participant.id],
        attendance: { ...current.attendance, [participant.id]: participant.observer ? "observer" : "pending" },
      };
    });
    setCatalogParticipantId("");
  }

  function addCatalogParticipant() {
    const participant = detail.representations.find((item) => item.id === catalogParticipantId);
    if (participant) addParticipant(participant);
  }

  function addCustomParticipant() {
    const name = customParticipantName.trim();
    const country = customParticipantCountry.trim();
    if (!name || (committee.representationType === "juez" && !country)) return;
    const isJudge = committee.representationType === "juez";
    addParticipant({
      id: `custom-${crypto.randomUUID()}`,
      name: isJudge ? `${name} — ${country}` : name,
      nameByLanguage: { es: name, en: name },
      secondaryNameByLanguage: isJudge ? { es: country, en: country } : undefined,
      observer: false,
      kind: isJudge ? "judge" : "custom",
      status: "occupied",
      searchTerms: [name, country].filter(Boolean),
    });
    setCustomParticipantName("");
    setCustomParticipantCountry("");
  }

  function topicCacheKey() {
    return `itammun:committee-topic:${sessionKey}`;
  }

  async function startSessionAfterAttendance() {
    if (!sessionReady || state.session.number === 0) return;
    if (state.session.number === 1) {
      update((current) => ({ ...current, phase: "topic-selection", session: { ...current.session, startedAt: new Date().toISOString() } }));
      return;
    }
    setTopicLoadStatus("loading");
    try {
      const response = await fetch(`/api/attendance/committees/${encodeURIComponent(sessionKey)}/latest-topic`, { headers: { accept: "application/json" } });
      const result = await response.json() as { ok?: boolean; topic?: { es?: string; en?: string } };
      if (response.ok && result.ok && result.topic && (result.topic.es || result.topic.en)) {
        const topicByLanguage = { es: result.topic.es || result.topic.en || "", en: result.topic.en || result.topic.es || "" };
        window.localStorage.setItem(topicCacheKey(), JSON.stringify(topicByLanguage));
        update((current) => ({ ...current, topic: topicByLanguage.es, topicByLanguage, topicId: "", phase: "debate", session: { ...current.session, startedAt: new Date().toISOString() } }));
        setTopicLoadStatus("idle");
        return;
      }
      const cached = window.localStorage.getItem(topicCacheKey());
      if (cached) {
        const topicByLanguage = JSON.parse(cached) as { es?: string; en?: string };
        if (topicByLanguage.es || topicByLanguage.en) {
          const normalized = { es: topicByLanguage.es || topicByLanguage.en || "", en: topicByLanguage.en || topicByLanguage.es || "" };
          update((current) => ({ ...current, topic: normalized.es, topicByLanguage: normalized, topicId: "", phase: "debate", session: { ...current.session, startedAt: new Date().toISOString() } }));
          setTopicLoadStatus("idle");
          return;
        }
      }
      setTopicLoadStatus(response.status === 404 ? "missing" : "error");
    } catch {
      setTopicLoadStatus("error");
    }
  }

  function chooseTopic(topic: CommitteeTopic | string) {
    const value = typeof topic === "string" ? topic.trim() : topic.title;
    if (!value) return;
    const topicByLanguage = typeof topic === "string" ? { es: value, en: value } : topic.titleByLanguage;
    window.localStorage.setItem(topicCacheKey(), JSON.stringify(topicByLanguage));
    update((current) => ({
      ...current,
      phase: "debate",
      topic: value,
      topicId: typeof topic === "string" ? "" : topic.id,
      topicByLanguage,
      events: [{ key: "eventTopicDefined", values: { topic: typeof topic === "string" ? value : topicDisplayTitle(topic, language), topicId: typeof topic === "string" ? "" : topic.id } }, ...current.events],
    }));
    setTopicDraft("");
    setCustomTopicMode(false);
  }

  function addSpeaker() {
    const participant = participantsInDebate.find((item) => item.id === speakerParticipantId);
    if (!participant || !state.topic) return;
    update((current) => ({
      ...current,
      speakers: [...current.speakers, { id: crypto.randomUUID(), participantId: participant.id, name: participant.name, bonusSeconds: 0 }],
      events: [{ key: "eventSpeakerAdded", values: { name: representationFullName(participant, language), participantId: participant.id } }, ...current.events],
    }));
    setSpeakerParticipantId("");
  }

  function beginNextSpeaker() {
    const next = state.speakers[0];
    if (!next || (state.currentSpeaker && remaining > 0)) return;
    const donatedSeconds = next.participantId ? state.donatedSecondsByParticipantId[next.participantId] ?? 0 : 0;
    const allotted = state.speakerTime + (next.bonusSeconds ?? 0) + donatedSeconds;
    update((current) => ({
      ...advanceToNextSpeaker(current),
      events: [
        { key: "eventSpeakerStarted", values: { name: participantName(next.participantId, next.name), participantId: next.participantId ?? "", time: formatTime(allotted) } },
        ...current.events,
      ],
    }));
  }

  function yieldToChair() {
    if (!state.currentSpeaker || (remaining <= 0 && !interactionMode)) return;
    update((current) => ({
      ...applySpeakerYield(current, "chair", remaining),
      events: [{ key: "eventSpeakerYieldedChair", values: { name: currentSpeakerName, participantId: current.currentSpeakerParticipantId, time: formatTime(remaining) } }, ...current.events],
    }));
  }

  function yieldToDelegation() {
    const recipientParticipant = donationRecipients.find((participant) => participant.id === donationParticipantId);
    if (!state.currentSpeaker || !recipientParticipant || remaining <= 0 || state.currentSpeakerReceivedDonation) return;
    const recipient = representationFullName(recipientParticipant, language);
    update((current) => ({
      ...applySpeakerYield(current, "donation", remaining, recipientParticipant.id),
      events: [{ key: "eventSpeakerYieldedNext", values: { name: currentSpeakerName, participantId: current.currentSpeakerParticipantId, time: formatTime(remaining), recipient, recipientId: recipientParticipant.id } }, ...current.events],
    }));
    setDonationParticipantId("");
  }

  function yieldToQuestions() {
    if (!state.currentSpeaker || remaining <= 0) return;
    update((current) => ({
      ...applySpeakerYield(current, "questions", remaining),
      events: [{ key: "eventSpeakerYieldedQuestions", values: { name: currentSpeakerName, participantId: current.currentSpeakerParticipantId, time: formatTime(remaining) } }, ...current.events],
    }));
  }

  function yieldToComments() {
    if (!state.currentSpeaker || remaining <= 0) return;
    update((current) => ({
      ...applySpeakerYield(current, "comments", remaining),
      events: [{ key: "eventSpeakerYieldedComments", values: { name: currentSpeakerName, participantId: current.currentSpeakerParticipantId, time: formatTime(remaining) } }, ...current.events],
    }));
  }

  function addQuestioner() {
    const participant = participantsInDebate.find((item) => item.id === questionParticipantId);
    if (!participant || !state.currentSpeaker) return;
    update((current) => ({
      ...current,
      questionQueue: [...current.questionQueue, { id: crypto.randomUUID(), participantId: participant.id, name: participant.name }],
      events: [{ key: "eventQuestionerAdded", values: { name: representationFullName(participant, language), participantId: participant.id } }, ...current.events],
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
      currentQuestionerParticipantId: next.participantId ?? "",
      events: [{ key: "eventQuestionStarted", values: { name: participantName(next.participantId, next.name), participantId: next.participantId ?? "" } }, ...current.events],
    }));
  }

  function addWarning(participantId: string, name: string) {
    update((current) => {
      const previousCount = current.warnings[participantId] ?? 0;
      const count = previousCount + 1;
      const previousFaults = getDisciplinaryCounts(previousCount).faults;
      const faults = getDisciplinaryCounts(count).faults;
      const faultEvent: SessionState["events"] = faults > previousFaults ? [{ key: "eventFaultAdded", values: { name, participantId, count: faults } }] : [];
      return { ...current, warnings: { ...current.warnings, [participantId]: count }, events: [...faultEvent, { key: "eventWarningAdded", values: { name, participantId, count } }, ...current.events] };
    });
  }

  function undoWarning(participantId: string, name: string) {
    update((current) => {
      const previousCount = current.warnings[participantId] ?? 0;
      const count = Math.max(0, previousCount - 1);
      const previousFaults = getDisciplinaryCounts(previousCount).faults;
      const faults = getDisciplinaryCounts(count).faults;
      const faultEvent: SessionState["events"] = faults < previousFaults ? [{ key: "eventFaultRemoved", values: { name, participantId, count: faults } }] : [];
      return { ...current, warnings: { ...current.warnings, [participantId]: count }, events: [...faultEvent, { key: "eventWarningRemoved", values: { name, participantId, count } }, ...current.events] };
    });
  }

  function exportAttendance() {
    const csv = buildAttendanceCsv({ committee, state, language });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = attendanceCsvFilename(committee.slug, state.session.title);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function finishSession() {
    if (!hydrated || !state.session.id || !state.session.title || closeStatus === "saving") return;
    if (!window.confirm(t("finishSessionConfirm"))) return;
    setCloseStatus("saving");
    setCloseError(null);
    try {
      closeTimestampRef.current ??= new Date().toISOString();
      const payload = buildAttendanceClosePayload({ committee, state, closedAt: closeTimestampRef.current });
      const response = await fetch(`/api/attendance/sessions/${encodeURIComponent(state.session.id)}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { ok?: boolean; error?: string; receiptId?: string };
      if (!response.ok || result.ok !== true) {
        exportAttendance();
        setCloseStatus("error");
        setCloseError(result.error === "session-conflict" ? "conflict" : "generic");
        return;
      }
      exportAttendance();
      closeSession();
      window.alert(t("sessionClosedSuccessReceipt", { receipt: result.receiptId ?? state.session.id }));
      window.location.replace("/");
    } catch {
      exportAttendance();
      setCloseStatus("error");
      setCloseError("generic");
    }
  }

  function selectCaucusMode(mode: CaucusMode) {
    setCaucusMode(mode);
    setCaucusRemaining(state.caucuses[mode].duration);
    setCaucusRunning(false);
  }

  async function share() {
    const setupUrl = new URL(`/comite/${sessionKey}`, window.location.origin);
    setupUrl.searchParams.set("nombre", committeeName);
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
      events: [{ key: "eventFinalVoteStarted", values: { label: current.topic, topicId: current.topicId } }, ...current.events],
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
        events: completedNow ? [{ key: "eventFinalVoteCompleted", values: { label: finalVote.label, topicId: current.topicId } }, ...current.events] : current.events,
      };
    });
  }

  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;

  if (state.phase === "attendance") {
    return (
      <main className="setup-shell attendance-gate-shell" style={cssVars}>
        <header className="console-header">
          <Link href="/" className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></Link>
          <div className="committee-heading"><span>{secretariat}</span><h1>{abbreviation}</h1></div>
          <div className="header-actions"><span className="setup-step">{t("attendanceBeforeDebate")}</span><LanguageSwitcher dark /></div>
        </header>

        <section className="setup-intro attendance-gate-intro">
          <p className="eyebrow">{t("prepareSession")}</p>
          <h2>{t("registerAttendanceFirst")}</h2>
          <p>{t("attendanceLocksAfterStart")}</p>
        </section>

        <div className="attendance-gate-grid">
          <section className="setup-panel attendance-gate-panel">
            <div className="session-title-field">
              <label htmlFor="session-number">{t("sessionTitle")}</label>
              <select id="session-number" value={state.session.number || ""} onChange={(event) => selectSessionNumber(Number(event.target.value) as SessionNumber)}>
                <option value="">{t("selectWorkingSession")}</option>
                {sessionNumbers.map((number) => <option key={number} value={number}>{sessionTitle(number, language)}</option>)}
              </select>
              <p>{t("sessionTitleConstrainedHelp")}</p>
            </div>

            {detail.source === "live" && <div className="catalog-status catalog-status-live"><strong>{t("liveCatalogLoaded")}</strong><span>{t("occupiedSeatsIncluded")}</span></div>}
            {detail.source === "unavailable" && <div className="catalog-status catalog-status-error" role="alert"><strong>{t("catalogUnavailable")}</strong><span>{t("catalogUnavailableHelp")}</span><button type="button" onClick={() => window.location.reload()}>{t("retry")}</button></div>}

            <div className="setup-panel-heading"><div><span className="section-kicker">{t("rollCall")}</span><h2>{t("countriesAndPeople")}</h2></div><strong>{state.participants.length}</strong></div>

            {availableCatalogParticipants.length > 0 || participantSearch ? <div className="participant-add-panel">
              <label htmlFor="catalog-search">{t("addFromCatalog")}</label>
              <div className="catalog-participant-controls">
                <input id="catalog-search" value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} placeholder={t("searchCatalog")} />
                <select value={catalogParticipantId} onChange={(event) => setCatalogParticipantId(event.target.value)} aria-label={t("addFromCatalog")}>
                  <option value="">{t("selectAvailableParticipant")}</option>
                  {availableCatalogParticipants.map((participant) => <option key={participant.id} value={participant.id}>{representationFullName(participant, language)}</option>)}
                </select>
                <button type="button" disabled={!catalogParticipantId} onClick={addCatalogParticipant}>{t("add")}</button>
              </div>
            </div> : null}

            <form className="custom-participant-form attendance-custom-participant" onSubmit={(event) => { event.preventDefault(); addCustomParticipant(); }}>
              <label htmlFor="custom-participant">{t(committee.representationType === "juez" ? "addJudge" : "addParticipant")}</label>
              <div>
                <input id="custom-participant" value={customParticipantName} onChange={(event) => setCustomParticipantName(event.target.value)} placeholder={t(committee.representationType === "juez" ? "judgeName" : "freeName")} />
                {committee.representationType === "juez" && <input value={customParticipantCountry} onChange={(event) => setCustomParticipantCountry(event.target.value)} placeholder={t("representedCountry")} />}
                <button disabled={!customParticipantName.trim() || (committee.representationType === "juez" && !customParticipantCountry.trim())}>{t("add")}</button>
              </div>
            </form>

            <div className="attendance-summary"><span>{t("inRoom")} <strong>{attendance.inRoom}</strong></span><span>{t("presentAndVoting")} <strong>{attendance.voting}</strong></span><span>{t("attendanceCompleted")} <strong>{state.participants.filter((participant) => state.attendance[participant.id] !== "pending").length}/{state.participants.length}</strong></span><span>{t(attendance.quorum ? "hasQuorum" : "noQuorum")}</span></div>
            <div className="attendance-list">{orderedParticipants.map((representation) => {
              const value = state.attendance[representation.id] || "pending";
              return <article className="attendance-row" key={representation.id}>
                <div className="attendance-person">{representation.flagUrl && <Image src={representation.flagUrl} alt="" width={32} height={22} unoptimized />}<span>{representationPrimaryName(representation, language)}{representationSecondaryName(representation, language) && <small>{representationSecondaryName(representation, language)}</small>}</span></div>
                <div className="attendance-buttons" role="group" aria-label={t("attendanceFor", { name: representationFullName(representation, language) })}>{attendanceValues.map((option) => <button key={option} type="button" aria-pressed={value === option} className={`attendance-button status-${option}`} onClick={() => update((current) => ({ ...current, attendance: { ...current.attendance, [representation.id]: option } }))}>{attendanceLabels[option]}</button>)}<button type="button" className="attendance-clear" disabled={value === "pending"} onClick={() => update((current) => ({ ...current, attendance: { ...current.attendance, [representation.id]: "pending" } }))}>{t("clear")}</button></div>
              </article>;
            })}</div>
          </section>

          <aside className="attendance-start-card">
            <span className="section-kicker">{t("startRequirements")}</span>
            <h2>{sessionDisplayTitle || t("sessionTitle")}</h2>
            <ul>
              <li className={state.session.number ? "complete" : ""}>{t("requireSessionTitle")}</li>
              <li className={attendanceComplete ? "complete" : ""}>{t("requireAllAttendance")}</li>
              <li className={attendance.quorum ? "complete" : ""}>{t("requireQuorum")}</li>
            </ul>
            {(topicLoadStatus === "missing" || topicLoadStatus === "error") && <p className="attendance-save-error" role="alert">{t(topicLoadStatus === "missing" ? "previousTopicMissing" : "previousTopicError")}</p>}
            <button className="primary-button" disabled={!sessionReady || topicLoadStatus === "loading"} onClick={startSessionAfterAttendance}>{t(topicLoadStatus === "loading" ? "recoveringTopic" : "startSession")}</button>
          </aside>
        </div>
      </main>
    );
  }

  if (state.phase === "topic-selection") {
    return (
      <main className="setup-shell topic-selection-shell" style={cssVars}>
        <header className="console-header">
          <Link href="/" className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></Link>
          <div className="committee-heading"><span>{secretariat}</span><h1>{abbreviation}</h1></div>
          <div className="header-actions"><span className="setup-step">{sessionDisplayTitle}</span><LanguageSwitcher dark /></div>
        </header>
        <section className="topic-selection-panel">
          <span className="section-kicker">{t("firstSessionOnly")}</span>
          <h2>{t("chooseDebateTopic")}</h2>
          <p>{t("chooseDebateTopicHelp")}</p>
          <div className="topic-option-grid">
            {detail.topics.map((topic) => <button key={topic.id} type="button" onClick={() => chooseTopic(topic)}><span>{t("catalogTopic")}</span><strong>{topicDisplayTitle(topic, language)}</strong></button>)}
            <button type="button" className={customTopicMode ? "active" : ""} onClick={() => setCustomTopicMode(true)}><span>{t("customTopic")}</span><strong>{t("additionalTopic")}</strong></button>
          </div>
          {customTopicMode && <form className="custom-topic-form" onSubmit={(event) => { event.preventDefault(); chooseTopic(topicDraft); }}><label htmlFor="custom-topic">{t("additionalTopicName")}</label><div><input id="custom-topic" autoFocus value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} placeholder={t("writeTopic")} /><button className="primary-button" disabled={!topicDraft.trim()}>{t("continueToDebate")}</button></div></form>}
          {detail.topics.length === 0 && !customTopicMode && <p className="module-note">{t("noCatalogTopics")}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="console-shell" style={cssVars}>
      <header className="console-header">
        <Link href="/" className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></Link>
        <div className="committee-heading"><span>{secretariat}</span><h1>{abbreviation}</h1></div>
        <div className="sharing-tools">
          <span className="sync-state sync-local">{t("savedLocally")}</span>
          <button className="secondary-button finish-session-button" disabled={!hydrated || !state.session.id || !state.session.title || closeStatus === "saving"} onClick={finishSession}>{t(closeStatus === "saving" ? "savingAttendance" : "finishSession")}</button>
          <a className="secondary-button" href={`/comite/${sessionKey}/pantalla?nombre=${encodeURIComponent(committeeName)}`} target="_blank" rel="noreferrer">{t("screen")}</a>
          <button className="secondary-button share-button" onClick={share}>{t(copied ? "linkCopied" : "share")}</button>
          <LanguageSwitcher dark />
        </div>
      </header>

      <section className="session-identity-strip">
        <span className="section-kicker">{t("sessionTitle")}</span>
        <strong>{sessionDisplayTitle}</strong>
        {state.session.startedAt && <time dateTime={state.session.startedAt}>{new Intl.DateTimeFormat(language === "es" ? "es-MX" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(state.session.startedAt))}</time>}
        {closeStatus === "error" && <p className="attendance-save-error" role="alert">{t(closeError === "conflict" ? "attendanceConflict" : "attendanceSaveError")}</p>}
      </section>

      <section className={`session-topic-strip ${state.topic ? "topic-ready" : ""}`}>
        <span className="section-kicker">{t("topic")}</span>
        <strong>{displayedTopic || t("topicPending")}</strong>
      </section>

      <nav className="console-tabs" aria-label={t("committeeModules")}>
        {tabIds.map((tabId) => <button key={tabId} className={activeTab === tabId ? "active" : ""} onClick={() => setActiveTab(tabId)}>{tabLabels[tabId]}</button>)}
      </nav>

      <div className="console-workspace">
        {activeTab === "warnings" && (
          <section className="module-panel rollcall-module">
            <div className="module-title-row"><div><span className="section-kicker">{t("attendanceLocked")}</span><h2>{t("warningsView")}</h2></div></div>
            <div className="warnings-panel">
              <p className="module-note">{t("warningsIntro")}</p>
              <div className="warnings-list">{orderedParticipants.map((participant) => {
                const count = state.warnings[participant.id] ?? 0;
                const discipline = getDisciplinaryCounts(count);
                return <article className="warning-row" key={participant.id}>
                  <div className="attendance-person">{participant.flagUrl && <Image src={participant.flagUrl} alt="" width={32} height={22} unoptimized />}<span>{representationPrimaryName(participant, language)}{representationSecondaryName(participant, language) && <small>{representationSecondaryName(participant, language)}</small>}</span>{count > 0 && <em>{t("activeWarningCount", { count: discipline.activeWarnings })} · {t("faultCount", { count: discipline.faults })}</em>}</div>
                  <div className="discipline-counts"><strong>{discipline.activeWarnings}</strong><span>{t("faultCount", { count: discipline.faults })}</span></div>
                  <div><button className="warning-add" onClick={() => addWarning(participant.id, representationFullName(participant, language))}>{t("addWarning")}</button><button disabled={count === 0} onClick={() => undoWarning(participant.id, representationFullName(participant, language))}>{t("undoWarning")}</button></div>
                </article>;
              })}</div>
            </div>
          </section>
        )}

        {activeTab === "speakers" && (
          <section className="speakers-module">
            <div className="console-subtabs speakers-subtabs" role="group" aria-label={t("speakers")}><button className={speakerView === "list" ? "active" : ""} onClick={() => setSpeakerView("list")}>{t("speakerListMode")}</button><button className={speakerView === "questions" ? "active" : ""} onClick={() => setSpeakerView("questions")}>{t("extraordinaryQuestions")}</button></div>
            {speakerView === "list" ? <div className="speakers-layout">
              <div className={`speaker-stage ${interactionMode ? "interaction-stage" : ""}`}>
                <div className="stage-label">{t(interactionMode ? state.currentSpeakerYield === "comments" ? "commentsWithSpeaker" : "questionsWithSpeaker" : "currentSpeaker", { name: currentSpeakerName })}</div>
                <h2>{currentSpeakerName || t("noSpeaker")}</h2>
                <div className="timer-display">{formatTime(remaining)}</div>
                {state.currentSpeakerReceivedDonation && <span className="donation-note">{t("allottedWithDonation", { base: formatTime(state.speakerTime), donation: formatTime(Math.max(0, state.currentSpeakerAllottedTime - state.speakerTime)) })}</span>}

                {interactionMode ? <>
                  <p className="module-note">{t(state.currentSpeakerYield === "comments" ? "commentsTimeHelp" : "ordinaryQuestionsHelp")}</p>
                  <div className="primary-controls interaction-controls">
                    {remaining > 0 && <button className="primary-button" onClick={() => setSpeakerTimer({ running: !running })}>{t(running ? "pause" : "resume")}</button>}
                    <button onClick={yieldToChair}>{t("yieldToChair")}</button>
                  </div>
                </> : state.currentSpeakerYield === "chair" || state.currentSpeakerYield === "donation" ? <>
                  <div className={`yield-status yield-status-${state.currentSpeakerYield}`}><strong>{t(state.currentSpeakerYield === "donation" ? "yieldRecordedDelegation" : "yieldRecordedChair")}</strong></div>
                  <div className="primary-controls"><button className="primary-button" disabled={state.speakers.length === 0} onClick={beginNextSpeaker}>{t("nextSpeaker")}</button></div>
                </> : <>
                  <TimeInput label={t("allottedTime")} seconds={state.speakerTime} onChange={(seconds) => update((current) => ({ ...current, speakerTime: seconds, currentSpeakerAllottedTime: current.currentSpeaker ? current.currentSpeakerAllottedTime : seconds, currentSpeakerRemainingTime: current.currentSpeaker ? current.currentSpeakerRemainingTime : seconds }))} compact />
                  <div className="primary-controls">
                    <button disabled={!state.currentSpeaker} onClick={() => update((current) => ({ ...current, currentSpeakerRemainingTime: current.currentSpeakerAllottedTime, currentSpeakerRunning: false, currentSpeakerYield: "none", yieldRecipientParticipantId: "", pendingDonationSeconds: 0 }))}>{t("reset")}</button>
                    <button className="primary-button" disabled={!state.currentSpeaker || state.currentSpeakerYield !== "none" || remaining === 0} onClick={() => setSpeakerTimer({ running: !running })}>{t(running ? "pause" : "start")}</button>
                    <button disabled={state.speakers.length === 0 || Boolean(state.currentSpeaker && remaining > 0)} onClick={beginNextSpeaker}>{t("nextSpeaker")}</button>
                  </div>
                  {state.currentSpeaker && remaining > 0 && state.currentSpeakerYield === "none" && <div className="yield-panel">
                    <span>{t("yieldRemainingTime")}</span>
                    <div className="yield-action-grid"><button onClick={yieldToQuestions}>{t("yieldToQuestions")}</button><button onClick={yieldToComments}>{t("yieldToComments")}</button><button onClick={yieldToChair}>{t("yieldToChair")}</button></div>
                    <div className="directed-donation"><select value={donationParticipantId} onChange={(event) => setDonationParticipantId(event.target.value)} aria-label={t("donationRecipient")}><option value="">{t("selectDonationRecipient")}</option>{donationRecipients.map((participant) => <option key={participant.id} value={participant.id}>{representationFullName(participant, language)}{state.donatedSecondsByParticipantId[participant.id] ? ` (+${formatTime(state.donatedSecondsByParticipantId[participant.id])})` : ""}</option>)}</select><button disabled={!donationParticipantId || state.currentSpeakerReceivedDonation} onClick={yieldToDelegation}>{t("yieldToSelectedDelegation")}</button></div>
                  </div>}
                </>}
              </div>
              <div className="queue-panel">
                <div className="panel-heading"><div><span className="section-kicker">{t("generalList")}</span><h2>{t("nextSpeakers")}</h2></div><span>{state.speakers.length}</span></div>
                <form className="speaker-form" onSubmit={(event) => { event.preventDefault(); addSpeaker(); }}><select aria-label={t("selectNextSpeaker")} value={speakerParticipantId} onChange={(event) => setSpeakerParticipantId(event.target.value)}><option value="">{t("selectCountryOrRepresentation")}</option>{participantsInDebate.map((item) => <option key={item.id} value={item.id}>{representationFullName(item, language)}</option>)}</select><button className="primary-button" disabled={!speakerParticipantId}>{t("add")}</button></form>
                {participantsInDebate.length === 0 && <p className="module-note">{t("noParticipantsInDebate")}</p>}
                <SpeakerQueue items={state.speakers} getLabel={queueItemName} onChange={(speakers, event) => update((current) => ({ ...current, speakers, events: [event, ...current.events] }))} />
              </div>
            </div> : <div className="speakers-layout questions-layout">
              <div className="speaker-stage">
                <div className="stage-label">{t("currentQuestioner")}</div><h2>{currentQuestionerName || t("noQuestioner")}</h2>
                <div className="zero-time-badge">{t("extraordinaryQuestionsNoTime")}</div>
                <div className="primary-controls"><button className="primary-button" disabled={!state.currentSpeaker || state.questionQueue.length === 0} onClick={nextQuestioner}>{t("nextQuestioner")}</button></div>
              </div>
              <div className="queue-panel">
                <div className="question-target"><span className="section-kicker">{t("questionTarget")}</span><h2>{state.currentSpeaker ? t("questionTargetName", { name: currentSpeakerName }) : t("noQuestionTarget")}</h2></div>
                <div className="panel-heading"><div><span className="section-kicker">{t("extraordinaryQuestions")}</span><h2>{t("questionQueue")}</h2></div><span>{state.questionQueue.length}</span></div>
                <form className="speaker-form" onSubmit={(event) => { event.preventDefault(); addQuestioner(); }}><select disabled={!state.currentSpeaker} aria-label={t("selectQuestioner")} value={questionParticipantId} onChange={(event) => setQuestionParticipantId(event.target.value)}><option value="">{t("selectCountryOrRepresentation")}</option>{participantsInDebate.map((item) => <option key={item.id} value={item.id}>{representationFullName(item, language)}</option>)}</select><button className="primary-button" disabled={!state.currentSpeaker || !questionParticipantId}>{t("add")}</button></form>
                <SpeakerQueue emptyText={t("emptyQuestionQueue")} items={state.questionQueue} getLabel={queueItemName} onChange={(questionQueue, event) => update((current) => ({ ...current, questionQueue, events: [event, ...current.events] }))} />
              </div>
            </div>}
          </section>
        )}

        {activeTab === "caucus" && (
          <section className="caucus-module">
            <div className="console-subtabs caucus-subtabs" role="group" aria-label={t("caucusAndExtensions")}><button className={caucusMode === "moderated" ? "active" : ""} onClick={() => selectCaucusMode("moderated")}>{t("moderatedCaucus")}</button><button className={caucusMode === "simple" ? "active" : ""} onClick={() => selectCaucusMode("simple")}>{t("simpleCaucus")}</button></div>
            <div className="caucus-focus">
              <span className="section-kicker">{t(caucusMode === "moderated" ? "moderatedCaucus" : "simpleCaucus")} · {t("topic")}</span><h2>{displayedTopic}</h2><p className="caucus-mode-hint">{t(caucusMode === "moderated" ? "moderatedCaucusHint" : "simpleCaucusHint")}</p>
              <div className="timer-display">{formatTime(caucusRemaining)}</div>
              <TimeInput label={t("totalDuration")} seconds={activeCaucus.duration} onChange={(seconds) => { setCaucusRemaining(seconds); update((current) => ({ ...current, caucuses: { ...current.caucuses, [caucusMode]: { duration: seconds, extension: Math.max(0, seconds - 1) } } })); }} compact />
              <div className="caucus-main-controls"><button onClick={() => { setCaucusRemaining(activeCaucus.duration); setCaucusRunning(false); }}>{t("reset")}</button><button className="caucus-primary" onClick={() => setCaucusRunning((value) => !value)}>{t(caucusRunning ? "pause" : "startCaucus")}</button><button className="caucus-extension-button" onClick={() => { const extension = Math.max(0, activeCaucus.duration - 1); setCaucusRemaining(extension); setCaucusRunning(false); update((current) => ({ ...current, caucuses: { ...current.caucuses, [caucusMode]: { ...current.caucuses[caucusMode], extension } }, events: [{ key: "eventCaucusModeExtended", values: { mode: t(caucusMode === "moderated" ? "moderatedCaucus" : "simpleCaucus"), modeId: caucusMode, time: formatTime(extension) } }, ...current.events] })); }}>{t("applyMinusOne")}</button><button onClick={() => { setCaucusRemaining(0); setCaucusRunning(false); }}>{t("finish")}</button></div>
            </div>
          </section>
        )}

        {activeTab === "unlimited-questions" && (
          <section className="module-panel unlimited-questions-module">
            <div className="module-title-row"><div><span className="section-kicker">{t("freeParticipation")}</span><h2>{t("unlimitedQuestionsSession")}</h2></div><span className="rule-tag">{t("noTimerNoQueue")}</span></div>
            <p className="module-note">{t("unlimitedQuestionsHelp")}</p>
            <div className="unlimited-document-grid">
              {unlimitedDocuments.map((document) => <button key={document} type="button" className={state.unlimitedQuestionDocument === document ? "active" : ""} onClick={() => update((current) => ({ ...current, unlimitedQuestionDocument: document, unlimitedQuestionCustomLabel: "" }))}>{t(document === "working-a1" ? "workingPaperA1" : document === "working-b1" ? "workingPaperB1" : document === "possible-resolution-a1" ? "possibleResolutionA1" : "possibleResolutionB1")}</button>)}
              <button type="button" className={state.unlimitedQuestionDocument === "custom" ? "active" : ""} onClick={() => update((current) => ({ ...current, unlimitedQuestionDocument: "custom" }))}>{t("customDocument")}</button>
            </div>
            {state.unlimitedQuestionDocument === "custom" && <label className="unlimited-custom-label">{t("customDocumentName")}<input value={state.unlimitedQuestionCustomLabel} onChange={(event) => update((current) => ({ ...current, unlimitedQuestionCustomLabel: event.target.value.slice(0, 300) }))} placeholder={t("customDocumentPlaceholder")} /></label>}
            <div className="unlimited-current-selection"><span>{t("currentDocument")}</span><strong>{state.unlimitedQuestionDocument ? state.unlimitedQuestionDocument === "custom" ? state.unlimitedQuestionCustomLabel || t("pendingCustomDocument") : t(state.unlimitedQuestionDocument === "working-a1" ? "workingPaperA1" : state.unlimitedQuestionDocument === "working-b1" ? "workingPaperB1" : state.unlimitedQuestionDocument === "possible-resolution-a1" ? "possibleResolutionA1" : "possibleResolutionB1") : t("noDocumentSelected")}</strong></div>
          </section>
        )}

        {features.motionsAndAppeals && activeTab === "motions" && (
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
            <div className="module-title-row"><div><span className="section-kicker">{t("onlyPresentAndVoting")}</span><h2>{t("finalVoting")}</h2></div><a className="projector-link" href={`/comite/${sessionKey}/pantalla?nombre=${encodeURIComponent(committeeName)}`} target="_blank" rel="noreferrer">{t("openPublicScreen")}</a></div>
            {state.finalVote.phase === "idle" && <div className="vote-start final-vote-start"><p>{t("finalVotingIntro")}</p><div className="final-topic-card"><span>{t("finalVoteTopic")}</span><strong>{displayedTopic}</strong></div><p>{t("eligibleCountries", { count: eligibleVoters.length })}</p><button className="primary-button" disabled={!state.topic || eligibleVoters.length === 0} onClick={beginFinalVote}>{t("startFinalVote", { count: eligibleVoters.length })}</button>{eligibleVoters.length === 0 && <p className="module-note">{t("attendanceLockedNoVoters")}</p>}</div>}
            {(state.finalVote.phase === "round-one" || state.finalVote.phase === "round-two" || state.finalVote.phase === "round-three") && finalVoteParticipant && <div className="nominal-vote final-vote-stage">
              <div className="vote-progress">{t("roundProgress", { round: t(state.finalVote.phase === "round-one" ? "finalRoundOne" : state.finalVote.phase === "round-two" ? "finalRoundTwo" : "finalRoundThree"), current: state.finalVote.currentIndex + 1, total: state.finalVote.queue.length })}</div>
              {finalVoteParticipant.flagUrl && <Image src={finalVoteParticipant.flagUrl} alt="" width={96} height={64} unoptimized />}<span>{t("castingVote")}</span><h2>{representationFullName(finalVoteParticipant, language)}</h2><p>{displayedTopic || state.finalVote.label}</p>{(state.warnings[finalVoteParticipant.id] ?? 0) > 0 && <strong className="warning-badge">{disciplinaryLabel(state.warnings[finalVoteParticipant.id])}</strong>}
              <div className={`vote-actions final-vote-actions ${state.finalVote.phase === "round-two" ? "five-options" : ""}`}><button onClick={() => recordFinalVote("for")}>{t("inFavor")}</button><button onClick={() => recordFinalVote("against")}>{t("against")}</button>{state.finalVote.phase !== "round-three" && <button onClick={() => recordFinalVote("abstain")}>{t("abstention")}</button>}{state.finalVote.phase === "round-two" && <><button onClick={() => recordFinalVote("for-explanation")}>{t("forWithExplanation")}</button><button onClick={() => recordFinalVote("against-explanation")}>{t("againstWithExplanation")}</button></>}</div>
            </div>}
            {(state.finalVote.phase === "round-one-complete" || state.finalVote.phase === "round-two-complete" || state.finalVote.phase === "explanations-complete") && <div className="final-vote-transition">
              <span className="section-kicker">{t("votingStageComplete")}</span>
              <h2>{t(state.finalVote.phase === "round-one-complete" ? "firstRoundComplete" : state.finalVote.phase === "round-two-complete" ? "secondRoundComplete" : "explanationsComplete")}</h2>
              <p>{state.finalVote.phase === "round-one-complete" ? t("firstRoundCompleteHelp") : state.finalVote.phase === "round-two-complete" ? t("secondRoundCompleteHelp", { count: state.finalVote.explanationQueue.length }) : t("explanationsCompleteHelp")}</p>
              <div className="stage-divider" aria-hidden="true"><span>✓</span><i /><span>{state.finalVote.phase === "round-one-complete" ? "2" : "3"}</span></div>
              <button className="primary-button" onClick={() => update((current) => ({ ...current, finalVote: advanceFinalVoteStage(current.finalVote) }))}>{t(state.finalVote.phase === "round-one-complete" ? "beginSecondRound" : state.finalVote.phase === "round-two-complete" && state.finalVote.explanationQueue.length > 0 ? "beginExplanations" : "beginThirdRound")}</button>
            </div>}
            {state.finalVote.phase === "explanations" && finalVoteParticipant && <div className="nominal-vote explanation-stage"><div className="vote-progress">{t("explanationProgress", { current: state.finalVote.explanationIndex + 1, total: state.finalVote.explanationQueue.length })}</div>{finalVoteParticipant.flagUrl && <Image src={finalVoteParticipant.flagUrl} alt="" width={96} height={64} unoptimized />}<span>{t("explainingVote")}</span><h2>{representationFullName(finalVoteParticipant, language)}</h2><p>{t(state.finalVote.roundTwo[finalVoteParticipant.id] === "for-explanation" ? "forWithExplanation" : "againstWithExplanation")}</p>{(state.warnings[finalVoteParticipant.id] ?? 0) > 0 && <strong className="warning-badge">{disciplinaryLabel(state.warnings[finalVoteParticipant.id])}</strong>}<button className="primary-button explanation-next" onClick={() => update((current) => ({ ...current, finalVote: advanceFinalVoteExplanation(current.finalVote) }))}>{t(state.finalVote.explanationIndex < state.finalVote.explanationQueue.length - 1 ? "nextExplanation" : "finishExplanations")}</button></div>}
            {state.finalVote.phase === "complete" && <div className="vote-result final-vote-result"><span className="section-kicker">{t("finalVoteResult")}</span><h2>{displayedTopic || state.finalVote.label}</h2><div className="vote-counts vote-counts-two"><div><strong>{finalVoteCounts.for}</strong><span>{t("inFavor")}</span></div><div><strong>{finalVoteCounts.against}</strong><span>{t("against")}</span></div></div><div className="final-vote-audit">{state.finalVote.queue.map((participantId) => { const participant = state.participants.find((item) => item.id === participantId); if (!participant) return null; const warnings = state.warnings[participantId] ?? 0; return <div key={participantId}><span>{representationFullName(participant, language)}</span><strong>{t(state.finalVote.roundThree[participantId] === "for" ? "inFavor" : "against")}</strong>{warnings > 0 && <em>{disciplinaryLabel(warnings)}</em>}</div>; })}</div><button onClick={() => update((current) => ({ ...current, finalVote: createInitialFinalVoteState() }))}>{t("resetFinalVote")}</button></div>}
          </section>
        )}

        {activeTab === "log" && <section className="module-panel"><div className="module-title-row"><div><span className="section-kicker">{t("localRecord")}</span><h2>{t("log")}</h2></div></div><ul className="event-log">{state.events.length === 0 ? <li className="empty-state">{t("noEvents")}</li> : state.events.map((event, index) => <li key={index}><time>{String(index + 1).padStart(2, "0")}</time><span>{typeof event === "string" ? event : t(event.key, localizedEventValues(event))}</span></li>)}</ul></section>}
      </div>
    </main>
  );
}
