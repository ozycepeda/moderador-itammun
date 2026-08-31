"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeSessionState } from "../lib/session-migration";
import { createInitialState, type SessionState } from "../lib/session-state";
import { setupStorageKey, type StoredSetup } from "../lib/setup-state";

export function sessionStorageKey(sessionKey: string) {
  return `itammun:session:${sessionKey}`;
}

export function useLocalCommitteeState(sessionKey: string, initialState: SessionState) {
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  const initialStateRef = useRef(initialState);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const receivedFromChannelRef = useRef(false);

  useEffect(() => {
    const storedSession = window.localStorage.getItem(sessionStorageKey(sessionKey));
    if (storedSession) {
      try { setState(normalizeSessionState(JSON.parse(storedSession), initialStateRef.current)); } catch { /* ignore invalid local data */ }
    } else {
      const rawSetup = window.localStorage.getItem(setupStorageKey(sessionKey));
      if (rawSetup) {
        try {
          const setup = JSON.parse(rawSetup) as StoredSetup;
          const setupState = createInitialState(setup.participants);
          setState({
            ...setupState,
            session: {
              id: setup.sessionId ?? crypto.randomUUID(),
              title: setup.sessionTitle ?? "",
              startedAt: setup.createdAt || new Date().toISOString(),
            },
            topic: setup.topic ?? "",
            assignedParticipantIds: setup.assignedParticipantIds ?? setup.participants.map((participant) => participant.id),
          });
        } catch { /* keep the empty initial state */ }
      }
    }
    setHydrated(true);

    const channel = new BroadcastChannel(`itammun:${sessionKey}`);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      receivedFromChannelRef.current = true;
      setState(normalizeSessionState(event.data, initialStateRef.current));
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [sessionKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(sessionStorageKey(sessionKey), JSON.stringify(state));
    if (receivedFromChannelRef.current) {
      receivedFromChannelRef.current = false;
      return;
    }
    channelRef.current?.postMessage(state);
  }, [hydrated, sessionKey, state]);

  const update = useCallback((recipe: (current: SessionState) => SessionState) => {
    setState((current) => recipe(current));
  }, []);

  return { state, update };
}
