import type {
  AttendanceClosePayload,
  AttendanceLocalizedText,
  AttendanceSubmissionEntry,
} from "../app/lib/attendance-contract";

const statuses = new Set(["pending", "absent", "present", "present-voting", "observer"]);
const kinds = new Set(["delegation", "judge", "observer", "custom"]);

function text(value: unknown, maximum: number, required = true) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum) return null;
  return normalized;
}

function localizedText(value: unknown, maximum: number, required = true): AttendanceLocalizedText | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const es = text(candidate.es, maximum, required);
  const en = text(candidate.en, maximum, required);
  if (es === null || en === null) return null;
  return { es, en };
}

function integer(value: unknown, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum ? value : null;
}

function isoDate(value: unknown) {
  const normalized = text(value, 40);
  if (!normalized || Number.isNaN(Date.parse(normalized))) return null;
  return new Date(normalized).toISOString();
}

function entry(value: unknown): AttendanceSubmissionEntry | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const participantId = text(candidate.participantId, 160);
  const primaryName = localizedText(candidate.primaryName, 240);
  const secondaryName = localizedText(candidate.secondaryName, 240, false);
  const countryCode = text(candidate.countryCode, 8, false);
  const warningsTotal = integer(candidate.warningsTotal, 10_000);
  const warningsActive = integer(candidate.warningsActive, 3);
  const faults = integer(candidate.faults, 2_500);
  if (!participantId || !primaryName || !secondaryName || countryCode === null || warningsTotal === null || warningsActive === null || faults === null) return null;
  if (typeof candidate.attendanceStatus !== "string" || !statuses.has(candidate.attendanceStatus)
    || typeof candidate.representationKind !== "string" || !kinds.has(candidate.representationKind)
    || typeof candidate.observer !== "boolean") return null;
  if (warningsActive !== warningsTotal % 4 || faults !== Math.floor(warningsTotal / 4)) return null;
  return {
    participantId,
    primaryName,
    secondaryName,
    countryCode: countryCode.toUpperCase(),
    representationKind: candidate.representationKind as AttendanceSubmissionEntry["representationKind"],
    attendanceStatus: candidate.attendanceStatus as AttendanceSubmissionEntry["attendanceStatus"],
    observer: candidate.observer,
    warningsTotal,
    warningsActive,
    faults,
  };
}

export function validateAttendanceClosePayload(value: unknown, routeSessionId: string): AttendanceClosePayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const rawSession = candidate.session && typeof candidate.session === "object" ? candidate.session as Record<string, unknown> : {};
  const rawCommittee = candidate.committee && typeof candidate.committee === "object" ? candidate.committee as Record<string, unknown> : {};
  const id = text(rawSession.id, 160);
  const title = text(rawSession.title, 240);
  const startedAt = isoDate(rawSession.startedAt);
  const closedAt = isoDate(rawSession.closedAt);
  const committeeId = text(rawCommittee.id, 160);
  const slug = text(rawCommittee.slug, 160);
  const name = localizedText(rawCommittee.name, 240);
  const abbreviation = localizedText(rawCommittee.abbreviation, 120);
  const topic = localizedText(candidate.topic, 2_000, false);
  if (!id || id !== routeSessionId || !title || !startedAt || !closedAt || !committeeId || !slug || !name || !abbreviation || !topic) return null;
  if (Date.parse(closedAt) < Date.parse(startedAt) || Date.parse(closedAt) > Date.now() + 5 * 60_000) return null;
  if (!Array.isArray(candidate.participants) || candidate.participants.length === 0 || candidate.participants.length > 250) return null;
  const participants = candidate.participants.map(entry);
  if (participants.some((participant) => participant === null)) return null;
  const normalizedParticipants = participants as AttendanceSubmissionEntry[];
  const ids = new Set(normalizedParticipants.map((participant) => participant.participantId));
  if (ids.size !== normalizedParticipants.length) return null;
  return {
    session: { id, title, startedAt, closedAt },
    committee: { id: committeeId, slug, name, abbreviation },
    topic,
    participants: normalizedParticipants.sort((left, right) => left.participantId.localeCompare(right.participantId)),
  };
}
