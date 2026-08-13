import type { Representation } from "./itammun-api";

export type StoredSetup = {
  topic: string;
  participants: Representation[];
  createdAt: string;
};

export function setupStorageKey(sessionKey: string) {
  return `itammun:setup:${sessionKey}`;
}
