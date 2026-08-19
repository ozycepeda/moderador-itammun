import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceFinalVoteExplanation,
  castFinalVote,
  createInitialState,
  startFinalVote,
} from "../app/lib/session-state.ts";
import { normalizeSessionState } from "../app/lib/session-migration.ts";

test("moves every eligible voter through all three final-vote rounds", () => {
  let vote = startFinalVote("Tópico de prueba", ["mx", "fr"]);
  vote = castFinalVote(vote, "mx", "for");
  vote = castFinalVote(vote, "fr", "abstain");
  assert.equal(vote.phase, "round-two");

  vote = castFinalVote(vote, "mx", "for-explanation");
  vote = castFinalVote(vote, "fr", "against");
  assert.equal(vote.phase, "explanations");
  assert.deepEqual(vote.explanationQueue, ["mx"]);

  vote = advanceFinalVoteExplanation(vote);
  assert.equal(vote.phase, "round-three");
  vote = castFinalVote(vote, "mx", "for");
  vote = castFinalVote(vote, "fr", "against");
  assert.equal(vote.phase, "complete");
  assert.deepEqual(vote.roundThree, { mx: "for", fr: "against" });
});

test("skips explanations when nobody requests one", () => {
  let vote = startFinalVote("Tópico", ["mx"]);
  vote = castFinalVote(vote, "mx", "abstain");
  vote = castFinalVote(vote, "mx", "for");
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

  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.topic, "Migración");
  assert.equal(migrated.speakers[0].participantId, "mx");
  assert.equal(migrated.caucuses.moderated.duration, 420);
  assert.equal(migrated.caucuses.simple.duration, 600);
  assert.equal(migrated.warnings.mx, 4);
});
