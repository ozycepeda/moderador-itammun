import type { Representation } from "./itammun-api";
import type { TranslationKey } from "./i18n";
import type { LocalizedText } from "./catalog-translations";

export type AttendanceStatus = "pending" | "absent" | "present" | "present-voting" | "observer";
export type ConsoleTab = "speakers" | "warnings" | "caucus" | "motions" | "unlimited-questions" | "voting" | "log";
export type VoteChoice = "for" | "against";
export type CaucusMode = "moderated" | "simple";
export type SpeakerYieldDestination = "none" | "chair" | "donation" | "questions" | "comments";
export type SessionPhase = "attendance" | "topic-selection" | "debate";
export type SessionNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type UnlimitedQuestionDocument = "working-a1" | "working-b1" | "possible-resolution-a1" | "possible-resolution-b1" | "custom" | "";

export type SpeakerQueueItem = {
  id: string;
  participantId?: string;
  name: string;
  bonusSeconds?: number;
};

export type SessionEvent = {
  key: TranslationKey;
  values?: Record<string, string | number>;
};

export type Appeal = {
  id: string;
  appellant: string;
  ruling: string;
  status: "pending" | "upheld" | "overturned";
};

export type VoteState = {
  label: string;
  context: "substantive" | "appeal";
  appealId?: string;
  queue: string[];
  currentIndex: number;
  ballots: Record<string, VoteChoice>;
  status: "idle" | "active" | "complete";
};

export type FinalVoteRoundOneChoice = VoteChoice | "abstain";
export type FinalVoteRoundTwoChoice = FinalVoteRoundOneChoice | "for-explanation" | "against-explanation";
export type FinalVotePhase =
  | "idle"
  | "round-one"
  | "round-one-complete"
  | "round-two"
  | "round-two-complete"
  | "explanations"
  | "explanations-complete"
  | "round-three"
  | "complete";

export type FinalVoteState = {
  label: string;
  queue: string[];
  currentIndex: number;
  phase: FinalVotePhase;
  roundOne: Record<string, FinalVoteRoundOneChoice>;
  roundTwo: Record<string, FinalVoteRoundTwoChoice>;
  roundThree: Record<string, VoteChoice>;
  explanationQueue: string[];
  explanationIndex: number;
};

export type CaucusState = {
  duration: number;
  extension: number;
};

export type SessionMetadata = {
  id: string;
  title: string;
  number: SessionNumber | 0;
  startedAt: string;
};

export type SessionState = {
  schemaVersion: 6;
  phase: SessionPhase;
  activeModule: ConsoleTab;
  session: SessionMetadata;
  topic: string;
  topicId: string;
  topicByLanguage?: LocalizedText;
  participants: Representation[];
  assignedParticipantIds: string[];
  speakers: SpeakerQueueItem[];
  currentSpeaker: string;
  currentSpeakerParticipantId: string;
  currentSpeakerAllottedTime: number;
  currentSpeakerRemainingTime: number;
  currentSpeakerRunning: boolean;
  currentSpeakerReceivedDonation: boolean;
  currentSpeakerYield: SpeakerYieldDestination;
  yieldRecipientParticipantId: string;
  donatedSecondsByParticipantId: Record<string, number>;
  pendingDonationSeconds: number;
  speakerTime: number;
  questionQueue: SpeakerQueueItem[];
  currentQuestioner: string;
  currentQuestionerParticipantId: string;
  unlimitedQuestionDocument: UnlimitedQuestionDocument;
  unlimitedQuestionCustomLabel: string;
  attendance: Record<string, AttendanceStatus>;
  warnings: Record<string, number>;
  caucuses: Record<CaucusMode, CaucusState>;
  appeals: Appeal[];
  vote: VoteState;
  finalVote: FinalVoteState;
  events: Array<string | SessionEvent>;
};

export function createInitialFinalVoteState(): FinalVoteState {
  return {
    label: "",
    queue: [],
    currentIndex: 0,
    phase: "idle",
    roundOne: {},
    roundTwo: {},
    roundThree: {},
    explanationQueue: [],
    explanationIndex: 0,
  };
}

export function startFinalVote(label: string, queue: string[]): FinalVoteState {
  return { ...createInitialFinalVoteState(), label, queue: [...queue], phase: "round-one" };
}

export function castFinalVote(
  vote: FinalVoteState,
  participantId: string,
  choice: FinalVoteRoundTwoChoice,
): FinalVoteState {
  if (vote.phase === "round-one") {
    if (choice === "for-explanation" || choice === "against-explanation") return vote;
    const roundOne = { ...vote.roundOne, [participantId]: choice };
    if (vote.currentIndex < vote.queue.length - 1) return { ...vote, roundOne, currentIndex: vote.currentIndex + 1 };
    return { ...vote, roundOne, phase: "round-one-complete", currentIndex: 0 };
  }

  if (vote.phase === "round-two") {
    const roundTwo = { ...vote.roundTwo, [participantId]: choice };
    if (vote.currentIndex < vote.queue.length - 1) return { ...vote, roundTwo, currentIndex: vote.currentIndex + 1 };
    const explanationQueue = vote.queue.filter((id) => {
      const ballot = roundTwo[id];
      return ballot === "for-explanation" || ballot === "against-explanation";
    });
    return {
      ...vote,
      roundTwo,
      explanationQueue,
      explanationIndex: 0,
      currentIndex: 0,
      phase: "round-two-complete",
    };
  }

  if (vote.phase === "round-three" && (choice === "for" || choice === "against")) {
    const roundThree = { ...vote.roundThree, [participantId]: choice };
    if (vote.currentIndex < vote.queue.length - 1) return { ...vote, roundThree, currentIndex: vote.currentIndex + 1 };
    return { ...vote, roundThree, phase: "complete" };
  }

  return vote;
}

export function advanceFinalVoteExplanation(vote: FinalVoteState): FinalVoteState {
  if (vote.phase !== "explanations") return vote;
  if (vote.explanationIndex < vote.explanationQueue.length - 1) {
    return { ...vote, explanationIndex: vote.explanationIndex + 1 };
  }
  return { ...vote, phase: "explanations-complete", currentIndex: 0 };
}

export function advanceFinalVoteStage(vote: FinalVoteState): FinalVoteState {
  if (vote.phase === "round-one-complete") {
    return { ...vote, phase: "round-two", currentIndex: 0 };
  }
  if (vote.phase === "round-two-complete") {
    return {
      ...vote,
      phase: vote.explanationQueue.length > 0 ? "explanations" : "round-three",
      currentIndex: 0,
      explanationIndex: 0,
    };
  }
  if (vote.phase === "explanations-complete") {
    return { ...vote, phase: "round-three", currentIndex: 0 };
  }
  return vote;
}

export function createInitialState(representations: Representation[]): SessionState {
  const defaultCaucus = { duration: 600, extension: 599 };
  return {
    schemaVersion: 6,
    phase: "attendance",
    activeModule: "speakers",
    session: { id: "", title: "", number: 0, startedAt: "" },
    topic: "",
    topicId: "",
    topicByLanguage: undefined,
    participants: representations,
    assignedParticipantIds: representations.filter((representation) => representation.status === "occupied").map((representation) => representation.id),
    speakers: [],
    currentSpeaker: "",
    currentSpeakerParticipantId: "",
    currentSpeakerAllottedTime: 60,
    currentSpeakerRemainingTime: 60,
    currentSpeakerRunning: false,
    currentSpeakerReceivedDonation: false,
    currentSpeakerYield: "none",
    yieldRecipientParticipantId: "",
    donatedSecondsByParticipantId: {},
    pendingDonationSeconds: 0,
    speakerTime: 60,
    questionQueue: [],
    currentQuestioner: "",
    currentQuestionerParticipantId: "",
    unlimitedQuestionDocument: "",
    unlimitedQuestionCustomLabel: "",
    attendance: Object.fromEntries(representations.map((representation) => [
      representation.id,
      representation.observer ? "observer" : "pending",
    ])),
    warnings: {},
    caucuses: { moderated: { ...defaultCaucus }, simple: { ...defaultCaucus } },
    appeals: [],
    vote: { label: "", context: "appeal", queue: [], currentIndex: 0, ballots: {}, status: "idle" },
    finalVote: createInitialFinalVoteState(),
    events: [],
  };
}

export function isParticipantInDebate(status: AttendanceStatus | undefined) {
  return status === "present" || status === "present-voting" || status === "observer";
}

export function applySpeakerYield(
  state: SessionState,
  destination: Exclude<SpeakerYieldDestination, "none">,
  remainingSeconds: number,
  recipientParticipantId = "",
) {
  if (!state.currentSpeaker || (remainingSeconds <= 0 && destination !== "chair")) return state;
  if (destination === "donation") {
    if (!recipientParticipantId || recipientParticipantId === state.currentSpeakerParticipantId || state.currentSpeakerReceivedDonation) return state;
    return {
      ...state,
      currentSpeakerYield: destination,
      currentSpeakerRemainingTime: 0,
      currentSpeakerRunning: false,
      yieldRecipientParticipantId: recipientParticipantId,
      donatedSecondsByParticipantId: {
        ...state.donatedSecondsByParticipantId,
        [recipientParticipantId]: (state.donatedSecondsByParticipantId[recipientParticipantId] ?? 0) + Math.max(0, remainingSeconds),
      },
      pendingDonationSeconds: 0,
    };
  }
  return {
    ...state,
    currentSpeakerYield: destination,
    currentSpeakerRemainingTime: destination === "chair" ? 0 : Math.max(0, remainingSeconds),
    currentSpeakerRunning: false,
    yieldRecipientParticipantId: "",
    pendingDonationSeconds: 0,
  };
}

export function advanceToNextSpeaker(state: SessionState) {
  const next = state.speakers[0];
  if (!next) return state;
  const donatedSeconds = next.participantId ? state.donatedSecondsByParticipantId[next.participantId] ?? 0 : 0;
  const queuedBonus = next.bonusSeconds ?? 0;
  const allotted = state.speakerTime + queuedBonus + donatedSeconds;
  const donatedSecondsByParticipantId = { ...state.donatedSecondsByParticipantId };
  if (next.participantId) delete donatedSecondsByParticipantId[next.participantId];
  return {
    ...state,
    speakers: state.speakers.slice(1),
    currentSpeaker: next.name,
    currentSpeakerParticipantId: next.participantId ?? "",
    currentSpeakerAllottedTime: allotted,
    currentSpeakerRemainingTime: allotted,
    currentSpeakerRunning: false,
    currentSpeakerReceivedDonation: donatedSeconds > 0 || queuedBonus > 0,
    currentSpeakerYield: "none" as const,
    yieldRecipientParticipantId: "",
    donatedSecondsByParticipantId,
    pendingDonationSeconds: 0,
    questionQueue: [],
    currentQuestioner: "",
    currentQuestionerParticipantId: "",
  };
}

export function sessionTitle(number: SessionNumber, language: "es" | "en") {
  return language === "es" ? `Sesión ${number} de trabajo` : `Working session ${number}`;
}

export function sessionNumberFromTitle(title: string): SessionNumber | 0 {
  const match = title.match(/(?:sesión|session)\s+([1-7])/i);
  const number = Number(match?.[1]);
  return number >= 1 && number <= 7 ? number as SessionNumber : 0;
}

export function localizedSessionTitle(title: string, language: "es" | "en") {
  const match = title.trim().match(/^(?:sesión\s+([1-7])\s+de\s+trabajo|working\s+session\s+([1-7]))$/i);
  const number = Number(match?.[1] ?? match?.[2]) as SessionNumber;
  return number ? sessionTitle(number, language) : title;
}

export function getDisciplinaryCounts(totalWarnings: number) {
  const total = Math.max(0, Math.floor(totalWarnings));
  return {
    totalWarnings: total,
    activeWarnings: total % 4,
    faults: Math.floor(total / 4),
  };
}
