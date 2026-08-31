import { isTranslationKey } from "./i18n";
import {
  createInitialFinalVoteState,
  type AttendanceStatus,
  type FinalVoteRoundOneChoice,
  type FinalVoteRoundTwoChoice,
  type SessionEvent,
  type SessionState,
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
  const participants = [
    ...fallback.participants,
    ...storedParticipants.filter((storedParticipant) => !fallback.participants.some((participant) => participant.id === storedParticipant.id)),
  ];
  const storedAttendance = stored.attendance ?? {};
  const attendance = Object.fromEntries(participants.map((participant) => [
    participant.id,
    storedAttendance[participant.id] ?? (participant.observer ? "observer" : "pending"),
  ])) as Record<string, AttendanceStatus>;
  const ballots = Object.fromEntries(Object.entries(stored.vote?.ballots ?? {}).filter((entry): entry is [string, VoteChoice] => entry[1] === "for" || entry[1] === "against"));
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
  const finalVote = storedFinalVote ? {
    ...initialFinalVote,
    ...storedFinalVote,
    queue: Array.isArray(storedFinalVote.queue) ? storedFinalVote.queue : [],
    roundOne: Object.fromEntries(Object.entries(storedFinalVote.roundOne ?? {}).filter((entry): entry is [string, FinalVoteRoundOneChoice] => validRoundOne.has(entry[1]))),
    roundTwo: Object.fromEntries(Object.entries(storedFinalVote.roundTwo ?? {}).filter((entry): entry is [string, FinalVoteRoundTwoChoice] => validRoundTwo.has(entry[1]))),
    roundThree: Object.fromEntries(Object.entries(storedFinalVote.roundThree ?? {}).filter((entry): entry is [string, VoteChoice] => entry[1] === "for" || entry[1] === "against")),
    explanationQueue: Array.isArray(storedFinalVote.explanationQueue) ? storedFinalVote.explanationQueue : [],
  } : initialFinalVote;
  const moderatedDuration = stored.caucuses?.moderated?.duration ?? stored.caucusDuration ?? fallback.caucuses.moderated.duration;
  const moderatedExtension = stored.caucuses?.moderated?.extension ?? stored.caucusExtension ?? Math.max(0, moderatedDuration - 1);
  const storedSession = stored.session;
  const session = storedSession && typeof storedSession === "object"
    ? {
        id: typeof storedSession.id === "string" && storedSession.id ? storedSession.id : crypto.randomUUID(),
        title: typeof storedSession.title === "string" ? storedSession.title : "",
        startedAt: typeof storedSession.startedAt === "string" && storedSession.startedAt ? storedSession.startedAt : new Date().toISOString(),
      }
    : {
        id: crypto.randomUUID(),
        title: "",
        startedAt: new Date().toISOString(),
      };

  return {
    ...fallback,
    ...stored,
    schemaVersion: 4,
    session,
    participants,
    assignedParticipantIds: stored.assignedParticipantIds ?? storedParticipants.map((participant) => participant.id),
    attendance,
    speakers: normalizeQueue(stored.speakers, participants),
    questionQueue: normalizeQueue(stored.questionQueue, participants),
    warnings: Object.fromEntries(Object.entries(stored.warnings ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] >= 0)),
    caucuses: {
      moderated: { duration: moderatedDuration, extension: moderatedExtension },
      simple: {
        duration: stored.caucuses?.simple?.duration ?? fallback.caucuses.simple.duration,
        extension: stored.caucuses?.simple?.extension ?? fallback.caucuses.simple.extension,
      },
    },
    appeals: stored.appeals ?? fallback.appeals,
    events: rawEvents.length > 0 ? events : fallback.events,
    vote: { ...fallback.vote, ...stored.vote, context: "appeal", ballots },
    finalVote,
  };
}
