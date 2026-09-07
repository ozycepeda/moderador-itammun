import assert from "node:assert/strict";
import test from "node:test";

import { validateAttendanceClosePayload } from "../worker/attendance-validation.ts";

function validPayload() {
  return {
    session: { id: "session-1", title: "Día 1", startedAt: "2026-09-01T14:00:00.000Z", closedAt: "2026-09-01T18:00:00.000Z" },
    committee: {
      id: "committee-1", slug: "cij",
      name: { es: "Corte Internacional de Justicia", en: "International Court of Justice" },
      abbreviation: { es: "CIJ", en: "ICJ" },
    },
    topic: { es: "Caso de prueba", en: "Test case" },
    participants: [{
      participantId: "judge-1",
      primaryName: { es: "Jueza Ejemplo", en: "Judge Example" },
      secondaryName: { es: "México", en: "Mexico" },
      countryCode: "mx",
      representationKind: "judge",
      attendanceStatus: "present-voting",
      observer: false,
      warningsTotal: 9,
      warningsActive: 1,
      faults: 2,
    }],
  };
}

test("validates and normalizes an immutable attendance closing", () => {
  const result = validateAttendanceClosePayload(validPayload(), "session-1");
  assert.ok(result);
  assert.equal(result.participants[0].countryCode, "MX");
  assert.equal(result.participants[0].secondaryName.es, "México");
  assert.equal(result.participants[0].attendanceStatus, "present-voting");
});

test("rejects wrong warning-to-fault calculations and duplicate participants", () => {
  const wrongDiscipline = validPayload();
  wrongDiscipline.participants[0].faults = 3;
  assert.equal(validateAttendanceClosePayload(wrongDiscipline, "session-1"), null);

  const duplicate = validPayload();
  duplicate.participants.push({ ...duplicate.participants[0] });
  assert.equal(validateAttendanceClosePayload(duplicate, "session-1"), null);
});

test("rejects a different route id or a close preceding the session", () => {
  assert.equal(validateAttendanceClosePayload(validPayload(), "other-session"), null);
  const reversed = validPayload();
  reversed.session.closedAt = "2026-09-01T13:59:59.000Z";
  assert.equal(validateAttendanceClosePayload(reversed, "session-1"), null);
});
