import { createEmptyEncounter } from "./encounters";
import type { AppState } from "./types";

export const STORAGE_KEY = "dnd-helper:v1";

export const defaultState = (): AppState => ({
  party: [],
  encounter: createEmptyEncounter()
});

export function loadState(storage: Storage = window.localStorage): AppState {
  const raw = storage.getItem(STORAGE_KEY);

  if (!raw) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const fallback = defaultState();

    return {
      party: Array.isArray(parsed.party) ? parsed.party : fallback.party,
      encounter: parsed.encounter ? { ...fallback.encounter, ...parsed.encounter } : fallback.encounter
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState, storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
