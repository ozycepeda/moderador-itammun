import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const attendanceSessions = sqliteTable("attendance_sessions", {
  id: text("id").primaryKey(),
  committeeId: text("committee_id").notNull(),
  committeeSlug: text("committee_slug").notNull(),
  committeeNameEs: text("committee_name_es").notNull(),
  committeeNameEn: text("committee_name_en").notNull(),
  committeeAbbreviationEs: text("committee_abbreviation_es").notNull(),
  committeeAbbreviationEn: text("committee_abbreviation_en").notNull(),
  title: text("title").notNull(),
  topicEs: text("topic_es").notNull().default(""),
  topicEn: text("topic_en").notNull().default(""),
  startedAt: text("started_at").notNull(),
  closedAt: text("closed_at").notNull(),
  receivedAt: text("received_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  participantCount: integer("participant_count").notNull(),
  checksum: text("checksum").notNull(),
}, (table) => [
  index("idx_attendance_sessions_committee_closed").on(table.committeeId, table.closedAt),
  index("idx_attendance_sessions_expires").on(table.expiresAt),
]);

export const attendanceEntries = sqliteTable("attendance_entries", {
  sessionId: text("session_id").notNull().references(() => attendanceSessions.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  primaryNameEs: text("primary_name_es").notNull(),
  primaryNameEn: text("primary_name_en").notNull(),
  secondaryNameEs: text("secondary_name_es").notNull().default(""),
  secondaryNameEn: text("secondary_name_en").notNull().default(""),
  countryCode: text("country_code").notNull().default(""),
  representationKind: text("representation_kind").notNull(),
  attendanceStatus: text("attendance_status").notNull(),
  observer: integer("observer", { mode: "boolean" }).notNull().default(false),
  warningsTotal: integer("warnings_total").notNull().default(0),
  warningsActive: integer("warnings_active").notNull().default(0),
  faults: integer("faults").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.participantId] }),
  index("idx_attendance_entries_status").on(table.attendanceStatus),
]);
