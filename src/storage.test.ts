import { describe, expect, it } from "vitest";
import { createEmptyEncounter } from "./encounters";
import { loadState, saveState, STORAGE_KEY } from "./storage";
import type { AppState } from "./types";

describe("storage", () => {
  it("saves and reloads the encounter", () => {
    const storage = new MemoryStorage();
    const encounter = createEmptyEncounter("Bridge Ambush");
    const state: AppState = {
      encounter: {
        ...encounter,
        combatants: [
          {
            id: "player-1",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 17,
            hp: 12,
            maxHp: 20,
            conditions: []
          }
        ]
      }
    };

    saveState(state, storage);

    expect(loadState(storage)).toMatchObject({
      encounter: { name: "Bridge Ambush" }
    });
  });

  it("keeps encounter combatants across saves", () => {
    const storage = new MemoryStorage();
    const state: AppState = {
      encounter: {
        ...createEmptyEncounter("Done"),
        combatants: [
          {
            id: "player-2",
            name: "Orrin",
            kind: "player",
            initiativeModifier: -1,
            initiative: null,
            hp: 9,
            maxHp: 16,
            conditions: []
          }
        ]
      }
    };

    saveState(state, storage);

    expect(loadState(storage).encounter.combatants.map((combatant) => combatant.name)).toEqual(["Orrin"]);
  });

  it("falls back to defaults when stored data is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{bad json");

    const state = loadState(storage);

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
