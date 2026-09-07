import assert from "node:assert/strict";
import test from "node:test";

import { buildAttendanceClosePayload } from "../app/lib/attendance-submission.ts";
import { committeeBySlug } from "../app/lib/committees.ts";
import { createInitialState } from "../app/lib/session-state.ts";

test("builds a bilingual close payload with every attendance state and ICJ judge", () => {
  const committee = committeeBySlug("cij");
  assert.ok(committee);
  const state = createInitialState([
    {
      id: "judge-mx", name: "Judge Example — México", observer: false, kind: "judge", countryCode: "MX",
      nameByLanguage: { es: "Jueza Ejemplo", en: "Judge Example" },
      secondaryNameByLanguage: { es: "México", en: "Mexico" },
    },
    { id: "judge-pending", name: "Pending Judge — France", observer: false, kind: "judge", countryCode: "FR" },
  ]);
  state.session = { id: "session-cij", title: "Día 1", startedAt: "2026-09-01T14:00:00.000Z" };
  state.topic = "Caso";
  state.topicByLanguage = { es: "Caso", en: "Case" };
  state.attendance["judge-mx"] = "present-voting";
  state.warnings["judge-mx"] = 9;

  const payload = buildAttendanceClosePayload({ committee, state, closedAt: "2026-09-01T18:00:00.000Z" });
  assert.equal(payload.committee.abbreviation.es, "CIJ");
  assert.equal(payload.committee.abbreviation.en, "ICJ");
  assert.equal(payload.participants.length, 2);
  assert.deepEqual(payload.participants[0].primaryName, { es: "Jueza Ejemplo", en: "Judge Example" });
  assert.deepEqual(payload.participants[0].secondaryName, { es: "México", en: "Mexico" });
  assert.deepEqual(
    [payload.participants[0].warningsTotal, payload.participants[0].warningsActive, payload.participants[0].faults],
    [9, 1, 2],
  );
  assert.equal(payload.participants[1].attendanceStatus, "pending");
});
