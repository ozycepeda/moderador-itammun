"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Committee } from "../lib/committees";
import type { CommitteeDetail } from "../lib/itammun-api";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import { createInitialState, type AttendanceStatus, type ConsoleTab, type VoteChoice } from "../lib/session-state";
import { votingConfig } from "../lib/voting-config";
import { formatTime, TimeInput } from "./TimeInput";

const tabs: Array<{ id: ConsoleTab; label: string }> = [
  { id: "speakers", label: "Oradores" },
  { id: "rollcall", label: "Pase de lista" },
  { id: "caucus", label: "Caucus y extensiones" },
  { id: "motions", label: "Mociones" },
  { id: "voting", label: "Votación nominal" },
  { id: "log", label: "Bitácora" },
];

const attendanceOptions: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "pending", label: "Sin registrar" },
  { value: "present", label: "Presente" },
  { value: "present-voting", label: "Presente y votando" },
  { value: "absent", label: "Ausente" },
  { value: "observer", label: "Observador" },
];

export function CommitteeConsole({ committee, detail, sessionKey }: {
  committee: Committee;
  detail: CommitteeDetail;
  sessionKey: string;
}) {
  const { state, update } = useLocalCommitteeState(sessionKey, createInitialState([]));
  const [activeTab, setActiveTab] = useState<ConsoleTab>("speakers");
  const [speakerDraft, setSpeakerDraft] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(state.speakerTime);
  const [running, setRunning] = useState(false);
  const [caucusRemaining, setCaucusRemaining] = useState(state.caucusDuration);
  const [caucusRunning, setCaucusRunning] = useState(false);
  const [appealAppellant, setAppealAppellant] = useState("");
  const [appealRuling, setAppealRuling] = useState("");
  const [voteDraft, setVoteDraft] = useState("");

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running, remaining]);
  useEffect(() => {
    if (!caucusRunning || caucusRemaining <= 0) return;
    const timer = window.setInterval(() => setCaucusRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [caucusRunning, caucusRemaining]);

  const attendance = useMemo(() => {
    const values = Object.values(state.attendance);
    const inRoom = values.filter((value) => value === "present" || value === "present-voting" || value === "observer").length;
    const voting = values.filter((value) => value === "present" || value === "present-voting").length;
    const memberCount = state.participants.filter((item) => !item.observer).length;
    return { inRoom, voting, quorum: voting > 0 && voting >= Math.floor(memberCount / 2) + 1 };
  }, [state.attendance, state.participants]);

  const eligibleVoters = useMemo(() => state.participants.filter((participant) => {
    const status = state.attendance[participant.id];
    return !participant.observer && (status === "present" || status === "present-voting");
  }), [state.attendance, state.participants]);

  const currentVoterId = state.vote.status === "active" ? state.vote.queue[state.vote.currentIndex] : undefined;
  const currentVoter = state.participants.find((participant) => participant.id === currentVoterId);
  const currentVoterStatus = currentVoterId ? state.attendance[currentVoterId] : undefined;
  const voteCounts = Object.values(state.vote.ballots).reduce((counts, choice) => ({ ...counts, [choice]: counts[choice] + 1 }), { for: 0, against: 0, abstain: 0 });

  function addSpeaker() {
    const name = speakerDraft.trim();
    if (!name) return;
    update((current) => ({ ...current, speakers: [...current.speakers, name], events: [`${name} se agregó a la lista`, ...current.events] }));
    setSpeakerDraft("");
  }

  function nextSpeaker() {
    update((current) => {
      const [next, ...rest] = current.speakers;
      if (!next) return current;
      return { ...current, currentSpeaker: next, speakers: rest, events: [`${next} tomó la palabra · ${formatTime(current.speakerTime)}`, ...current.events] };
    });
    setRemaining(state.speakerTime);
    setRunning(false);
  }

  async function share() {
    const setupUrl = new URL(`/comite/${sessionKey}/setup`, window.location.origin);
    setupUrl.searchParams.set("nombre", committee.name);
    await navigator.clipboard.writeText(setupUrl.toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function addAppeal() {
    const appellant = appealAppellant.trim();
    const ruling = appealRuling.trim();
    if (!appellant || !ruling) return;
    update((current) => ({
      ...current,
      appeals: [{ id: crypto.randomUUID(), appellant, ruling, status: "pending" }, ...current.appeals],
      events: [`${appellant} apeló una decisión de la Mesa`, ...current.events],
    }));
    setAppealAppellant("");
    setAppealRuling("");
  }

  function startVote(label: string, context: "substantive" | "appeal" = "substantive", appealId?: string) {
    const queue = eligibleVoters.map((participant) => participant.id);
    if (!label.trim() || queue.length === 0) return;
    update((current) => ({
      ...current,
      vote: { label: label.trim(), context, appealId, queue, currentIndex: 0, ballots: {}, status: "active" },
      events: [`Inició votación nominal · ${label.trim()}`, ...current.events],
    }));
    setActiveTab("voting");
    setVoteDraft("");
  }

  function castVote(choice: VoteChoice) {
    if (!currentVoterId) return;
    update((current) => {
      const ballots = { ...current.vote.ballots, [currentVoterId]: choice };
      const complete = current.vote.currentIndex >= current.vote.queue.length - 1;
      let appeals = current.appeals;
      const extraEvents: string[] = [];
      if (complete && current.vote.context === "appeal" && current.vote.appealId) {
        const values = Object.values(ballots);
        const forOverturn = values.filter((value) => value === "for").length;
        const againstOverturn = values.filter((value) => value === "against").length;
        const overturned = forOverturn > againstOverturn;
        appeals = current.appeals.map((appeal) => appeal.id === current.vote.appealId ? { ...appeal, status: overturned ? "overturned" as const : "upheld" as const } : appeal);
        extraEvents.push(overturned ? "La decisión de la Mesa fue revocada por mayoría" : "La decisión de la Mesa se mantuvo");
      }
      return {
        ...current,
        appeals,
        vote: { ...current.vote, ballots, currentIndex: complete ? current.vote.currentIndex : current.vote.currentIndex + 1, status: complete ? "complete" : "active" },
        events: [...extraEvents, ...current.events],
      };
    });
  }

  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;

  return (
    <main className="console-shell" style={cssVars}>
      <header className="console-header">
        <Link href="/" className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></Link>
        <div className="committee-heading"><span>{committee.secretariat}</span><h1>{committee.abbreviation}</h1></div>
        <div className="sharing-tools">
          <span className="sync-state sync-local">Guardado local</span>
          <a className="secondary-button" href={`/comite/${sessionKey}/setup?nombre=${encodeURIComponent(committee.name)}`}>Setup</a>
          <a className="secondary-button" href={`/comite/${sessionKey}/pantalla?nombre=${encodeURIComponent(committee.name)}`} target="_blank" rel="noreferrer">Pantalla</a>
          <button className="secondary-button" onClick={share}>{copied ? "Enlace copiado" : "Compartir"}</button>
        </div>
      </header>

      <section className={`topic-strip ${state.topic ? "topic-ready" : ""}`}>
        <div><span className="section-kicker">Tópico de la sesión</span><strong>{state.topic || "Completa el setup antes del pase de lista"}</strong></div>
        {detail.topics.length > 0 ? (
          <select value={state.topic} onChange={(event) => update((current) => ({ ...current, topic: event.target.value }))}><option value="">Seleccionar tópico…</option>{detail.topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); if (customTopic.trim()) update((current) => ({ ...current, topic: customTopic.trim() })); }}><input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Escribe el tópico" /><button>Definir tópico</button></form>
        )}
      </section>

      <nav className="console-tabs" aria-label="Módulos del comité">
        {tabs.map((tab) => <button key={tab.id} disabled={tab.id === "rollcall" && !state.topic} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </nav>

      <div className="console-workspace">
        {activeTab === "speakers" && (
          <section className="speakers-layout">
            <div className="speaker-stage">
              <div className="stage-label">Orador actual</div><h2>{state.currentSpeaker || "Sin orador"}</h2><div className="timer-display">{formatTime(remaining)}</div>
              <TimeInput label="Tiempo asignado" seconds={state.speakerTime} onChange={(seconds) => { setRemaining(seconds); update((current) => ({ ...current, speakerTime: seconds })); }} compact />
              <div className="primary-controls"><button onClick={() => { setRemaining(state.speakerTime); setRunning(false); }}>Reiniciar</button><button className="primary-button" onClick={() => setRunning((value) => !value)}>{running ? "Pausar" : "Iniciar"}</button><button onClick={nextSpeaker}>Siguiente orador</button></div>
            </div>
            <div className="queue-panel">
              <div className="panel-heading"><div><span className="section-kicker">Lista general</span><h2>Próximos oradores</h2></div><span>{state.speakers.length}</span></div>
              <form className="speaker-form" onSubmit={(event) => { event.preventDefault(); addSpeaker(); }}><input list="representation-list" value={speakerDraft} onChange={(event) => setSpeakerDraft(event.target.value)} placeholder="País, representación o nombre libre" /><datalist id="representation-list">{state.participants.map((item) => <option key={item.id} value={item.name} />)}</datalist><button className="primary-button">Agregar</button></form>
              <ol className="speaker-queue">{state.speakers.length === 0 && <li className="empty-state">La lista está vacía. Agrega cualquier orador.</li>}{state.speakers.map((speaker, index) => <li key={`${speaker}-${index}`}><span>{index + 1}</span><strong>{speaker}</strong><button aria-label={`Quitar a ${speaker}`} onClick={() => update((current) => ({ ...current, speakers: current.speakers.filter((_, position) => position !== index) }))}>Quitar</button></li>)}</ol>
            </div>
          </section>
        )}

        {activeTab === "rollcall" && (
          <section className="module-panel">
            <div className="module-title-row"><div><span className="section-kicker">Sesión actual</span><h2>Pase de lista</h2></div><div className={`quorum-pill ${attendance.quorum ? "has-quorum" : ""}`}>{attendance.inRoom}/{state.participants.length} · {attendance.quorum ? "Hay quórum" : "Sin quórum"}</div></div>
            <div className="attendance-summary"><span>En sala <strong>{attendance.inRoom}</strong></span><span>Con voto <strong>{attendance.voting}</strong></span><span>Mayoría simple <strong>{Math.floor(attendance.voting / 2) + 1}</strong></span><span>Calificada <strong>{Math.ceil(attendance.voting * 2 / 3)}</strong></span></div>
            <p className="module-note">Los observadores aparecen en sala, pero no cuentan para quórum ni mayorías.</p>
            <div className="attendance-list">{state.participants.map((representation) => { const value = state.attendance[representation.id] || "pending"; return <label className="attendance-row" key={representation.id}><span>{representation.name}</span><select className={`attendance-select status-${value}`} value={value} onChange={(event) => update((current) => ({ ...current, attendance: { ...current.attendance, [representation.id]: event.target.value as AttendanceStatus } }))}>{attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; })}{state.participants.length === 0 && <p className="empty-state">Regresa a Setup para agregar participantes.</p>}</div>
          </section>
        )}

        {activeTab === "caucus" && (
          <section className="caucus-layout">
            <div className="caucus-clock">
              <span className="section-kicker">Caucus moderado</span><h2>Tiempo general</h2><div className="timer-display">{formatTime(caucusRemaining)}</div>
              <div className="caucus-time-fields"><TimeInput label="Duración total" seconds={state.caucusDuration} onChange={(seconds) => { setCaucusRemaining(seconds); update((current) => ({ ...current, caucusDuration: seconds, caucusExtension: Math.max(0, seconds - 1) })); }} /><TimeInput label="Tiempo por orador" seconds={state.caucusSpeakerTime} onChange={(seconds) => update((current) => ({ ...current, caucusSpeakerTime: seconds }))} /></div>
              <div className="primary-controls"><button onClick={() => { setCaucusRemaining(state.caucusDuration); setCaucusRunning(false); }}>Reiniciar</button><button className="primary-button" onClick={() => setCaucusRunning((value) => !value)}>{caucusRunning ? "Pausar" : "Iniciar caucus"}</button></div>
            </div>
            <div className="extension-panel">
              <span className="section-kicker">Moción de extensión</span><h2>Extender caucus</h2><p>La extensión debe durar menos que el caucus inicial. El protocolo permite usar un segundo menos.</p>
              <TimeInput label="Tiempo de extensión" seconds={state.caucusExtension} onChange={(seconds) => update((current) => ({ ...current, caucusExtension: Math.min(seconds, Math.max(0, current.caucusDuration - 1)) }))} />
              <button className="rule-button" onClick={() => update((current) => ({ ...current, caucusExtension: Math.max(0, current.caucusDuration - 1) }))}><span>Regla −1 segundo</span><strong>{formatTime(Math.max(0, state.caucusDuration - 1))}</strong></button>
              <button className="primary-button full-button" onClick={() => { setCaucusRemaining(state.caucusExtension); setCaucusRunning(false); update((current) => ({ ...current, events: [`Extensión de caucus · ${formatTime(current.caucusExtension)}`, ...current.events] })); }}>Aplicar extensión</button>
            </div>
          </section>
        )}

        {activeTab === "motions" && (
          <section className="module-panel motions-module">
            <div className="module-title-row"><div><span className="section-kicker">Regla procesal recomendada</span><h2>Apelaciones a la Mesa</h2></div><span className="rule-tag">Mayoría simple</span></div>
            <p className="module-note">Una apelación cuestiona una decisión procesal de la Mesa. Se resuelve inmediatamente, sin debate; la decisión permanece salvo que una mayoría de miembros presentes y votando decida revocarla.</p>
            <form className="appeal-form" onSubmit={(event) => { event.preventDefault(); addAppeal(); }}>
              <label>País o persona que apela<input list="appeal-participants" value={appealAppellant} onChange={(event) => setAppealAppellant(event.target.value)} placeholder="Selecciona o escribe un nombre" /></label>
              <datalist id="appeal-participants">{state.participants.map((item) => <option key={item.id} value={item.name} />)}</datalist>
              <label>Decisión procesal apelada<textarea value={appealRuling} onChange={(event) => setAppealRuling(event.target.value)} placeholder="Describe brevemente la decisión de la Mesa" /></label>
              <button className="primary-button">Registrar apelación</button>
            </form>
            <div className="appeal-list">{state.appeals.length === 0 && <p className="empty-state">No hay apelaciones registradas.</p>}{state.appeals.map((appeal) => <article key={appeal.id}><div><span>{appeal.appellant}</span><strong>{appeal.ruling}</strong></div>{appeal.status === "pending" ? <button onClick={() => startVote(`¿Se revoca la decisión de la Mesa? · ${appeal.ruling}`, "appeal", appeal.id)}>Abrir votación inmediata</button> : <span className={`appeal-status ${appeal.status}`}>{appeal.status === "upheld" ? "Decisión mantenida" : "Decisión revocada"}</span>}</article>)}</div>
          </section>
        )}

        {activeTab === "voting" && (
          <section className="module-panel voting-module">
            <div className="module-title-row"><div><span className="section-kicker">Modalidad nominal</span><h2>Votación</h2></div><a className="projector-link" href={`/comite/${sessionKey}/pantalla?nombre=${encodeURIComponent(committee.name)}`} target="_blank" rel="noreferrer">Abrir pantalla pública ↗</a></div>
            {state.vote.status === "idle" && <div className="vote-start"><p>La votación nominal llama a cada miembro con voto y muestra su nombre en la pantalla pública. Los observadores quedan excluidos.</p><label>Cuestión a votar<input value={voteDraft} onChange={(event) => setVoteDraft(event.target.value)} placeholder="Ej. Aprobación del proyecto A/1" /></label><button className="primary-button" disabled={!voteDraft.trim() || eligibleVoters.length === 0} onClick={() => startVote(voteDraft)}>Iniciar votación de {eligibleVoters.length}</button></div>}
            {state.vote.status === "active" && currentVoter && <div className="nominal-vote"><div className="vote-progress">Voto {state.vote.currentIndex + 1} de {state.vote.queue.length}</div>{currentVoter.flagUrl && <Image src={currentVoter.flagUrl} alt="" width={96} height={64} unoptimized />}<span>Emite su voto</span><h2>{currentVoter.name}</h2><p>{state.vote.label}</p><div className="vote-actions"><button onClick={() => castVote("for")}>A favor</button><button onClick={() => castVote("against")}>En contra</button>{votingConfig.allowAbstentions && <button disabled={currentVoterStatus === "present-voting" && !votingConfig.presentAndVotingCanAbstain} onClick={() => castVote("abstain")}>Abstención</button>}</div></div>}
            {state.vote.status === "complete" && <div className="vote-result"><span className="section-kicker">Votación concluida</span><h2>{state.vote.label}</h2><div className="vote-counts"><div><strong>{voteCounts.for}</strong><span>A favor</span></div><div><strong>{voteCounts.against}</strong><span>En contra</span></div><div><strong>{voteCounts.abstain}</strong><span>Abstenciones</span></div></div><button onClick={() => update((current) => ({ ...current, vote: { label: "", context: "substantive", queue: [], currentIndex: 0, ballots: {}, status: "idle" } }))}>Preparar otra votación</button></div>}
          </section>
        )}

        {activeTab === "log" && <section className="module-panel"><div className="module-title-row"><div><span className="section-kicker">Registro local</span><h2>Bitácora</h2></div></div><ul className="event-log">{state.events.length === 0 ? <li className="empty-state">Todavía no hay eventos.</li> : state.events.map((event, index) => <li key={`${event}-${index}`}><time>{String(index + 1).padStart(2, "0")}</time><span>{event}</span></li>)}</ul></section>}
      </div>
    </main>
  );
}
