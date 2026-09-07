import assert from "node:assert/strict";
import test from "node:test";

import { committeeBySlug } from "../app/lib/committees.ts";
import {
  getCommitteeDetail,
  representationFullName,
  representationMatches,
} from "../app/lib/itammun-api.ts";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("loads the live catalog and initially selects only occupied representations", async () => {
  const committee = committeeBySlug("onu-mujeres");
  assert.ok(committee);
  const detail = await getCommitteeDetail(committee, async () => jsonResponse({
    ok: true,
    available: true,
    debate: {
      topics: [{ title: "Tópico original" }],
      representations: [
        { id: "mx", name: "México", flagUrl: "https://flags.example/mx.png", status: "occupied" },
        { id: "us", name: "Estados Unidos", flagUrl: "https://flags.example/us.png", status: "available" },
      ],
    },
  }));

  assert.equal(detail.source, "live");
  assert.deepEqual(detail.initiallyAssignedRepresentationIds, ["mx"]);
  assert.equal(representationFullName(detail.representations[0], "en"), "Mexico");
  assert.equal(representationFullName(detail.representations[1], "en"), "United States");
  assert.match(detail.topics[0].titleByLanguage.en, /^Topic A:/);
});

test("models ICJ entries as judges searchable by judge or represented country", async () => {
  const committee = committeeBySlug("cij");
  assert.ok(committee);
  const detail = await getCommitteeDetail(committee, async () => jsonResponse({
    ok: true,
    available: true,
    debate: {
      topics: [{ title: "Case" }],
      representations: [
        { id: "judge", name: "Hisashi Owada — Japón", flagUrl: "https://flags.example/jp.png", status: "occupied" },
      ],
    },
  }));

  const judge = detail.representations[0];
  assert.equal(judge.kind, "judge");
  assert.equal(representationFullName(judge, "es"), "Hisashi Owada — Japón");
  assert.equal(representationFullName(judge, "en"), "Hisashi Owada — Japan");
  assert.equal(representationMatches(judge, "Owada", "es"), true);
  assert.equal(representationMatches(judge, "Japan", "en"), true);
});

test("fails closed instead of silently substituting test countries", async () => {
  const committee = committeeBySlug("acnur");
  assert.ok(committee);
  const detail = await getCommitteeDetail(committee, async () => jsonResponse({ ok: false }, 503));
  assert.deepEqual(detail, {
    topics: [],
    representations: [],
    initiallyAssignedRepresentationIds: [],
    source: "unavailable",
  });
});
