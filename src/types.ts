export type PlayerCharacter = {
  id: string;
  name: string;
  initiativeModifier: number;
  maxHp?: number;
  notes?: string;
};

export type CombatantKind = "player" | "npc" | "monster";

export type EncounterCombatant = {
  id: string;
  name: string;
  kind: CombatantKind;
  active?: boolean;
  initiativeModifier: number;
  initiative: number | null;
  hp: number;
  maxHp: number;
  tempHp?: number;
  groupKey?: string;
  conditions: ActiveCondition[];
  notes?: string;
};

export type ActiveCondition = {
  id: string;
  name: string;
  note?: string;
  expires?: string;
};

export type CombatAction = {
  id: string;
  round: number;
  combatantId: string;
  combatantName: string;
  text: string;
  createdAt: string;
};

export type Encounter = {
  id: string;
  name: string;
  status: "setup" | "active" | "complete";
  round: number;
  currentTurnIndex: number;
  combatants: EncounterCombatant[];
  actionLog: CombatAction[];
  createdAt: string;
  updatedAt: string;
};

export type AppState = {
  party: PlayerCharacter[];
  encounter: Encounter;
};

export type RollMode = "per-creature" | "grouped";
