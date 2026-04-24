import { describe, expect, it, vi } from "vitest";
import { makeNpcCombatants, sortCombatantsForTurnOrder } from "./encounters";
import type { EncounterCombatant } from "./types";

describe("initiative rolling", () => {
  it("rolls initiative per creature", () => {
    const rolls = [0, 0.5, 0.95];
    const roller = vi.fn(() => rolls.shift() ?? 0);

    const combatants = makeNpcCombatants(
      {
        name: "Goblin",
        kind: "monster",
        count: 3,
        initiativeModifier: 2,
        rollMode: "per-creature"
      },
      roller
    );

    expect(combatants.map((combatant) => combatant.initiative)).toEqual([3, 13, 22]);
    expect(new Set(combatants.map((combatant) => combatant.initiative)).size).toBe(3);
    expect(roller).toHaveBeenCalledTimes(3);
  });

  it("assigns one initiative roll to grouped monsters", () => {
    const roller = vi.fn(() => 0.4);

    const combatants = makeNpcCombatants(
      {
        name: "Skeleton",
        kind: "monster",
        count: 4,
        initiativeModifier: 1,
        rollMode: "grouped"
      },
      roller
    );

    expect(combatants.map((combatant) => combatant.initiative)).toEqual([10, 10, 10, 10]);
    expect(combatants.every((combatant) => combatant.groupKey === "monster:skeleton")).toBe(true);
    expect(roller).toHaveBeenCalledTimes(1);
  });

  it("keeps stable order when initiative ties", () => {
    const combatants = [
      combatant("fighter", 12),
      combatant("goblin", 18),
      combatant("cleric", 12)
    ];

    expect(sortCombatantsForTurnOrder(combatants).map((item) => item.id)).toEqual(["goblin", "fighter", "cleric"]);
  });
});

function combatant(id: string, initiative: number): EncounterCombatant {
  return {
    id,
    name: id,
    kind: "monster",
    initiativeModifier: 0,
    initiative,
    hp: 0,
    maxHp: 0,
    conditions: []
  };
}
