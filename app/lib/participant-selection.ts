import type { Representation } from "./itammun-api";

export function selectedParticipants(
  participants: Representation[],
  selectedParticipantIds: string[],
) {
  const selected = new Set(selectedParticipantIds);
  return participants.filter((participant) => selected.has(participant.id));
}
