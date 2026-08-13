import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("../sql/001_catalog_test.sql", import.meta.url), "utf8");

test("defines the PostgreSQL catalog without debate state", () => {
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS moderator_test/);
  for (const table of ["committees", "countries", "committee_topics", "committee_countries"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS moderator_test\\.${table}`));
  }
  assert.doesNotMatch(sql, /committee_session|attendance|ballots|speaker_queue/i);
});

test("loads committees with colors and countries with flags", () => {
  const committeeRows = sql.match(/^  \('[0-9a-f-]{36}', '[^']+', '[^']+',/gm) ?? [];
  const countryRows = sql.match(/^  \('[A-Z]{3}','[a-z]{2}','[^']+','https:\/\/flagcdn\.com\/w80\/[a-z]{2}\.png',(true|false)\)/gm) ?? [];

  assert.equal(committeeRows.length, 10);
  assert.equal(countryRows.length, 33);
  assert.match(sql, /accent_color varchar\(7\) NOT NULL/);
  assert.match(sql, /dark_color varchar\(7\) NOT NULL/);
  assert.match(sql, /'onu-mujeres'.*'#3C98A5'.*'#1A3A3E'/);
  assert.match(sql, /'otan'.*'#E8B117'.*'#332A0C'/);
});
