import { describe, expect, it } from "vitest";
import { createEmptyEncounter } from "./encounters";
import { loadState, saveState, STORAGE_KEY } from "./storage";
import type { AppState } from "./types";

describe("storage", () => {
  it("saves and reloads the party and active encounter", () => {
    const storage = new MemoryStorage();
    const encounter = createEmptyEncounter("Bridge Ambush");
    const state: AppState = {
      party: [
        {
          id: "player-1",
          name: "Mira",
          initiativeModifier: 3
        }
      ],
      encounter: {
        ...encounter,
        status: "active",
        combatants: [
          {
            id: "player-1",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 17,
            conditions: []
          }
        ]
      }
    };

    saveState(state, storage);

    expect(loadState(storage)).toMatchObject({
      party: [{ id: "player-1", name: "Mira", initiativeModifier: 3 }],
      encounter: { name: "Bridge Ambush", status: "active" }
    });
  });

  it("keeps the saved party when an encounter is complete", () => {
    const storage = new MemoryStorage();
    const state: AppState = {
      party: [{ id: "player-2", name: "Orrin", initiativeModifier: -1 }],
      encounter: {
        ...createEmptyEncounter("Done"),
        status: "complete"
      }
    };

    saveState(state, storage);

    expect(loadState(storage).party).toEqual([{ id: "player-2", name: "Orrin", initiativeModifier: -1 }]);
  });

  it("falls back to defaults when stored data is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{bad json");

    const state = loadState(storage);

    expect(state.party).toEqual([]);
    expect(state.encounter.name).toBe("New Encounter");
  });
});

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}
