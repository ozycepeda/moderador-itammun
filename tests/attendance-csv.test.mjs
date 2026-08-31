import assert from "node:assert/strict";
import test from "node:test";

import { attendanceCsvFilename, buildAttendanceCsv } from "../app/lib/attendance-csv.ts";
import { createInitialState } from "../app/lib/session-state.ts";
import { committees } from "../app/lib/committees.ts";

test("exports every participant with session metadata, attendance, warnings, and faults", () => {
  const participants = [
    { id: "mx", name: "México", observer: false },
    { id: "holy-see", name: "Santa Sede, Observador", observer: true },
  ];
  const state = createInitialState(participants);
  state.session = { id: "session-1", title: "Sesión 1, apertura", startedAt: "2026-08-31T15:00:00.000Z" };
  state.attendance.mx = "present-voting";
  state.attendance["holy-see"] = "observer";
  state.warnings.mx = 7;

  const csv = buildAttendanceCsv({ committee: committees[0], state, language: "es", exportedAt: "2026-08-31T18:00:00.000Z" });
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /Título de sesión/);
  assert.match(csv, /"Sesión 1, apertura"/);
  assert.match(csv, /México,Presente y votando,Sí,No,7,1,2/);
  assert.match(csv, /"Santa Sede, Observador",Observador/);
});

test("creates a filesystem-safe CSV filename", () => {
  assert.equal(
    attendanceCsvFilename("onu-mujeres", "Sesión 1 · Apertura", new Date("2026-08-31T12:00:00.000Z")),
    "itammun-asistencia-onu-mujeres-sesion-1-apertura-2026-08-31.csv",
  );
});
