"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Committee } from "../lib/committees";
import type { CommitteeDetail } from "../lib/itammun-api";
import { useLocalCommitteeState } from "../hooks/useLocalCommitteeState";
import { createInitialState, type AttendanceStatus, type ConsoleTab } from "../lib/session-state";
import { formatTime, TimeInput } from "./TimeInput";

const tabs: Array<{ id: ConsoleTab; label: string }> = [
  { id: "speakers", label: "Oradores" },
  { id: "rollcall", label: "Pase de lista" },
  { id: "caucus", label: "Caucus y extensiones" },
  { id: "motions", label: "Mociones" },
  { id: "voting", label: "Votación" },
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
    const present = values.filter((value) => value === "present" || value === "present-voting" || value === "observer").length;
    const voting = values.filter((value) => value === "present" || value === "present-voting").length;
    return { present, voting, quorum: voting > 0 && voting >= Math.floor(state.participants.filter((item) => !item.observer).length / 2) + 1 };
  }, [state.attendance, state.participants]);

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
      return {
        ...current,
        currentSpeaker: next,
        speakers: rest,
        events: [`${next} tomó la palabra · ${formatTime(current.speakerTime)}`, ...current.events],
      };
    });
    setRemaining(state.speakerTime);
    setRunning(false);
  }

  async function share() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;

  return (
    <main className="console-shell" style={cssVars}>
      <header className="console-header">
        <Link href="/" className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></Link>
        <div className="committee-heading">
          <span>{committee.secretariat}</span>
          <h1>{committee.abbreviation}</h1>
        </div>
        <div className="sharing-tools">
          <span className="sync-state sync-local">Guardado local</span>
          <a className="secondary-button" href={`/comite/${sessionKey}/setup`}>Editar setup</a>
          <button className="secondary-button" onClick={share}>{copied ? "Enlace copiado" : "Compartir enlace"}</button>
        </div>
      </header>

      <section className={`topic-strip ${state.topic ? "topic-ready" : ""}`}>
        <div>
          <span className="section-kicker">Tópico de la sesión</span>
          <strong>{state.topic || "Selecciona el tópico antes del pase de lista"}</strong>
        </div>
        {detail.topics.length > 0 ? (
          <select value={state.topic} onChange={(event) => update((current) => ({ ...current, topic: event.target.value }))}>
            <option value="">Seleccionar tópico…</option>
            {detail.topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
          </select>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); if (customTopic.trim()) update((current) => ({ ...current, topic: customTopic.trim() })); }}>
            <input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Escribe el tópico" />
            <button>Definir tópico</button>
          </form>
        )}
      </section>

      <nav className="console-tabs" aria-label="Módulos del comité">
        {tabs.map((tab) => {
          const disabled = tab.id === "rollcall" && !state.topic;
          return <button key={tab.id} disabled={disabled} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>;
        })}
      </nav>

      <div className="console-workspace">
        {activeTab === "speakers" && (
          <section className="speakers-layout">
            <div className="speaker-stage">
              <div className="stage-label">Orador actual</div>
              <h2>{state.currentSpeaker || "Sin orador"}</h2>
              <div className="timer-display">{formatTime(remaining)}</div>
              <TimeInput label="Tiempo asignado" seconds={state.speakerTime} onChange={(seconds) => { setRemaining(seconds); update((current) => ({ ...current, speakerTime: seconds })); }} compact />
              <div className="primary-controls">
                <button onClick={() => { setRemaining(state.speakerTime); setRunning(false); }}>Reiniciar</button>
                <button className="primary-button" onClick={() => setRunning((value) => !value)}>{running ? "Pausar" : "Iniciar"}</button>
                <button onClick={nextSpeaker}>Siguiente orador</button>
              </div>
            </div>
            <div className="queue-panel">
              <div className="panel-heading"><div><span className="section-kicker">Lista general</span><h2>Próximos oradores</h2></div><span>{state.speakers.length}</span></div>
              <form className="speaker-form" onSubmit={(event) => { event.preventDefault(); addSpeaker(); }}>
                <input list="representation-list" value={speakerDraft} onChange={(event) => setSpeakerDraft(event.target.value)} placeholder="País, representación o nombre libre" />
                <datalist id="representation-list">{state.participants.map((item) => <option key={item.id} value={item.name} />)}</datalist>
                <button className="primary-button">Agregar</button>
              </form>
              <ol className="speaker-queue">
                {state.speakers.length === 0 && <li className="empty-state">La lista está vacía. Agrega cualquier orador.</li>}
                {state.speakers.map((speaker, index) => (
                  <li key={`${speaker}-${index}`}><span>{index + 1}</span><strong>{speaker}</strong><button aria-label={`Quitar a ${speaker}`} onClick={() => update((current) => ({ ...current, speakers: current.speakers.filter((_, position) => position !== index) }))}>Quitar</button></li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {activeTab === "rollcall" && (
          <section className="module-panel">
            <div className="module-title-row"><div><span className="section-kicker">Sesión actual</span><h2>Pase de lista</h2></div><div className={`quorum-pill ${attendance.quorum ? "has-quorum" : ""}`}>{attendance.present}/{state.participants.length} · {attendance.quorum ? "Hay quórum" : "Sin quórum"}</div></div>
            <div className="attendance-summary"><span>Presentes <strong>{attendance.present}</strong></span><span>Con voto <strong>{attendance.voting}</strong></span><span>Mayoría simple <strong>{Math.floor(attendance.voting / 2) + 1}</strong></span><span>Calificada <strong>{Math.ceil(attendance.voting * 2 / 3)}</strong></span></div>
            <div className="attendance-list">
              {state.participants.map((representation) => {
                const value = state.attendance[representation.id] || "pending";
                return <label className="attendance-row" key={representation.id}><span>{representation.name}</span><select className={`attendance-select status-${value}`} value={value} onChange={(event) => update((current) => ({ ...current, attendance: { ...current.attendance, [representation.id]: event.target.value as AttendanceStatus } }))}>{attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
              })}
              {state.participants.length === 0 && <p className="empty-state">Este lienzo no tiene participantes. Regresa a Setup para agregar personas.</p>}
            </div>
          </section>
        )}

        {activeTab === "caucus" && (
          <section className="caucus-layout">
            <div className="caucus-clock">
              <span className="section-kicker">Caucus activo</span><h2>Tiempo general</h2>
              <div className="timer-display">{formatTime(caucusRemaining)}</div>
              <TimeInput label="Duración del caucus" seconds={state.caucusDuration} onChange={(seconds) => { setCaucusRemaining(seconds); update((current) => ({ ...current, caucusDuration: seconds, caucusExtension: Math.max(0, seconds - 1) })); }} />
              <div className="primary-controls"><button onClick={() => { setCaucusRemaining(state.caucusDuration); setCaucusRunning(false); }}>Reiniciar</button><button className="primary-button" onClick={() => setCaucusRunning((value) => !value)}>{caucusRunning ? "Pausar" : "Iniciar caucus"}</button></div>
            </div>
            <div className="extension-panel">
              <span className="section-kicker">Moción de extensión</span><h2>Extender caucus</h2>
              <p>La extensión debe durar menos que el caucus inicial. El protocolo permite usar un segundo menos.</p>
              <TimeInput label="Tiempo de extensión" seconds={state.caucusExtension} onChange={(seconds) => update((current) => ({ ...current, caucusExtension: Math.min(seconds, Math.max(0, current.caucusDuration - 1)) }))} />
              <button className="rule-button" onClick={() => update((current) => ({ ...current, caucusExtension: Math.max(0, current.caucusDuration - 1) }))}><span>Regla −1 segundo</span><strong>{formatTime(Math.max(0, state.caucusDuration - 1))}</strong></button>
              <button className="primary-button full-button" onClick={() => { setCaucusRemaining(state.caucusExtension); setCaucusRunning(false); update((current) => ({ ...current, events: [`Extensión de caucus · ${formatTime(current.caucusExtension)}`, ...current.events] })); }}>Aplicar extensión</button>
            </div>
          </section>
        )}

        {activeTab === "motions" && <PlaceholderModule kicker="Foro abierto" title="Mociones" body="Registra caucus, extensiones, sesiones extraordinarias y cambios al flujo del debate. La extensión de caucus se configura en su módulo con la regla −1 segundo." />}
        {activeTab === "voting" && <PlaceholderModule kicker="18 representaciones habilitadas" title="Votación" body="El conteo validará votos a favor, en contra y abstenciones contra la asistencia registrada." />}
        {activeTab === "log" && (
          <section className="module-panel"><div className="module-title-row"><div><span className="section-kicker">Registro compartido</span><h2>Bitácora</h2></div></div><ul className="event-log">{state.events.length === 0 ? <li className="empty-state">Todavía no hay eventos.</li> : state.events.map((event, index) => <li key={`${event}-${index}`}><time>{new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</time><span>{event}</span></li>)}</ul></section>
        )}
      </div>
    </main>
  );
}

function PlaceholderModule({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return <section className="module-panel placeholder-module"><span className="section-kicker">{kicker}</span><h2>{title}</h2><p>{body}</p><div className="placeholder-lines"><span /><span /><span /></div></section>;
}
