import type { Representation } from "./itammun-api";
import type { TranslationKey } from "./i18n";

export type AttendanceStatus = "pending" | "absent" | "present" | "present-voting" | "observer";
export type ConsoleTab = "speakers" | "rollcall" | "caucus" | "motions" | "voting" | "log";
export type VoteChoice = "for" | "against";

export type SpeakerQueueItem = {
  id: string;
  name: string;
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

export type SessionState = {
  schemaVersion: 2;
  topic: string;
  participants: Representation[];
  assignedParticipantIds: string[];
  speakers: SpeakerQueueItem[];
  currentSpeaker: string;
  speakerTime: number;
  attendance: Record<string, AttendanceStatus>;
  caucusDuration: number;
  caucusExtension: number;
  appeals: Appeal[];
  vote: VoteState;
  events: Array<string | SessionEvent>;
};

export function createInitialState(representations: Representation[]): SessionState {
  return {
    schemaVersion: 2,
    topic: "",
    participants: representations,
    assignedParticipantIds: representations.map((representation) => representation.id),
    speakers: [],
    currentSpeaker: "",
    speakerTime: 60,
    attendance: Object.fromEntries(representations.map((representation) => [
      representation.id,
      representation.observer ? "observer" : "pending",
    ])),
    caucusDuration: 600,
    caucusExtension: 599,
    appeals: [],
    vote: { label: "", context: "substantive", queue: [], currentIndex: 0, ballots: {}, status: "idle" },
    events: [],
  };
}
