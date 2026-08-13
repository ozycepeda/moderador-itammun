import type { Representation } from "./itammun-api";

export type AttendanceStatus = "pending" | "absent" | "present" | "present-voting" | "observer";
export type ConsoleTab = "speakers" | "rollcall" | "caucus" | "motions" | "voting" | "log";

export type SessionState = {
  topic: string;
  speakers: string[];
  currentSpeaker: string;
  speakerTime: number;
  attendance: Record<string, AttendanceStatus>;
  caucusDuration: number;
  caucusExtension: number;
  events: string[];
};

export function createInitialState(representations: Representation[]): SessionState {
  return {
    topic: "",
    speakers: [],
    currentSpeaker: "",
    speakerTime: 60,
    attendance: Object.fromEntries(representations.map((representation) => [
      representation.id,
      representation.observer ? "observer" : "pending",
    ])),
    caucusDuration: 600,
    caucusExtension: 599,
    events: [],
  };
}
