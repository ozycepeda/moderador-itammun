import type { AttendanceStatus } from "./session-state";

export type AttendanceLocalizedText = { es: string; en: string };

export type AttendanceSubmissionEntry = {
  participantId: string;
  primaryName: AttendanceLocalizedText;
  secondaryName: AttendanceLocalizedText;
  countryCode: string;
  representationKind: "delegation" | "judge" | "observer" | "custom";
  attendanceStatus: AttendanceStatus;
  observer: boolean;
  warningsTotal: number;
  warningsActive: number;
  faults: number;
};

export type AttendanceClosePayload = {
  session: {
    id: string;
    title: string;
    startedAt: string;
    closedAt: string;
  };
  committee: {
    id: string;
    slug: string;
    name: AttendanceLocalizedText;
    abbreviation: AttendanceLocalizedText;
  };
  topic: AttendanceLocalizedText;
  participants: AttendanceSubmissionEntry[];
};

export type AttendanceSaveReceipt = {
  ok: true;
  status: "saved" | "already-saved";
  receiptId: string;
  receivedAt: string;
  expiresAt: string;
};

export type AttendanceSessionSummary = {
  id: string;
  committeeId: string;
  committeeSlug: string;
  committeeNameEs: string;
  committeeNameEn: string;
  committeeAbbreviationEs: string;
  committeeAbbreviationEn: string;
  title: string;
  topicEs: string;
  topicEn: string;
  startedAt: string;
  closedAt: string;
  receivedAt: string;
  expiresAt: string;
  participantCount: number;
  presentCount: number;
  presentVotingCount: number;
  absentCount: number;
  observerCount: number;
  pendingCount: number;
};

export type AttendanceStoredEntry = {
  sessionId: string;
  participantId: string;
  primaryNameEs: string;
  primaryNameEn: string;
  secondaryNameEs: string;
  secondaryNameEn: string;
  countryCode: string;
  representationKind: string;
  attendanceStatus: AttendanceStatus;
  observer: boolean;
  warningsTotal: number;
  warningsActive: number;
  faults: number;
};

export type AttendanceSessionDetail = AttendanceSessionSummary & {
  participants: AttendanceStoredEntry[];
};
