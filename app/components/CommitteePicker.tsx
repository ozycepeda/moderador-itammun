"use client";

import { useState } from "react";
import type { Committee } from "../lib/committees";

export function CommitteePicker({ committees }: { committees: Committee[] }) {
  const [customName, setCustomName] = useState("");

  function openBlankCanvas() {
    const name = customName.trim() || "Comité sin nombre";
    const key = `lienzo-${crypto.randomUUID()}`;
    window.location.assign(`/comite/${key}?nombre=${encodeURIComponent(name)}`);
  }

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <div className="brand-lockup">
          <span className="brand-mark">I</span>
          <div><strong>ITAMMUN</strong><span>Moderador</span></div>
        </div>
        <span className="open-access">Acceso abierto</span>
      </header>

      <section className="landing-intro">
        <p className="eyebrow">ITAM Model United Nations</p>
        <h1>¿Qué comité vas a moderar?</h1>
        <p>Selecciona un comité de ITAMMUN 2026 o empieza con un lienzo en blanco. No necesitas iniciar sesión.</p>
      </section>

      <section className="committee-grid" aria-label="Comités disponibles">
        {committees.map((committee, index) => (
          <a
            className="committee-card"
            href={`/comite/${committee.slug}`}
            key={committee.id}
            style={{ "--committee-color": committee.color, "--committee-dark": committee.darkColor } as React.CSSProperties}
          >
            <span className="committee-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="committee-secretariat">{committee.secretariat}</span>
            <h2>{committee.abbreviation}</h2>
            <p>{committee.name}</p>
            <div className="committee-meta">
              <span>{committee.language}</span><span>{committee.level}</span><span>{committee.representationsCount} lugares</span>
            </div>
            <span className="card-action">Abrir consola <span aria-hidden>↗</span></span>
          </a>
        ))}

        <article className="committee-card blank-card">
          <span className="committee-number">+</span>
          <span className="committee-secretariat">Lienzo en blanco</span>
          <h2>Otro comité</h2>
          <label htmlFor="custom-name">Nombre del comité</label>
          <input id="custom-name" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Ej. Asamblea General" />
          <button onClick={openBlankCanvas}>Crear y abrir consola <span aria-hidden>↗</span></button>
        </article>
      </section>

      <footer className="landing-footer">
        <span>Los enlaces de comité pueden compartirse con varias personas.</span>
        <span>Datos de ITAMMUN 2026</span>
      </footer>
    </main>
  );
}
