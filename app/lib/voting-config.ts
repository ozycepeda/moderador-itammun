export const votingConfig = {
  mode: "nominal" as const,
  allowAbstentions: true,
  presentAndVotingCanAbstain: false,
  observersCanVote: false,
  projectorShowsCurrentVoter: true,
  appealRule: "simple-present-and-voting" as const,
};

// Para cambiar a conteo agregado en un sprint futuro, se conserva VoteState
// como contrato de dominio y se reemplaza únicamente la captura en el módulo
// de Votación. Los reportes pueden seguir derivándose de ballots.
