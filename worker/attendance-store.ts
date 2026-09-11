import type {
  AttendanceClosePayload,
  AttendanceSaveReceipt,
  AttendanceSessionDetail,
  AttendanceSessionSummary,
  AttendanceStoredEntry,
} from "../app/lib/attendance-contract";
import type { AttendanceDatabase } from "./d1-types";

const initializedDatabases = new WeakSet<object>();

const createSessionsTable = `
  CREATE TABLE IF NOT EXISTS attendance_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    committee_id TEXT NOT NULL,
    committee_slug TEXT NOT NULL,
    committee_name_es TEXT NOT NULL,
    committee_name_en TEXT NOT NULL,
    committee_abbreviation_es TEXT NOT NULL,
    committee_abbreviation_en TEXT NOT NULL,
    title TEXT NOT NULL,
    topic_es TEXT NOT NULL DEFAULT '',
    topic_en TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    closed_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    participant_count INTEGER NOT NULL,
    checksum TEXT NOT NULL
  )`;

const createEntriesTable = `
  CREATE TABLE IF NOT EXISTS attendance_entries (
    session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL,
    primary_name_es TEXT NOT NULL,
    primary_name_en TEXT NOT NULL,
    secondary_name_es TEXT NOT NULL DEFAULT '',
    secondary_name_en TEXT NOT NULL DEFAULT '',
    country_code TEXT NOT NULL DEFAULT '',
    representation_kind TEXT NOT NULL,
    attendance_status TEXT NOT NULL,
    observer INTEGER NOT NULL DEFAULT 0,
    warnings_total INTEGER NOT NULL DEFAULT 0,
    warnings_active INTEGER NOT NULL DEFAULT 0,
    faults INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, participant_id)
  )`;

export async function ensureAttendanceSchema(db: AttendanceDatabase) {
  if (initializedDatabases.has(db as object)) return;
  await db.batch([
    db.prepare(createSessionsTable),
    db.prepare(createEntriesTable),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_sessions_committee_closed ON attendance_sessions (committee_id, closed_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_sessions_expires ON attendance_sessions (expires_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_entries_status ON attendance_entries (attendance_status)"),
    db.prepare("PRAGMA optimize"),
  ]);
  initializedDatabases.add(db as object);
}

export async function purgeExpiredAttendance(db: AttendanceDatabase, now = new Date().toISOString()) {
  await ensureAttendanceSchema(db);
  await db.batch([
    db.prepare("DELETE FROM attendance_entries WHERE session_id IN (SELECT id FROM attendance_sessions WHERE expires_at <= ?)").bind(now),
    db.prepare("DELETE FROM attendance_sessions WHERE expires_at <= ?").bind(now),
  ]);
}

function addSixMonths(value: string) {
  const date = new Date(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}

async function checksum(payload: AttendanceClosePayload) {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

type ExistingSession = {
  checksum: string;
  receivedAt: string;
  expiresAt: string;
};

async function existingSession(db: AttendanceDatabase, sessionId: string) {
  return db.prepare(`
    SELECT checksum, received_at AS receivedAt, expires_at AS expiresAt
    FROM attendance_sessions
    WHERE id = ?
  `).bind(sessionId).first<ExistingSession>();
}

function receipt(payload: AttendanceClosePayload, existing: ExistingSession, status: AttendanceSaveReceipt["status"]): AttendanceSaveReceipt {
  return {
    ok: true,
    status,
    receiptId: payload.session.id,
    receivedAt: existing.receivedAt,
    expiresAt: existing.expiresAt,
  };
}

export async function saveAttendanceSession(db: AttendanceDatabase, payload: AttendanceClosePayload): Promise<AttendanceSaveReceipt | { ok: false; error: "session-conflict" }> {
  await ensureAttendanceSchema(db);
  await purgeExpiredAttendance(db);
  const payloadChecksum = await checksum(payload);
  const stored = await existingSession(db, payload.session.id);
  if (stored) return stored.checksum === payloadChecksum ? receipt(payload, stored, "already-saved") : { ok: false, error: "session-conflict" };

  const receivedAt = new Date().toISOString();
  const expiresAt = addSixMonths(receivedAt);
  const statements = [
    db.prepare(`
      INSERT INTO attendance_sessions (
        id, committee_id, committee_slug, committee_name_es, committee_name_en,
        committee_abbreviation_es, committee_abbreviation_en, title, topic_es,
        topic_en, started_at, closed_at, received_at, expires_at, participant_count, checksum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      payload.session.id,
      payload.committee.id,
      payload.committee.slug,
      payload.committee.name.es,
      payload.committee.name.en,
      payload.committee.abbreviation.es,
      payload.committee.abbreviation.en,
      payload.session.title,
      payload.topic.es,
      payload.topic.en,
      payload.session.startedAt,
      payload.session.closedAt,
      receivedAt,
      expiresAt,
      payload.participants.length,
      payloadChecksum,
    ),
    ...payload.participants.map((participant) => db.prepare(`
      INSERT INTO attendance_entries (
        session_id, participant_id, primary_name_es, primary_name_en,
        secondary_name_es, secondary_name_en, country_code, representation_kind,
        attendance_status, observer, warnings_total, warnings_active, faults
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      payload.session.id,
      participant.participantId,
      participant.primaryName.es,
      participant.primaryName.en,
      participant.secondaryName.es,
      participant.secondaryName.en,
      participant.countryCode,
      participant.representationKind,
      participant.attendanceStatus,
      participant.observer ? 1 : 0,
      participant.warningsTotal,
      participant.warningsActive,
      participant.faults,
    )),
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    const raced = await existingSession(db, payload.session.id);
    if (raced) return raced.checksum === payloadChecksum ? receipt(payload, raced, "already-saved") : { ok: false, error: "session-conflict" };
    throw error;
  }

  return { ok: true, status: "saved", receiptId: payload.session.id, receivedAt, expiresAt };
}

export type AttendanceFilters = {
  committeeSlug?: string;
  from?: string;
  to?: string;
};

function filterSql(filters: AttendanceFilters, alias = "s") {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filters.committeeSlug) {
    conditions.push(`${alias}.committee_slug = ?`);
    values.push(filters.committeeSlug);
  }
  if (filters.from) {
    conditions.push(`${alias}.closed_at >= ?`);
    values.push(`${filters.from}T00:00:00.000Z`);
  }
  if (filters.to) {
    conditions.push(`${alias}.closed_at <= ?`);
    values.push(`${filters.to}T23:59:59.999Z`);
  }
  return { clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", values };
}

type SummaryRow = Omit<AttendanceSessionSummary,
  "participantCount" | "presentCount" | "presentVotingCount" | "absentCount" | "observerCount" | "pendingCount"
> & {
  participantCount: number | string;
  presentCount: number | string;
  presentVotingCount: number | string;
  absentCount: number | string;
  observerCount: number | string;
  pendingCount: number | string;
};

function summary(row: SummaryRow): AttendanceSessionSummary {
  return {
    ...row,
    participantCount: Number(row.participantCount),
    presentCount: Number(row.presentCount),
    presentVotingCount: Number(row.presentVotingCount),
    absentCount: Number(row.absentCount),
    observerCount: Number(row.observerCount),
    pendingCount: Number(row.pendingCount),
  };
}

const summarySelect = `
  SELECT
    s.id AS id,
    s.committee_id AS committeeId,
    s.committee_slug AS committeeSlug,
    s.committee_name_es AS committeeNameEs,
    s.committee_name_en AS committeeNameEn,
    s.committee_abbreviation_es AS committeeAbbreviationEs,
    s.committee_abbreviation_en AS committeeAbbreviationEn,
    s.title AS title,
    s.topic_es AS topicEs,
    s.topic_en AS topicEn,
    s.started_at AS startedAt,
    s.closed_at AS closedAt,
    s.received_at AS receivedAt,
    s.expires_at AS expiresAt,
    s.participant_count AS participantCount,
    COALESCE(SUM(CASE WHEN e.attendance_status = 'present' THEN 1 ELSE 0 END), 0) AS presentCount,
    COALESCE(SUM(CASE WHEN e.attendance_status = 'present-voting' THEN 1 ELSE 0 END), 0) AS presentVotingCount,
    COALESCE(SUM(CASE WHEN e.attendance_status = 'absent' THEN 1 ELSE 0 END), 0) AS absentCount,
    COALESCE(SUM(CASE WHEN e.attendance_status = 'observer' THEN 1 ELSE 0 END), 0) AS observerCount,
    COALESCE(SUM(CASE WHEN e.attendance_status = 'pending' THEN 1 ELSE 0 END), 0) AS pendingCount
  FROM attendance_sessions s
  LEFT JOIN attendance_entries e ON e.session_id = s.id
`;

export async function listAttendanceSessions(db: AttendanceDatabase, filters: AttendanceFilters = {}) {
  await purgeExpiredAttendance(db);
  const where = filterSql(filters);
  const result = await db.prepare(`${summarySelect} ${where.clause} GROUP BY s.id ORDER BY s.closed_at DESC LIMIT 500`).bind(...where.values).all<SummaryRow>();
  return (result.results ?? []).map(summary);
}

export type LatestCommitteeTopic = {
  es: string;
  en: string;
};

export async function getLatestCommitteeTopic(db: AttendanceDatabase, committeeSlug: string): Promise<LatestCommitteeTopic | null> {
  await purgeExpiredAttendance(db);
  const row = await db.prepare(`
    SELECT topic_es AS es, topic_en AS en
    FROM attendance_sessions
    WHERE committee_slug = ? AND (TRIM(topic_es) <> '' OR TRIM(topic_en) <> '')
    ORDER BY closed_at DESC
    LIMIT 1
  `).bind(committeeSlug).first<LatestCommitteeTopic>();
  return row ? { es: row.es || row.en, en: row.en || row.es } : null;
}

type EntryRow = Omit<AttendanceStoredEntry, "observer" | "warningsTotal" | "warningsActive" | "faults"> & {
  observer: number | boolean;
  warningsTotal: number | string;
  warningsActive: number | string;
  faults: number | string;
};

function storedEntry(row: EntryRow): AttendanceStoredEntry {
  return {
    ...row,
    observer: Boolean(row.observer),
    warningsTotal: Number(row.warningsTotal),
    warningsActive: Number(row.warningsActive),
    faults: Number(row.faults),
  };
}

const entriesSelect = `
  SELECT
    e.session_id AS sessionId,
    e.participant_id AS participantId,
    e.primary_name_es AS primaryNameEs,
    e.primary_name_en AS primaryNameEn,
    e.secondary_name_es AS secondaryNameEs,
    e.secondary_name_en AS secondaryNameEn,
    e.country_code AS countryCode,
    e.representation_kind AS representationKind,
    e.attendance_status AS attendanceStatus,
    e.observer AS observer,
    e.warnings_total AS warningsTotal,
    e.warnings_active AS warningsActive,
    e.faults AS faults
  FROM attendance_entries e
`;

export async function getAttendanceSession(db: AttendanceDatabase, sessionId: string): Promise<AttendanceSessionDetail | null> {
  await purgeExpiredAttendance(db);
  const row = await db.prepare(`${summarySelect} WHERE s.id = ? GROUP BY s.id`).bind(sessionId).first<SummaryRow>();
  if (!row) return null;
  const entries = await db.prepare(`${entriesSelect} WHERE e.session_id = ? ORDER BY e.primary_name_es`).bind(sessionId).all<EntryRow>();
  return { ...summary(row), participants: (entries.results ?? []).map(storedEntry) };
}

export type AttendanceExportRow = AttendanceSessionSummary & AttendanceStoredEntry;

export async function exportAttendanceRows(db: AttendanceDatabase, filters: AttendanceFilters = {}): Promise<AttendanceExportRow[]> {
  await purgeExpiredAttendance(db);
  const where = filterSql(filters);
  const result = await db.prepare(`
    SELECT
      s.id AS id,
      s.committee_id AS committeeId,
      s.committee_slug AS committeeSlug,
      s.committee_name_es AS committeeNameEs,
      s.committee_name_en AS committeeNameEn,
      s.committee_abbreviation_es AS committeeAbbreviationEs,
      s.committee_abbreviation_en AS committeeAbbreviationEn,
      s.title AS title,
      s.topic_es AS topicEs,
      s.topic_en AS topicEn,
      s.started_at AS startedAt,
      s.closed_at AS closedAt,
      s.received_at AS receivedAt,
      s.expires_at AS expiresAt,
      s.participant_count AS participantCount,
      e.session_id AS sessionId,
      e.participant_id AS participantId,
      e.primary_name_es AS primaryNameEs,
      e.primary_name_en AS primaryNameEn,
      e.secondary_name_es AS secondaryNameEs,
      e.secondary_name_en AS secondaryNameEn,
      e.country_code AS countryCode,
      e.representation_kind AS representationKind,
      e.attendance_status AS attendanceStatus,
      e.observer AS observer,
      e.warnings_total AS warningsTotal,
      e.warnings_active AS warningsActive,
      e.faults AS faults,
      0 AS presentCount,
      0 AS presentVotingCount,
      0 AS absentCount,
      0 AS observerCount,
      0 AS pendingCount
    FROM attendance_sessions s
    JOIN attendance_entries e ON e.session_id = s.id
    ${where.clause}
    ORDER BY s.closed_at DESC, e.primary_name_es
  `).bind(...where.values).all<SummaryRow & EntryRow>();
  return (result.results ?? []).map((row) => ({ ...summary(row), ...storedEntry(row) }));
}
