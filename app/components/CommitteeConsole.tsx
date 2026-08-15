"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Committee } from "../lib/committees";
import type { CommitteeDetail } from "../lib/itammun-api";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import { createInitialState, type AttendanceStatus, type ConsoleTab, type VoteChoice } from "../lib/session-state";
import { formatTime, TimeInput } from "./TimeInput";
import { SpeakerQueue } from "./SpeakerQueue";

const tabs: Array<{ id: ConsoleTab; label: string }> = [
  { id: "rollcall", label: "Pase de lista" },
  { id: "speakers", label: "Oradores" },
  { id: "caucus", label: "Caucus y extensiones" },
  { id: "motions", label: "Mociones" },
  { id: "voting", label: "Votación nominal" },
  { id: "log", label: "Bitácora" },
];

const attendanceOptions: Array<{ value: Exclude<AttendanceStatus, "pending">; label: string }> = [
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
  const { state, update } = useLocalCommitteeState(sessionKey, createInitialState(detail.representations));
  const [activeTab, setActiveTab] = useState<ConsoleTab>("rollcall");
  const [speakerParticipantId, setSpeakerParticipantId] = useState("");
  const [topicDraft, setTopicDraft] = useState("");
  const [customTopicMode, setCustomTopicMode] = useState(false);
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
    const timer = window.setInterval(() => setRemaining((value) => {
      if (value <= 1) setRunning(false);
      return Math.max(0, value - 1);
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running, remaining]);

  useEffect(() => {
    if (!caucusRunning || caucusRemaining <= 0) return;
    const timer = window.setInterval(() => setCaucusRemaining((value) => {
      if (value <= 1) setCaucusRunning(false);
      return Math.max(0, value - 1);
    }), 1000);
    return () => window.clearInterval(timer);
  }, [caucusRunning, caucusRemaining]);

  const attendance = useMemo(() => {
    const values = Object.values(state.attendance);
    const inRoom = values.filter((value) => value === "present" || value === "present-voting" || value === "observer").length;
    const membersPresent = values.filter((value) => value === "present" || value === "present-voting").length;
    const voting = values.filter((value) => value === "present-voting").length;
    const assigned = new Set(state.assignedParticipantIds);
    const memberCount = state.participants.filter((participant) => !participant.observer && (
      assigned.has(participant.id) || (state.attendance[participant.id] !== "pending" && state.attendance[participant.id] !== "observer")
    )).length;
    return { inRoom, voting, quorum: membersPresent > 0 && membersPresent >= Math.floor(memberCount / 2) + 1 };
  }, [state.assignedParticipantIds, state.attendance, state.participants]);

  const orderedParticipants = useMemo(() => {
    const assigned = new Set(state.assignedParticipantIds);
    return [...state.participants].sort((left, right) => {
      const assignmentDifference = Number(assigned.has(right.id)) - Number(assigned.has(left.id));
      return assignmentDifference || left.name.localeCompare(right.name, "es");
    });
  }, [state.assignedParticipantIds, state.participants]);

  const eligibleVoters = useMemo(() => state.participants.filter((participant) => state.attendance[participant.id] === "present-voting"), [state.attendance, state.participants]);
  const topicLocked = state.speakers.length > 0;
  const knownTopic = detail.topics.includes(state.topic);
  const topicSelectValue = customTopicMode || (state.topic && !knownTopic) ? "__custom" : state.topic;
  const currentVoterId = state.vote.status === "active" ? state.vote.queue[state.vote.currentIndex] : undefined;
  const currentVoter = state.participants.find((participant) => participant.id === currentVoterId);
  const voteCounts = Object.values(state.vote.ballots).reduce((counts, choice) => ({ ...counts, [choice]: counts[choice] + 1 }), { for: 0, against: 0 });

  function updateTopic(topic: string) {
    update((current) => ({
      ...current,
      topic,
      events: topic && topic !== current.topic ? [`Tópico definido · ${topic}`, ...current.events] : current.events,
    }));
  }

  function addSpeaker() {
    const participant = state.participants.find((item) => item.id === speakerParticipantId);
    if (!participant || !state.topic) return;
    update((current) => ({
      ...current,
      speakers: [...current.speakers, { id: crypto.randomUUID(), name: participant.name }],
      events: [`${participant.name} se agregó a la lista`, ...current.events],
    }));
    setSpeakerParticipantId("");
  }

  function nextSpeaker() {
    update((current) => {
      const [next, ...rest] = current.speakers;
      if (!next) return current;
      return { ...current, currentSpeaker: next.name, speakers: rest, events: [`${next.name} tomó la palabra · ${formatTime(current.speakerTime)}`, ...current.events] };
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
          <a className="secondary-button" href={`/comite/${sessionKey}/setup?nombre=${encodeURIComponent(committee.name)}`}>Nueva sesión</a>
          <a className="secondary-button" href={`/comite/${sessionKey}/pantalla?nombre=${encodeURIComponent(committee.name)}`} target="_blank" rel="noreferrer">Pantalla</a>
          <button className="secondary-button" onClick={share}>{copied ? "Enlace copiado" : "Compartir"}</button>
        </div>
      </header>

      <section className={`session-topic-strip ${state.topic ? "topic-ready" : ""}`}>
        <span className="section-kicker">Tópico</span>
        <strong>{state.topic || "Pendiente · defínelo en Pase de lista"}</strong>
      </section>

      <nav className="console-tabs" aria-label="Módulos del comité">
        {tabs.map((tab) => {
          const disabled = tab.id !== "rollcall" && !state.topic;
          return <button key={tab.id} disabled={disabled} title={disabled ? "Define un tópico en Pase de lista" : undefined} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>;
        })}
      </nav>

      <div className="console-workspace">
        {activeTab === "rollcall" && (
          <section className="module-panel rollcall-module">
            <div className="module-title-row"><div><span className="section-kicker">Siempre editable</span><h2>Pase de lista</h2></div><div className={`quorum-pill ${attendance.quorum ? "has-quorum" : ""}`}>{attendance.inRoom}/{state.participants.length} en sala · {attendance.quorum ? "Hay quórum" : "Sin quórum"}</div></div>
            <div className="attendance-summary"><span>En sala <strong>{attendance.inRoom}</strong></span><span>Presente y votando <strong>{attendance.voting}</strong></span><span>Mayoría simple <strong>{Math.floor(attendance.voting / 2) + 1}</strong></span><span>Calificada <strong>{Math.ceil(attendance.voting * 2 / 3)}</strong></span></div>

            <section className={`topic-editor ${topicLocked ? "is-locked" : ""}`}>
              <div><span className="section-kicker">Tópico de la sesión</span><h3>{state.topic || "Selecciona o crea el tópico"}</h3>{topicLocked && <p>Vacía la cola de oradores para cambiar el tópico.</p>}</div>
              <div className="topic-editor-controls">
                {detail.topics.length > 0 && <select aria-label="Tópico de la sesión" disabled={topicLocked} value={topicSelectValue} onChange={(event) => {
                  if (event.target.value === "__custom") {
                    setTopicDraft(state.topic && !knownTopic ? state.topic : "");
                    setCustomTopicMode(true);
                    return;
                  }
                  setCustomTopicMode(false);
                  setTopicDraft("");
                  updateTopic(event.target.value);
                }}><option value="">Seleccionar tópico…</option>{detail.topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}<option value="__custom">Escribir otro tópico</option></select>}
                {(detail.topics.length === 0 || customTopicMode || (state.topic && !knownTopic)) && <form onSubmit={(event) => {
                  event.preventDefault();
                  const topic = topicDraft.trim();
                  if (!topic || topicLocked) return;
                  updateTopic(topic);
                  setTopicDraft(topic);
                  setCustomTopicMode(false);
                }}><input disabled={topicLocked} value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} placeholder="Escribe el tópico" aria-label="Nuevo tópico" /><button type="submit" disabled={topicLocked || !topicDraft.trim()}>Definir tópico</button></form>}
              </div>
            </section>

            <div className="attendance-list">{orderedParticipants.map((representation) => {
              const value = state.attendance[representation.id] || "pending";
              const initiallyAssigned = state.assignedParticipantIds.includes(representation.id);
              return <article className="attendance-row" key={representation.id}>
                <div className="attendance-person">{representation.flagUrl && <Image src={representation.flagUrl} alt="" width={32} height={22} unoptimized />}<span>{representation.name}</span><em>{initiallyAssigned ? "Cupo inicial" : "Disponible"}</em></div>
                <div className="attendance-buttons" role="group" aria-label={`Asistencia de ${representation.name}`}>{attendanceOptions.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} className={`attendance-button status-${option.value}`} onClick={() => update((current) => ({ ...current, attendance: { ...current.attendance, [representation.id]: option.value } }))}>{option.label}</button>)}<button type="button" className="attendance-clear" disabled={value === "pending"} onClick={() => update((current) => ({ ...current, attendance: { ...current.attendance, [representation.id]: "pending" } }))}>Limpiar</button></div>
              </article>;
            })}{state.participants.length === 0 && <p className="empty-state">Regresa a Nueva sesión para agregar participantes.</p>}</div>
          </section>
        )}

        {activeTab === "speakers" && (
          <section className="speakers-layout">
            <div className="speaker-stage">
              <div className="stage-label">Orador actual</div><h2>{state.currentSpeaker || "Sin orador"}</h2><div className="timer-display">{formatTime(remaining)}</div>
              <TimeInput label="Tiempo asignado" seconds={state.speakerTime} onChange={(seconds) => { setRemaining(seconds); update((current) => ({ ...current, speakerTime: seconds })); }} compact />
              <div className="primary-controls"><button onClick={() => { setRemaining(state.speakerTime); setRunning(false); }}>Reiniciar</button><button className="primary-button" onClick={() => setRunning((value) => !value)}>{running ? "Pausar" : "Iniciar"}</button><button onClick={nextSpeaker}>Siguiente orador</button></div>
            </div>
            <div className="queue-panel">
              <div className="panel-heading"><div><span className="section-kicker">Lista general</span><h2>Próximos oradores</h2></div><span>{state.speakers.length}</span></div>
              <form className="speaker-form" onSubmit={(event) => { event.preventDefault(); addSpeaker(); }}><select aria-label="Seleccionar próximo orador" value={speakerParticipantId} onChange={(event) => setSpeakerParticipantId(event.target.value)}><option value="">Seleccionar país o representación…</option>{state.participants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="primary-button" disabled={!speakerParticipantId}>Agregar</button></form>
              <SpeakerQueue items={state.speakers} onChange={(speakers, event) => update((current) => ({ ...current, speakers, events: [event, ...current.events] }))} />
            </div>
          </section>
        )}

        {activeTab === "caucus" && (
          <section className="caucus-focus">
            <span className="section-kicker">Caucus · tópico</span><h2>{state.topic}</h2>
            <div className="timer-display">{formatTime(caucusRemaining)}</div>
            <TimeInput label="Duración total" seconds={state.caucusDuration} onChange={(seconds) => { setCaucusRemaining(seconds); update((current) => ({ ...current, caucusDuration: seconds, caucusExtension: Math.max(0, seconds - 1) })); }} compact />
            <div className="caucus-main-controls"><button onClick={() => { setCaucusRemaining(state.caucusDuration); setCaucusRunning(false); }}>Reiniciar</button><button className="caucus-primary" onClick={() => setCaucusRunning((value) => !value)}>{caucusRunning ? "Pausar" : "Iniciar caucus"}</button><button className="caucus-extension-button" onClick={() => { const extension = Math.max(0, state.caucusDuration - 1); setCaucusRemaining(extension); setCaucusRunning(false); update((current) => ({ ...current, caucusExtension: extension, events: [`Extensión de caucus · ${formatTime(extension)}`, ...current.events] })); }}>Aplicar extensión −1s</button><button onClick={() => { setCaucusRemaining(0); setCaucusRunning(false); }}>Finalizar</button></div>
          </section>
        )}

        {activeTab === "motions" && (
          <section className="module-panel motions-module">
            <div className="module-title-row"><div><span className="section-kicker">Votación inmediata</span><h2>Apelaciones a la Mesa</h2></div><span className="rule-tag">Sólo presente y votando</span></div>
            <p className="module-note">Registra la decisión procesal y abre una votación nominal inmediata entre los países marcados como Presente y votando.</p>
            <form className="appeal-form" onSubmit={(event) => { event.preventDefault(); addAppeal(); }}>
              <label>País o persona que apela<input list="appeal-participants" value={appealAppellant} onChange={(event) => setAppealAppellant(event.target.value)} placeholder="Selecciona o escribe un nombre" /></label>
              <datalist id="appeal-participants">{state.participants.map((item) => <option key={item.id} value={item.name} />)}</datalist>
              <label>Decisión procesal apelada<textarea value={appealRuling} onChange={(event) => setAppealRuling(event.target.value)} placeholder="Describe brevemente la decisión de la Mesa" /></label>
              <button className="primary-button">Registrar apelación</button>
            </form>
            <div className="appeal-list">{state.appeals.length === 0 && <p className="empty-state">No hay apelaciones registradas.</p>}{state.appeals.map((appeal) => <article key={appeal.id}><div><span>{appeal.appellant}</span><strong>{appeal.ruling}</strong></div>{appeal.status === "pending" ? <button disabled={eligibleVoters.length === 0} title={eligibleVoters.length === 0 ? "Marca al menos un país como Presente y votando" : undefined} onClick={() => startVote(`¿Se revoca la decisión de la Mesa? · ${appeal.ruling}`, "appeal", appeal.id)}>Abrir votación de {eligibleVoters.length}</button> : <span className={`appeal-status ${appeal.status}`}>{appeal.status === "upheld" ? "Decisión mantenida" : "Decisión revocada"}</span>}</article>)}</div>
          </section>
        )}

        {activeTab === "voting" && (
          <section className="module-panel voting-module">
            <div className="module-title-row"><div><span className="section-kicker">Sólo presente y votando</span><h2>Votación nominal</h2></div><a className="projector-link" href={`/comite/${sessionKey}/pantalla?nombre=${encodeURIComponent(committee.name)}`} target="_blank" rel="noreferrer">Abrir pantalla pública ↗</a></div>
            {state.vote.status === "idle" && <div className="vote-start"><p>{eligibleVoters.length} países habilitados. La fila se congela al iniciar la votación.</p><label>Cuestión a votar<input value={voteDraft} onChange={(event) => setVoteDraft(event.target.value)} placeholder="Ej. Aprobación del proyecto A/1" /></label><button className="primary-button" disabled={!voteDraft.trim() || eligibleVoters.length === 0} onClick={() => startVote(voteDraft)}>Iniciar votación de {eligibleVoters.length}</button>{eligibleVoters.length === 0 && <button className="inline-link" onClick={() => setActiveTab("rollcall")}>Ir a Pase de lista</button>}</div>}
            {state.vote.status === "active" && currentVoter && <div className="nominal-vote"><div className="vote-progress">Voto {state.vote.currentIndex + 1} de {state.vote.queue.length}</div>{currentVoter.flagUrl && <Image src={currentVoter.flagUrl} alt="" width={96} height={64} unoptimized />}<span>Emite su voto</span><h2>{currentVoter.name}</h2><p>{state.vote.label}</p><div className="vote-actions"><button onClick={() => castVote("for")}>A favor</button><button onClick={() => castVote("against")}>En contra</button></div></div>}
            {state.vote.status === "complete" && <div className="vote-result"><span className="section-kicker">Votación concluida</span><h2>{state.vote.label}</h2><div className="vote-counts vote-counts-two"><div><strong>{voteCounts.for}</strong><span>A favor</span></div><div><strong>{voteCounts.against}</strong><span>En contra</span></div></div><button onClick={() => update((current) => ({ ...current, vote: { label: "", context: "substantive", queue: [], currentIndex: 0, ballots: {}, status: "idle" } }))}>Preparar otra votación</button></div>}
          </section>
        )}

        {activeTab === "log" && <section className="module-panel"><div className="module-title-row"><div><span className="section-kicker">Registro local</span><h2>Bitácora</h2></div></div><ul className="event-log">{state.events.length === 0 ? <li className="empty-state">Todavía no hay eventos.</li> : state.events.map((event, index) => <li key={`${event}-${index}`}><time>{String(index + 1).padStart(2, "0")}</time><span>{event}</span></li>)}</ul></section>}
      </div>
    </main>
  );
}
