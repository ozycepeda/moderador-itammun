import type { AttendanceClosePayload } from "./attendance-contract";
import {
  committeeDisplayAbbreviation,
  committeeDisplayName,
  type Committee,
} from "./committees";
import { representationPrimaryName, representationSecondaryName } from "./itammun-api";
import { getDisciplinaryCounts, type SessionState } from "./session-state";

export function buildAttendanceClosePayload({
  committee,
  state,
  closedAt = new Date().toISOString(),
}: {
  committee: Committee;
  state: SessionState;
  closedAt?: string;
}): AttendanceClosePayload {
  const customCommittee = committee.slug.startsWith("lienzo-");
  return {
    session: { ...state.session, closedAt },
    committee: {
      id: committee.id,
      slug: committee.slug,
      name: customCommittee
        ? { es: committee.name, en: committee.name }
        : { es: committeeDisplayName(committee, "es"), en: committeeDisplayName(committee, "en") },
      abbreviation: customCommittee
        ? { es: committee.abbreviation, en: committee.abbreviation }
        : { es: committeeDisplayAbbreviation(committee, "es"), en: committeeDisplayAbbreviation(committee, "en") },
    },
    topic: state.topicByLanguage ?? { es: state.topic, en: state.topic },
    participants: state.participants.map((participant) => {
      const discipline = getDisciplinaryCounts(state.warnings[participant.id] ?? 0);
      return {
        participantId: participant.id,
        primaryName: {
          es: representationPrimaryName(participant, "es"),
          en: representationPrimaryName(participant, "en"),
        },
        secondaryName: {
          es: representationSecondaryName(participant, "es"),
          en: representationSecondaryName(participant, "en"),
        },
        countryCode: participant.countryCode ?? "",
        representationKind: participant.kind ?? (participant.observer ? "observer" : "delegation"),
        attendanceStatus: state.attendance[participant.id] ?? "pending",
        observer: participant.observer || state.attendance[participant.id] === "observer",
        warningsTotal: discipline.totalWarnings,
        warningsActive: discipline.activeWarnings,
        faults: discipline.faults,
      };
    }),
  };
}
