import type { Representation } from "./itammun-api";
import type { TranslationKey } from "./i18n";

export type AttendanceStatus = "pending" | "absent" | "present" | "present-voting" | "observer";
export type ConsoleTab = "speakers" | "rollcall" | "caucus" | "motions" | "voting" | "log";
export type VoteChoice = "for" | "against";
export type CaucusMode = "moderated" | "simple";

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

export type SessionState = {
  schemaVersion: 3;
  topic: string;
  participants: Representation[];
  assignedParticipantIds: string[];
  speakers: SpeakerQueueItem[];
  currentSpeaker: string;
  currentSpeakerParticipantId: string;
  currentSpeakerAllottedTime: number;
  currentSpeakerReceivedDonation: boolean;
  speakerTime: number;
  questionQueue: SpeakerQueueItem[];
  currentQuestioner: string;
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
    schemaVersion: 3,
    topic: "",
    participants: representations,
    assignedParticipantIds: representations.map((representation) => representation.id),
    speakers: [],
    currentSpeaker: "",
    currentSpeakerParticipantId: "",
    currentSpeakerAllottedTime: 60,
    currentSpeakerReceivedDonation: false,
    speakerTime: 60,
    questionQueue: [],
    currentQuestioner: "",
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
