import { isTranslationKey } from "./i18n";
import { selectedParticipants } from "./participant-selection";
import {
  createInitialFinalVoteState,
  sessionNumberFromTitle,
  type AttendanceStatus,
  type FinalVoteRoundOneChoice,
  type FinalVoteRoundTwoChoice,
  type SessionEvent,
  type ConsoleTab,
  type SessionState,
  type SpeakerYieldDestination,
  type SpeakerQueueItem,
  type VoteChoice,
} from "./session-state";

function normalizeQueue(value: unknown, participants: SessionState["participants"]): SpeakerQueueItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((speaker) => {
    if (typeof speaker === "string") {
      const participant = participants.find((item) => item.name === speaker);
      return [{ id: crypto.randomUUID(), participantId: participant?.id, name: speaker, bonusSeconds: 0 }];
    }
    if (speaker && typeof speaker === "object" && "name" in speaker && typeof speaker.name === "string") {
      const participant = participants.find((item) => item.name === speaker.name);
      return [{
        id: "id" in speaker && typeof speaker.id === "string" ? speaker.id : crypto.randomUUID(),
        participantId: "participantId" in speaker && typeof speaker.participantId === "string" ? speaker.participantId : participant?.id,
        name: speaker.name,
        bonusSeconds: "bonusSeconds" in speaker && typeof speaker.bonusSeconds === "number" ? Math.max(0, speaker.bonusSeconds) : 0,
      }];
    }
    return [];
  });
}

export function normalizeSessionState(value: unknown, fallback: SessionState): SessionState {
  if (!value || typeof value !== "object") return fallback;
  const stored = value as Partial<SessionState> & { caucusDuration?: number; caucusExtension?: number };
  const storedParticipants = Array.isArray(stored.participants) ? stored.participants : [];
  const participantPool = [
    ...fallback.participants,
    ...storedParticipants.filter((storedParticipant) => !fallback.participants.some((participant) => participant.id === storedParticipant.id)),
  ];
  const assignedParticipantIds = Array.isArray(stored.assignedParticipantIds)
    ? stored.assignedParticipantIds.filter((id): id is string => typeof id === "string")
    : storedParticipants.map((participant) => participant.id);
  const participants = selectedParticipants(participantPool, assignedParticipantIds);
  const activeParticipantIds = new Set(participants.map((participant) => participant.id));
  const storedAttendance = stored.attendance ?? {};
  const attendance = Object.fromEntries(participants.map((participant) => [
    participant.id,
    storedAttendance[participant.id] ?? (participant.observer ? "observer" : "pending"),
  ])) as Record<string, AttendanceStatus>;
  const ballots = Object.fromEntries(Object.entries(stored.vote?.ballots ?? {}).filter((entry): entry is [string, VoteChoice] => (
    activeParticipantIds.has(entry[0]) && (entry[1] === "for" || entry[1] === "against")
  )));
  const rawEvents = Array.isArray(stored.events) ? stored.events as unknown[] : [];
  const events = rawEvents.flatMap((event): Array<string | SessionEvent> => {
    if (typeof event === "string") return [event];
    if (!event || typeof event !== "object" || !("key" in event) || !isTranslationKey(event.key)) return [];
    const rawValues = "values" in event && event.values && typeof event.values === "object" ? event.values as Record<string, unknown> : {};
    const values = Object.fromEntries(Object.entries(rawValues).filter((entry): entry is [string, string | number] => typeof entry[1] === "string" || typeof entry[1] === "number"));
    return [{ key: event.key, ...(Object.keys(values).length > 0 ? { values } : {}) }];
  });
  const storedFinalVote = stored.finalVote;
  const initialFinalVote = createInitialFinalVoteState();
  const validRoundOne = new Set<FinalVoteRoundOneChoice>(["for", "against", "abstain"]);
  const validRoundTwo = new Set<FinalVoteRoundTwoChoice>(["for", "against", "abstain", "for-explanation", "against-explanation"]);
  const finalVoteQueue = Array.isArray(storedFinalVote?.queue)
    ? storedFinalVote.queue.filter((id): id is string => typeof id === "string" && activeParticipantIds.has(id))
    : [];
  const explanationQueue = Array.isArray(storedFinalVote?.explanationQueue)
    ? storedFinalVote.explanationQueue.filter((id): id is string => typeof id === "string" && activeParticipantIds.has(id))
    : [];
  const finalVote = storedFinalVote ? {
    ...initialFinalVote,
    ...storedFinalVote,
    queue: finalVoteQueue,
    currentIndex: Math.min(storedFinalVote.currentIndex ?? 0, Math.max(0, finalVoteQueue.length - 1)),
    phase: finalVoteQueue.length === 0 ? "idle" as const : storedFinalVote.phase,
    roundOne: Object.fromEntries(Object.entries(storedFinalVote.roundOne ?? {}).filter((entry): entry is [string, FinalVoteRoundOneChoice] => activeParticipantIds.has(entry[0]) && validRoundOne.has(entry[1]))),
    roundTwo: Object.fromEntries(Object.entries(storedFinalVote.roundTwo ?? {}).filter((entry): entry is [string, FinalVoteRoundTwoChoice] => activeParticipantIds.has(entry[0]) && validRoundTwo.has(entry[1]))),
    roundThree: Object.fromEntries(Object.entries(storedFinalVote.roundThree ?? {}).filter((entry): entry is [string, VoteChoice] => activeParticipantIds.has(entry[0]) && (entry[1] === "for" || entry[1] === "against"))),
    explanationQueue,
    explanationIndex: Math.min(storedFinalVote.explanationIndex ?? 0, Math.max(0, explanationQueue.length - 1)),
  } : initialFinalVote;
  const moderatedDuration = stored.caucuses?.moderated?.duration ?? stored.caucusDuration ?? fallback.caucuses.moderated.duration;
  const moderatedExtension = stored.caucuses?.moderated?.extension ?? stored.caucusExtension ?? Math.max(0, moderatedDuration - 1);
  const storedSession = stored.session;
  const validYields = new Set<SpeakerYieldDestination>(["none", "chair", "donation", "questions", "comments"]);
  const validModules = new Set<ConsoleTab>(["speakers", "warnings", "caucus", "motions", "unlimited-questions", "voting", "log"]);
  const currentSpeakerParticipantId = typeof stored.currentSpeakerParticipantId === "string" && activeParticipantIds.has(stored.currentSpeakerParticipantId)
    ? stored.currentSpeakerParticipantId
    : participants.find((participant) => participant.name === stored.currentSpeaker)?.id ?? "";
  const currentQuestionerParticipantId = typeof stored.currentQuestionerParticipantId === "string" && activeParticipantIds.has(stored.currentQuestionerParticipantId)
    ? stored.currentQuestionerParticipantId
    : participants.find((participant) => participant.name === stored.currentQuestioner)?.id ?? "";
  const session = storedSession && typeof storedSession === "object"
    ? {
        id: typeof storedSession.id === "string" && storedSession.id ? storedSession.id : crypto.randomUUID(),
        title: typeof storedSession.title === "string" ? storedSession.title : "",
        number: typeof storedSession.number === "number" && storedSession.number >= 1 && storedSession.number <= 7
          ? storedSession.number as 1 | 2 | 3 | 4 | 5 | 6 | 7
          : sessionNumberFromTitle(typeof storedSession.title === "string" ? storedSession.title : "") || (stored.topic ? 1 as const : 0 as const),
        startedAt: typeof storedSession.startedAt === "string" && storedSession.startedAt ? storedSession.startedAt : new Date().toISOString(),
      }
    : {
        id: crypto.randomUUID(),
        title: "",
        number: 0 as const,
        startedAt: new Date().toISOString(),
      };

  return {
    ...fallback,
    ...stored,
    schemaVersion: 6,
    phase: stored.phase === "attendance" || stored.phase === "topic-selection" || stored.phase === "debate"
      ? stored.phase
      : stored.topic ? "debate" : "attendance",
    activeModule: validModules.has(stored.activeModule as ConsoleTab) ? stored.activeModule as ConsoleTab : "speakers",
    session,
    topicId: typeof stored.topicId === "string" ? stored.topicId : "",
    topicByLanguage: stored.topicByLanguage && typeof stored.topicByLanguage === "object"
      ? stored.topicByLanguage
      : undefined,
    participants,
    assignedParticipantIds,
    attendance,
    speakers: normalizeQueue(stored.speakers, participants).filter((item) => Boolean(item.participantId && activeParticipantIds.has(item.participantId))),
    currentSpeaker: currentSpeakerParticipantId && typeof stored.currentSpeaker === "string" ? stored.currentSpeaker : "",
    currentSpeakerParticipantId,
    questionQueue: normalizeQueue(stored.questionQueue, participants).filter((item) => Boolean(item.participantId && activeParticipantIds.has(item.participantId))),
    currentQuestioner: currentQuestionerParticipantId && typeof stored.currentQuestioner === "string" ? stored.currentQuestioner : "",
    currentQuestionerParticipantId,
    currentSpeakerYield: currentSpeakerParticipantId && validYields.has(stored.currentSpeakerYield as SpeakerYieldDestination)
      ? stored.currentSpeakerYield as SpeakerYieldDestination
      : "none",
    currentSpeakerRemainingTime: currentSpeakerParticipantId && typeof stored.currentSpeakerRemainingTime === "number"
      ? Math.max(0, stored.currentSpeakerRemainingTime)
      : currentSpeakerParticipantId ? Math.max(0, stored.currentSpeakerAllottedTime ?? stored.speakerTime ?? fallback.speakerTime) : fallback.speakerTime,
    currentSpeakerRunning: Boolean(currentSpeakerParticipantId && stored.currentSpeakerRunning === true),
    yieldRecipientParticipantId: typeof stored.yieldRecipientParticipantId === "string" && activeParticipantIds.has(stored.yieldRecipientParticipantId)
      ? stored.yieldRecipientParticipantId
      : "",
    donatedSecondsByParticipantId: Object.fromEntries(Object.entries(stored.donatedSecondsByParticipantId ?? {}).filter((entry): entry is [string, number] => activeParticipantIds.has(entry[0]) && typeof entry[1] === "number" && entry[1] > 0)),
    pendingDonationSeconds: currentSpeakerParticipantId && typeof stored.pendingDonationSeconds === "number" ? Math.max(0, stored.pendingDonationSeconds) : 0,
    unlimitedQuestionDocument: stored.unlimitedQuestionDocument === "working-a1" || stored.unlimitedQuestionDocument === "working-b1" || stored.unlimitedQuestionDocument === "possible-resolution-a1" || stored.unlimitedQuestionDocument === "possible-resolution-b1" || stored.unlimitedQuestionDocument === "custom"
      ? stored.unlimitedQuestionDocument
      : "",
    unlimitedQuestionCustomLabel: typeof stored.unlimitedQuestionCustomLabel === "string" ? stored.unlimitedQuestionCustomLabel.slice(0, 300) : "",
    warnings: Object.fromEntries(Object.entries(stored.warnings ?? {}).filter((entry): entry is [string, number] => activeParticipantIds.has(entry[0]) && typeof entry[1] === "number" && entry[1] >= 0)),
    caucuses: {
      moderated: { duration: moderatedDuration, extension: moderatedExtension },
      simple: {
        duration: stored.caucuses?.simple?.duration ?? fallback.caucuses.simple.duration,
        extension: stored.caucuses?.simple?.extension ?? fallback.caucuses.simple.extension,
      },
    },
    appeals: stored.appeals ?? fallback.appeals,
    events: rawEvents.length > 0 ? events : fallback.events,
    vote: {
      ...fallback.vote,
      ...stored.vote,
      context: "appeal",
      queue: (stored.vote?.queue ?? []).filter((id) => activeParticipantIds.has(id)),
      ballots,
    },
    finalVote,
  };
}
