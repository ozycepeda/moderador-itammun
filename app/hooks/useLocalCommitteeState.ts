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
  const closedRef = useRef(false);

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
      if (event.data && typeof event.data === "object" && event.data.type === "itammun:session-closed") {
        closedRef.current = true;
        window.localStorage.removeItem(sessionStorageKey(sessionKey));
        window.localStorage.removeItem(setupStorageKey(sessionKey));
        window.location.replace("/");
        return;
      }
      receivedFromChannelRef.current = true;
      setState(normalizeSessionState(event.data, initialStateRef.current));
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [sessionKey]);

  useEffect(() => {
    if (!hydrated || closedRef.current) return;
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

  const closeSession = useCallback(() => {
    closedRef.current = true;
    channelRef.current?.postMessage({ type: "itammun:session-closed" });
    window.localStorage.removeItem(sessionStorageKey(sessionKey));
    window.localStorage.removeItem(setupStorageKey(sessionKey));
  }, [sessionKey]);

  return { state, update, closeSession };
}
