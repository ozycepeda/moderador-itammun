"use client";

import Image from "next/image";
import type { Committee } from "../lib/committees";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import { createInitialState } from "../lib/session-state";

export function ProjectorView({ committee, sessionKey }: { committee: Committee; sessionKey: string }) {
  const { state } = useLocalCommitteeState(sessionKey, createInitialState([]));
  const voterId = state.vote.status === "active" ? state.vote.queue[state.vote.currentIndex] : undefined;
  const voter = state.participants.find((participant) => participant.id === voterId);
  const ballots = Object.values(state.vote.ballots);
  const counts = {
    for: ballots.filter((choice) => choice === "for").length,
    against: ballots.filter((choice) => choice === "against").length,
    abstain: ballots.filter((choice) => choice === "abstain").length,
  };
  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;

  return (
    <main className="projector-shell" style={cssVars}>
      <header className="projector-header">
        <span className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></span>
        <div><span>{committee.secretariat}</span><strong>{committee.abbreviation}</strong></div>
      </header>

      <section className="projector-content">
        {state.vote.status === "active" && voter ? (
          <div className="projector-vote">
            <span className="projector-kicker">Votación nominal · {state.vote.currentIndex + 1} de {state.vote.queue.length}</span>
            <p>{state.vote.label}</p>
            {voter.flagUrl && <Image src={voter.flagUrl} alt="" width={192} height={128} unoptimized priority />}
            <span className="projector-action">Emite su voto</span>
            <h1>{voter.name}</h1>
          </div>
        ) : state.vote.status === "complete" ? (
          <div className="projector-result">
            <span className="projector-kicker">Votación concluida</span>
            <h1>{state.vote.label}</h1>
            <div className="projector-counts"><div><strong>{counts.for}</strong><span>A favor</span></div><div><strong>{counts.against}</strong><span>En contra</span></div><div><strong>{counts.abstain}</strong><span>Abstenciones</span></div></div>
          </div>
        ) : (
          <div className="projector-idle">
            <span className="projector-kicker">Sesión en curso</span>
            <h1>{state.topic || "Esperando el inicio del debate"}</h1>
            {state.currentSpeaker && <p>En el podio · <strong>{state.currentSpeaker}</strong></p>}
          </div>
        )}
      </section>
    </main>
  );
}
