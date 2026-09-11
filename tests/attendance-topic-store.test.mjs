import assert from "node:assert/strict";
import test from "node:test";

import { getLatestCommitteeTopic } from "../worker/attendance-store.ts";

test("recovers the latest closed topic for a committee without changing the schema", async () => {
  const statements = [];
  const db = {
    prepare(query) {
      const statement = {
        query,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          return query.includes("SELECT topic_es") ? { es: "Seguridad internacional", en: "International security" } : null;
        },
        async all() { return { results: [] }; },
        async run() { return { success: true }; },
      };
      statements.push(statement);
      return statement;
    },
    async batch() { return []; },
  };

  const topic = await getLatestCommitteeTopic(db, "interpol");
  assert.deepEqual(topic, { es: "Seguridad internacional", en: "International security" });
  const lookup = statements.find((statement) => statement.query.includes("SELECT topic_es"));
  assert.deepEqual(lookup.values, ["interpol"]);
});
