import type { Representation } from "./itammun-api";

export type AttendanceStatus = "pending" | "absent" | "present" | "present-voting" | "observer";
export type ConsoleTab = "speakers" | "rollcall" | "caucus" | "motions" | "voting" | "log";
export type VoteChoice = "for" | "against" | "abstain";

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
  topic: string;
  participants: Representation[];
  speakers: string[];
  currentSpeaker: string;
  speakerTime: number;
  attendance: Record<string, AttendanceStatus>;
  caucusDuration: number;
  caucusSpeakerTime: number;
  caucusExtension: number;
  appeals: Appeal[];
  vote: VoteState;
  events: string[];
};

export function createInitialState(representations: Representation[]): SessionState {
  return {
    topic: "",
    participants: representations,
    speakers: [],
    currentSpeaker: "",
    speakerTime: 60,
    attendance: Object.fromEntries(representations.map((representation) => [
      representation.id,
      representation.observer ? "observer" : "pending",
    ])),
    caucusDuration: 600,
    caucusSpeakerTime: 45,
    caucusExtension: 599,
    appeals: [],
    vote: { label: "", context: "substantive", queue: [], currentIndex: 0, ballots: {}, status: "idle" },
    events: [],
  };
}
