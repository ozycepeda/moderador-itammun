"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionState } from "../lib/session-state";

type ConnectionStatus = "connecting" | "shared" | "local";
type ServerPayload = { state: SessionState | null; revision: number; activeClients?: number };

const apiBase = process.env.NEXT_PUBLIC_MODERATOR_API_BASE || "/api/moderator";

export function useSharedCommitteeState(sessionKey: string, initialState: SessionState) {
  const [state, setState] = useState(initialState);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [activeClients, setActiveClients] = useState<number | null>(null);
  const revision = useRef(0);
  const clientId = useRef("");
  const hydrated = useRef(false);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    clientId.current = crypto.randomUUID();
    async function load() {
      const offline = window.localStorage.getItem(`itammun:${sessionKey}`);
      if (offline) {
        try { setState(JSON.parse(offline)); } catch { /* ignore invalid draft */ }
      }
      try {
        const response = await fetch(`${apiBase}/committees/${encodeURIComponent(sessionKey)}/state?clientId=${clientId.current}`, { cache: "no-store" });
        if (!response.ok) throw new Error("shared API unavailable");
        const payload = await response.json() as ServerPayload;
        revision.current = payload.revision;
        if (payload.state) setState(payload.state);
        setActiveClients(payload.activeClients ?? null);
        setStatus("shared");
      } catch {
        setStatus("local");
      } finally {
        hydrated.current = true;
      }
    }
    void load();

    const channel = new BroadcastChannel(`itammun:${sessionKey}`);
    channel.onmessage = (event) => setState(event.data as SessionState);
    return () => channel.close();
  }, [sessionKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(`itammun:${sessionKey}`, JSON.stringify(state));
    const channel = new BroadcastChannel(`itammun:${sessionKey}`);
    channel.postMessage(state);
    channel.close();

    if (status !== "shared") return;
    if (pendingSave.current) clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(async () => {
      try {
        const response = await fetch(`${apiBase}/committees/${encodeURIComponent(sessionKey)}/state`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state, baseRevision: revision.current, clientId: clientId.current }),
        });
        const payload = await response.json() as ServerPayload;
        if (response.status === 409 && payload.state) setState(payload.state);
        revision.current = payload.revision;
        setActiveClients(payload.activeClients ?? null);
      } catch {
        setStatus("local");
        setActiveClients(null);
      }
    }, 350);
  }, [sessionKey, state, status]);

  useEffect(() => {
    if (status !== "shared") return;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/committees/${encodeURIComponent(sessionKey)}/state?clientId=${clientId.current}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as ServerPayload;
        if (payload.state && payload.revision > revision.current) {
          revision.current = payload.revision;
          setState(payload.state);
        }
        setActiveClients(payload.activeClients ?? null);
      } catch { /* retain the offline draft */ }
    }, 1500);
    return () => window.clearInterval(poll);
  }, [sessionKey, status]);

  const update = useCallback((recipe: (current: SessionState) => SessionState) => {
    setState((current) => recipe(current));
  }, []);

  return { state, update, status, activeClients };
}
