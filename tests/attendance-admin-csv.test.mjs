import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminAttendanceCsv } from "../worker/attendance-export.ts";

const row = {
  id: "session-cij", committeeId: "committee-cij", committeeSlug: "cij",
  committeeNameEs: "Corte Internacional de Justicia", committeeNameEn: "International Court of Justice",
  committeeAbbreviationEs: "CIJ", committeeAbbreviationEn: "ICJ", title: "Día 1",
  topicEs: "Caso", topicEn: "Case", startedAt: "2026-09-01T14:00:00.000Z",
  closedAt: "2026-09-01T18:00:00.000Z", receivedAt: "2026-09-01T18:00:02.000Z",
  expiresAt: "2027-03-01T18:00:02.000Z", participantCount: 1,
  presentCount: 0, presentVotingCount: 0, absentCount: 0, observerCount: 0, pendingCount: 0,
  sessionId: "session-cij", participantId: "judge-1", primaryNameEs: "Jueza Ejemplo", primaryNameEn: "Judge Example",
  secondaryNameEs: "México", secondaryNameEn: "Mexico", countryCode: "MX", representationKind: "judge",
  attendanceStatus: "present-voting", observer: false, warningsTotal: 9, warningsActive: 1, faults: 2,
};

test("exports the centralized ledger in Spanish with judge and represented country", () => {
  const csv = buildAdminAttendanceCsv([row], "es");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /Participante o juez/);
  assert.match(csv, /Jueza Ejemplo,México,Presente y votando,MX,judge,No,9,1,2/);
});

test("exports translated labels and names in English", () => {
  const csv = buildAdminAttendanceCsv([row], "en");
  assert.match(csv, /International Court of Justice,ICJ/);
  assert.match(csv, /Judge Example,Mexico,Present and voting/);
});
