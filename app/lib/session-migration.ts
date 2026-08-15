import { isTranslationKey } from "./i18n";
import type { AttendanceStatus, SessionEvent, SessionState, SpeakerQueueItem, VoteChoice } from "./session-state";

export function normalizeSessionState(value: unknown, fallback: SessionState): SessionState {
  if (!value || typeof value !== "object") return fallback;
  const stored = value as Partial<SessionState>;
  const storedParticipants = Array.isArray(stored.participants) ? stored.participants : [];
  const participants = [
    ...fallback.participants,
    ...storedParticipants.filter((storedParticipant) => !fallback.participants.some((participant) => participant.id === storedParticipant.id)),
  ];
  const storedSpeakers = Array.isArray(stored.speakers) ? stored.speakers as unknown[] : [];
  const speakers: SpeakerQueueItem[] = storedSpeakers.flatMap((speaker) => {
    if (typeof speaker === "string") return [{ id: crypto.randomUUID(), name: speaker }];
    if (speaker && typeof speaker === "object" && "name" in speaker && typeof speaker.name === "string") {
      return [{ id: "id" in speaker && typeof speaker.id === "string" ? speaker.id : crypto.randomUUID(), name: speaker.name }];
    }
    return [];
  });
  const storedAttendance = stored.attendance ?? {};
  const attendance = Object.fromEntries(participants.map((participant) => [
    participant.id,
    storedAttendance[participant.id] ?? (participant.observer ? "observer" : "pending"),
  ])) as Record<string, AttendanceStatus>;
  const ballots = Object.fromEntries(Object.entries(stored.vote?.ballots ?? {}).filter((entry): entry is [string, VoteChoice] => entry[1] === "for" || entry[1] === "against"));
  const rawEvents = Array.isArray(stored.events) ? stored.events as unknown[] : [];
  const events = rawEvents.flatMap((event): Array<string | SessionEvent> => {
    if (typeof event === "string") return [event];
    if (!event || typeof event !== "object" || !("key" in event) || !isTranslationKey(event.key)) return [];
    const rawValues = "values" in event && event.values && typeof event.values === "object" ? event.values as Record<string, unknown> : {};
    const values = Object.fromEntries(Object.entries(rawValues).filter((entry): entry is [string, string | number] => typeof entry[1] === "string" || typeof entry[1] === "number"));
    return [{ key: event.key, ...(Object.keys(values).length > 0 ? { values } : {}) }];
  });

  return {
    ...fallback,
    ...stored,
    schemaVersion: 2,
    participants,
    assignedParticipantIds: stored.assignedParticipantIds ?? storedParticipants.map((participant) => participant.id),
    attendance,
    speakers,
    appeals: stored.appeals ?? fallback.appeals,
    events: rawEvents.length > 0 ? events : fallback.events,
    vote: { ...fallback.vote, ...stored.vote, ballots },
  };
}
