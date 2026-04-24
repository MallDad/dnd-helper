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
    const parsedEncounter = parsed.encounter
      ? {
          ...fallback.encounter,
          ...parsed.encounter,
          combatants: Array.isArray(parsed.encounter.combatants)
            ? parsed.encounter.combatants.map((combatant) => {
                const legacyCombatant = combatant as { hp?: unknown; currentHp?: unknown; active?: unknown };

                return {
                ...combatant,
                active: typeof legacyCombatant.active === "boolean" ? legacyCombatant.active : true,
                hp:
                  typeof legacyCombatant.hp === "number"
                    ? legacyCombatant.hp
                    : typeof legacyCombatant.currentHp === "number"
                      ? legacyCombatant.currentHp
                      : 0
                };
              })
            : fallback.encounter.combatants
        }
      : fallback.encounter;

    return {
      party: Array.isArray(parsed.party) ? parsed.party : fallback.party,
      encounter: parsedEncounter
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState, storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
