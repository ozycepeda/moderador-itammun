import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceFinalVoteExplanation,
  advanceFinalVoteStage,
  advanceToNextSpeaker,
  applySpeakerYield,
  castFinalVote,
  createInitialState,
  getDisciplinaryCounts,
  isParticipantInDebate,
  startFinalVote,
} from "../app/lib/session-state.ts";
import { normalizeSessionState } from "../app/lib/session-migration.ts";
import { selectedParticipants } from "../app/lib/participant-selection.ts";

test("moves every eligible voter through all three final-vote rounds", () => {
  let vote = startFinalVote("Tópico de prueba", ["mx", "fr"]);
  vote = castFinalVote(vote, "mx", "for");
  vote = castFinalVote(vote, "fr", "abstain");
  assert.equal(vote.phase, "round-one-complete");
  vote = advanceFinalVoteStage(vote);
  assert.equal(vote.phase, "round-two");

  vote = castFinalVote(vote, "mx", "for-explanation");
  vote = castFinalVote(vote, "fr", "against");
  assert.equal(vote.phase, "round-two-complete");
  vote = advanceFinalVoteStage(vote);
  assert.equal(vote.phase, "explanations");
  assert.deepEqual(vote.explanationQueue, ["mx"]);

  vote = advanceFinalVoteExplanation(vote);
  assert.equal(vote.phase, "explanations-complete");
  vote = advanceFinalVoteStage(vote);
  assert.equal(vote.phase, "round-three");
  vote = castFinalVote(vote, "mx", "for");
  vote = castFinalVote(vote, "fr", "against");
  assert.equal(vote.phase, "complete");
  assert.deepEqual(vote.roundThree, { mx: "for", fr: "against" });
});

test("skips explanations when nobody requests one", () => {
  let vote = startFinalVote("Tópico", ["mx"]);
  vote = castFinalVote(vote, "mx", "abstain");
  assert.equal(vote.phase, "round-one-complete");
  vote = advanceFinalVoteStage(vote);
  vote = castFinalVote(vote, "mx", "for");
  assert.equal(vote.phase, "round-two-complete");
  vote = advanceFinalVoteStage(vote);
  assert.equal(vote.phase, "round-three");
});

test("migrates version two sessions without losing debate state", () => {
  const participant = { id: "mx", name: "México", observer: false };
  const fallback = createInitialState([participant]);
  const migrated = normalizeSessionState({
    schemaVersion: 2,
    topic: "Migración",
    participants: [participant],
    speakers: [{ id: "speaker", name: "México" }],
    attendance: { mx: "present-voting" },
    caucusDuration: 420,
    caucusExtension: 419,
    warnings: { mx: 4 },
  }, fallback);

  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.topic, "Migración");
  assert.equal(migrated.speakers[0].participantId, "mx");
  assert.equal(migrated.caucuses.moderated.duration, 420);
  assert.equal(migrated.caucuses.simple.duration, 600);
  assert.equal(migrated.warnings.mx, 4);
});

test("converts every fourth warning into one fault", () => {
  assert.deepEqual(getDisciplinaryCounts(0), { totalWarnings: 0, activeWarnings: 0, faults: 0 });
  assert.deepEqual(getDisciplinaryCounts(3), { totalWarnings: 3, activeWarnings: 3, faults: 0 });
  assert.deepEqual(getDisciplinaryCounts(4), { totalWarnings: 4, activeWarnings: 0, faults: 1 });
  assert.deepEqual(getDisciplinaryCounts(9), { totalWarnings: 9, activeWarnings: 1, faults: 2 });
});

test("only allows participants who are in the debate to join queues", () => {
  assert.equal(isParticipantInDebate("present"), true);
  assert.equal(isParticipantInDebate("present-voting"), true);
  assert.equal(isParticipantInDebate("observer"), true);
  assert.equal(isParticipantInDebate("absent"), false);
  assert.equal(isParticipantInDebate("pending"), false);
  assert.equal(isParticipantInDebate(undefined), false);
});

test("preselects only occupied catalog representations", () => {
  const state = createInitialState([
    { id: "paid", name: "Pagado", observer: false, status: "occupied" },
    { id: "available", name: "Disponible", observer: false, status: "available" },
  ]);
  assert.deepEqual(state.assignedParticipantIds, ["paid"]);
});

test("passes only checked setup participants into the debate", () => {
  const catalog = [
    { id: "checked", name: "Seleccionado", observer: false, status: "occupied" },
    { id: "unchecked", name: "No seleccionado", observer: false, status: "available" },
    { id: "manual", name: "Agregado manualmente", observer: false, status: "occupied" },
  ];
  assert.deepEqual(
    selectedParticipants(catalog, ["checked", "manual"]).map((participant) => participant.id),
    ["checked", "manual"],
  );
});

test("removes unchecked participants from sessions saved before the setup fix", () => {
  const catalog = [
    { id: "checked", name: "Seleccionado", observer: false, status: "occupied" },
    { id: "unchecked", name: "No seleccionado", observer: false, status: "available" },
  ];
  const fallback = createInitialState(catalog);
  const migrated = normalizeSessionState({
    ...fallback,
    participants: catalog,
    assignedParticipantIds: ["checked"],
    attendance: { checked: "present", unchecked: "present-voting" },
    speakers: [
      { id: "speaker-checked", participantId: "checked", name: "Seleccionado" },
      { id: "speaker-unchecked", participantId: "unchecked", name: "No seleccionado" },
    ],
    currentSpeaker: "No seleccionado",
    currentSpeakerParticipantId: "unchecked",
    warnings: { checked: 1, unchecked: 2 },
    finalVote: {
      ...fallback.finalVote,
      phase: "round-one",
      queue: ["checked", "unchecked"],
      roundOne: { checked: "for", unchecked: "against" },
    },
  }, fallback);

  assert.deepEqual(migrated.participants.map((participant) => participant.id), ["checked"]);
  assert.deepEqual(migrated.attendance, { checked: "present" });
  assert.deepEqual(migrated.speakers.map((speaker) => speaker.participantId), ["checked"]);
  assert.equal(migrated.currentSpeaker, "");
  assert.deepEqual(migrated.warnings, { checked: 1 });
  assert.deepEqual(migrated.finalVote.queue, ["checked"]);
  assert.deepEqual(migrated.finalVote.roundOne, { checked: "for" });
});

test("keeps the current speaker visible after yielding and advances only on request", () => {
  const state = createInitialState([]);
  state.currentSpeaker = "México";
  state.currentSpeakerParticipantId = "mx";
  state.speakers = [{ id: "next", participantId: "fr", name: "Francia", bonusSeconds: 0 }];

  const yielded = applySpeakerYield(state, "next", 17);
  assert.equal(yielded.currentSpeaker, "México");
  assert.equal(yielded.currentSpeakerYield, "next");
  assert.equal(yielded.pendingDonationSeconds, 17);
  assert.equal(yielded.speakers.length, 1);

  const advanced = advanceToNextSpeaker(yielded);
  assert.equal(advanced.currentSpeaker, "Francia");
  assert.equal(advanced.currentSpeakerAllottedTime, 77);
  assert.equal(advanced.currentSpeakerYield, "none");
  assert.equal(advanced.pendingDonationSeconds, 0);
  assert.equal(advanced.speakers.length, 0);
});
