"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createInitialState, type SessionState } from "../lib/session-state";
import { setupStorageKey, type StoredSetup } from "../lib/setup-state";

export function sessionStorageKey(sessionKey: string) {
  return `itammun:session:${sessionKey}`;
}

function normalizeSessionState(value: unknown, fallback: SessionState): SessionState {
  if (!value || typeof value !== "object") return fallback;
  const stored = value as Partial<SessionState>;
  return {
    ...fallback,
    ...stored,
    participants: stored.participants ?? fallback.participants,
    attendance: stored.attendance ?? fallback.attendance,
    speakers: stored.speakers ?? fallback.speakers,
    appeals: stored.appeals ?? fallback.appeals,
    events: stored.events ?? fallback.events,
    vote: { ...fallback.vote, ...stored.vote },
  };
}

export function useLocalCommitteeState(sessionKey: string, initialState: SessionState) {
  const [state, setState] = useState(initialState);
  const hydrated = useRef(false);
  const initialStateRef = useRef(initialState);

  useEffect(() => {
    async function hydrate() {
      const storedSession = window.localStorage.getItem(sessionStorageKey(sessionKey));
      if (storedSession) {
        try { setState(normalizeSessionState(JSON.parse(storedSession), initialStateRef.current)); } catch { /* ignore invalid local data */ }
      } else {
        const rawSetup = window.localStorage.getItem(setupStorageKey(sessionKey));
        if (rawSetup) {
          try {
            const setup = JSON.parse(rawSetup) as StoredSetup;
            setState({ ...createInitialState(setup.participants), topic: setup.topic });
          } catch { /* keep the empty initial state */ }
        }
      }
      hydrated.current = true;
    }
    void hydrate();

    const channel = new BroadcastChannel(`itammun:${sessionKey}`);
    channel.onmessage = (event) => setState(normalizeSessionState(event.data, initialStateRef.current));
    return () => channel.close();
  }, [sessionKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(sessionStorageKey(sessionKey), JSON.stringify(state));
    const channel = new BroadcastChannel(`itammun:${sessionKey}`);
    channel.postMessage(state);
    channel.close();
  }, [sessionKey, state]);

  const update = useCallback((recipe: (current: SessionState) => SessionState) => {
    setState((current) => recipe(current));
  }, []);

  return { state, update };
}
