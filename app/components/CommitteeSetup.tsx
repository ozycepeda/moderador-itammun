"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Committee } from "../lib/committees";
import type { CommitteeDetail, Representation } from "../lib/itammun-api";
import { setupStorageKey, type StoredSetup } from "../lib/setup-state";

export function CommitteeSetup({ committee, detail, sessionKey }: {
  committee: Committee;
  detail: CommitteeDetail;
  sessionKey: string;
}) {
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [selected, setSelected] = useState(() => new Set(detail.representations.map((item) => item.id)));
  const [customParticipants, setCustomParticipants] = useState<Representation[]>([]);
  const [customName, setCustomName] = useState("");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => detail.representations.filter((item) => item.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))), [detail.representations, search]);
  const finalTopic = topic === "__custom" ? customTopic.trim() : topic;
  const participantCount = selected.size + customParticipants.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addCustomParticipant() {
    const name = customName.trim();
    if (!name) return;
    setCustomParticipants((current) => [...current, { id: `custom-${crypto.randomUUID()}`, name, observer: false }]);
    setCustomName("");
  }

  function startDebate() {
    if (!finalTopic || participantCount === 0) return;
    const participants = [
      ...detail.representations.filter((item) => selected.has(item.id)),
      ...customParticipants,
    ];
    const setup: StoredSetup = { topic: finalTopic, participants, createdAt: new Date().toISOString() };
    window.localStorage.setItem(setupStorageKey(sessionKey), JSON.stringify(setup));
    window.location.assign(`/comite/${sessionKey}`);
  }

  const cssVars = { "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties;

  return (
    <main className="setup-shell" style={cssVars}>
      <header className="console-header">
        <Link href="/" className="console-brand"><span className="brand-mark">I</span><span>ITAMMUN</span></Link>
        <div className="committee-heading"><span>{committee.secretariat}</span><h1>{committee.abbreviation}</h1></div>
        <span className="setup-step">Setup del debate</span>
      </header>

      <section className="setup-intro">
        <p className="eyebrow">Preparación local</p>
        <h2>Define el tópico y quiénes participan</h2>
        <p>Esta selección crea el debate en este dispositivo. No escribe asistencia, oradores ni votos en la base de catálogo.</p>
      </section>

      <div className="setup-grid">
        <section className="setup-panel topic-panel">
          <span className="section-kicker">01 · Tópico</span>
          <h2>Tema de la sesión</h2>
          {detail.topics.length > 0 && (
            <label>Seleccionar del catálogo
              <select value={topic} onChange={(event) => setTopic(event.target.value)}>
                <option value="">Seleccionar tópico…</option>
                {detail.topics.map((item) => <option value={item} key={item}>{item}</option>)}
                <option value="__custom">Escribir otro tópico</option>
              </select>
            </label>
          )}
          {(detail.topics.length === 0 || topic === "__custom") && (
            <label>Nombre del tópico
              <input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Escribe el tema a debatir" />
            </label>
          )}
        </section>

        <section className="setup-panel participants-panel">
          <div className="setup-panel-heading"><div><span className="section-kicker">02 · Participantes</span><h2>Países y personas</h2></div><strong>{participantCount}</strong></div>
          {detail.representations.length > 0 && (
            <>
              <div className="catalog-tools">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en el catálogo" />
                <button onClick={() => setSelected(new Set(detail.representations.map((item) => item.id)))}>Seleccionar todos</button>
                <button onClick={() => setSelected(new Set())}>Quitar todos</button>
              </div>
              <div className="setup-country-list">
                {visible.map((item) => (
                  <label key={item.id} className="setup-country-row">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                    {item.flagUrl ? <Image src={item.flagUrl} alt="" width={28} height={19} unoptimized /> : <span className="flag-placeholder" />}
                    <span>{item.name}</span>
                    {item.observer && <em>Observador</em>}
                  </label>
                ))}
              </div>
            </>
          )}

          <form className="custom-participant-form" onSubmit={(event) => { event.preventDefault(); addCustomParticipant(); }}>
            <label htmlFor="custom-participant">Agregar país o persona manualmente</label>
            <div><input id="custom-participant" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Nombre libre" /><button>Agregar</button></div>
          </form>
          {customParticipants.length > 0 && <ul className="custom-participants">{customParticipants.map((item) => <li key={item.id}><span>{item.name}</span><button onClick={() => setCustomParticipants((current) => current.filter((entry) => entry.id !== item.id))}>Quitar</button></li>)}</ul>}
        </section>
      </div>

      <footer className="setup-footer">
        <div><strong>{finalTopic || "Falta definir el tópico"}</strong><span>{participantCount} participantes seleccionados</span></div>
        <button className="primary-button" disabled={!finalTopic || participantCount === 0} onClick={startDebate}>Iniciar debate</button>
      </footer>
    </main>
  );
}
