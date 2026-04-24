import { createId } from "./id";
import type { Encounter, EncounterCombatant, RollMode } from "./types";

export type NpcDraft = {
  name: string;
  kind: "npc" | "monster";
  count: number;
  initiativeModifier: number;
  rollMode: RollMode;
  notes?: string;
};

export type Roller = () => number;

export function createEmptyEncounter(name = "New Encounter"): Encounter {
  const now = new Date().toISOString();

  return {
    id: createId("encounter"),
    name,
    status: "setup",
    round: 1,
    currentTurnIndex: 0,
    combatants: [],
    actionLog: [],
    createdAt: now,
    updatedAt: now
  };
}

export function rollD20(roller: Roller = Math.random): number {
  return Math.floor(roller() * 20) + 1;
}

export function makeNpcCombatants(draft: NpcDraft, roller: Roller = Math.random): EncounterCombatant[] {
  const count = Math.max(1, Math.floor(draft.count));
  const trimmedName = draft.name.trim() || "Unnamed";
  const groupKey = `${draft.kind}:${trimmedName.toLowerCase()}`;
  const groupedRoll = draft.rollMode === "grouped" ? rollD20(roller) + draft.initiativeModifier : null;

  return Array.from({ length: count }, (_, index) => {
    const suffix = count > 1 ? ` ${index + 1}` : "";
    const initiative = groupedRoll ?? rollD20(roller) + draft.initiativeModifier;

    return {
      id: createId(draft.kind),
      name: `${trimmedName}${suffix}`,
      kind: draft.kind,
      active: true,
      initiativeModifier: draft.initiativeModifier,
      initiative,
      hp: 0,
      maxHp: 0,
      groupKey: draft.rollMode === "grouped" ? groupKey : undefined,
      conditions: [],
      notes: draft.notes?.trim() || undefined
    };
  });
}

export function sortCombatantsForTurnOrder(combatants: EncounterCombatant[]): EncounterCombatant[] {
  return combatants
    .map((combatant, index) => ({ combatant, index }))
    .sort((a, b) => {
      const aInitiative = a.combatant.initiative ?? -Infinity;
      const bInitiative = b.combatant.initiative ?? -Infinity;

      if (aInitiative !== bInitiative) {
        return bInitiative - aInitiative;
      }

      return a.index - b.index;
    })
    .map(({ combatant }) => combatant);
}

export function latestActionByCombatant(encounter: Encounter, combatantId: string) {
  for (let index = encounter.actionLog.length - 1; index >= 0; index -= 1) {
    const action = encounter.actionLog[index];

    if (action.combatantId === combatantId) {
      return action;
    }
  }

  return undefined;
}

export function latestActionByCombatantForRound(encounter: Encounter, combatantId: string, round: number) {
  for (let index = encounter.actionLog.length - 1; index >= 0; index -= 1) {
    const action = encounter.actionLog[index];

    if (action.combatantId === combatantId && action.round === round) {
      return action;
    }
  }

  return undefined;
}
