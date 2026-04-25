import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { STORAGE_KEY } from "./storage";
import type { AppState } from "./types";

describe("App workflow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates combatants, tracks conditions, and records actions", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /new combatant/i }));
    await user.type(screen.getByLabelText(/name for combatant-/i), "Goblin 1");
    await user.tab();
    await user.tab();
    await user.clear(screen.getByLabelText("Initiative for Goblin 1"));
    await user.type(screen.getByLabelText("Initiative for Goblin 1"), "16");

    await user.click(screen.getByRole("button", { name: /new combatant/i }));
    await user.type(screen.getByLabelText(/name for combatant-/i), "Goblin 2");
    await user.tab();
    await user.tab();
    await user.clear(screen.getByLabelText("Initiative for Goblin 2"));
    await user.type(screen.getByLabelText("Initiative for Goblin 2"), "16");

    await user.click(screen.getByRole("button", { name: /new combatant/i }));
    await user.type(screen.getByLabelText(/name for combatant-/i), "Mira");
    await user.tab();
    await user.selectOptions(screen.getByLabelText("Type for Mira"), "player");
    await user.tab();
    await user.clear(screen.getByLabelText("Initiative for Mira"));
    await user.type(screen.getByLabelText("Initiative for Mira"), "10");

    const setupTable = screen.getByRole("table");
    const setupRows = within(setupTable).getAllByRole("row").slice(1);
    expect(setupRows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "Goblin 1",
      "Goblin 2",
      "Mira"
    ]);

    expect(screen.queryByText(/current turn/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByText(/HP:\s*0\/0/i)).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getAllByText(/round 1/i).length).toBeGreaterThan(0);
    const currentStatus = screen.getByLabelText("Current combatant status");
    expect(within(currentStatus).queryByText(/no action/i)).not.toBeInTheDocument();
    expect(within(currentStatus).queryByText(/no conditions/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    expect(screen.getByText("3/3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^apply condition$/i }));
    await user.type(screen.getByLabelText(/^condition$/i), "po");
    await user.keyboard("{Tab}");
    const applyPoisonedButton = screen.getByRole("button", { name: /^apply poisoned$/i });
    await user.click(screen.getByLabelText("Mira, player, 3 in initiative order"));
    await user.click(applyPoisonedButton);

    expect(screen.getAllByText("Poisoned").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /remove poisoned from/i }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /record action/i }));
    await user.type(screen.getByLabelText(/action text/i), "Shoots an arrow");
    await user.keyboard("{Tab}");

    const log = screen.getByText("Encounter Log").closest(".action-log");
    expect(log).not.toBeNull();
    expect(within(log as HTMLElement).getByText("Shoots an arrow")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await user.click(screen.getByRole("button", { name: /next turn/i }));

    expect(screen.getAllByText(/round 2/i).length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText("Current combatant status")).getByText("Round 1: Shoots an arrow")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await user.click(screen.getByRole("button", { name: /next turn/i }));

    expect(screen.getAllByText(/round 3/i).length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText("Current combatant status")).queryByText("Round 1: Shoots an arrow")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Current combatant status")).queryByText(/no action/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /previous/i }));
    await user.click(screen.getByRole("button", { name: /previous/i }));
    await user.click(screen.getByRole("button", { name: /previous/i }));

    expect(within(screen.getByLabelText("Current combatant status")).getByText("Round 1: Shoots an arrow")).toBeInTheDocument();

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AppState;
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.kind).toBe("player");
      expect(saved.encounter.combatants.filter((combatant) => combatant.name.startsWith("Goblin")).every((combatant) => combatant.kind === "monster")).toBe(true);
    });

    await user.click(screen.getByRole("button", { name: /new encounter/i }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AppState;
      expect(saved.encounter.actionLog).toHaveLength(0);
      expect(saved.encounter.combatants).toEqual([]);
      expect(saved.encounter.round).toBe(1);
    });
  }, 10000);

  it("does not wrap previous turn before the first combatant in round one", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /new combatant/i }));
    await user.type(screen.getByLabelText(/name for combatant-/i), "Goblin 1");
    await user.tab();
    await user.tab();
    await user.clear(screen.getByLabelText("Initiative for Goblin 1"));
    await user.type(screen.getByLabelText("Initiative for Goblin 1"), "14");

    await user.click(screen.getByRole("button", { name: /new combatant/i }));
    await user.type(screen.getByLabelText(/name for combatant-/i), "Goblin 2");
    await user.tab();
    await user.tab();
    await user.clear(screen.getByLabelText("Initiative for Goblin 2"));
    await user.type(screen.getByLabelText("Initiative for Goblin 2"), "11");

    const previousButton = screen.getByRole("button", { name: /previous/i });
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(previousButton).toBeDisabled();

    await user.click(previousButton);
    expect(screen.getByText("1/2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next turn/i }));
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(previousButton).not.toBeDisabled();

    await user.click(previousButton);
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(previousButton).toBeDisabled();
  });

  it("adds a new combatant row and locks the name after leaving the field", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /new combatant/i }));
    const nameInput = screen.getByLabelText(/name for combatant-/i);
    await user.type(nameInput, "Bandit");
    await user.tab();
    const typeSelect = screen.getByLabelText("Type for Bandit");
    await user.selectOptions(typeSelect, "npc");
    await user.tab();

    expect(screen.getAllByText("Bandit").length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue("Bandit")).not.toBeInTheDocument();
    expect(screen.getByText("NPC")).toBeInTheDocument();
    expect(screen.queryByLabelText("Type for Bandit")).not.toBeInTheDocument();
    expect(screen.getByLabelText("HP for Bandit")).toBeInTheDocument();
  });

  it("toggles combatant edit mode for name and type fields", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [],
      encounter: {
        id: "encounter-edit-mode",
        name: "Edit Test",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "monster-bandit",
            name: "Bandit",
            kind: "monster",
            active: true,
            initiativeModifier: 1,
            initiative: 12,
            hp: 11,
            maxHp: 11,
            conditions: []
          }
        ],
        actionLog: []
      }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    expect(screen.queryByDisplayValue("Bandit")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /edit combatants/i }));
    expect(screen.getByRole("button", { name: /done edits/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bandit")).toBeInTheDocument();
    expect(screen.getByLabelText("Type for Bandit")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /done edits/i }));
    expect(screen.getByRole("button", { name: /edit combatants/i })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Bandit")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Type for Bandit")).not.toBeInTheDocument();
  });

  it("deletes a combatant with the two-step icon button but keeps encounter log history", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [],
      encounter: {
        id: "encounter-delete-combatant",
        name: "Delete Test",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "monster-bandit",
            name: "Bandit",
            kind: "monster",
            active: true,
            initiativeModifier: 1,
            initiative: 12,
            hp: 11,
            maxHp: 11,
            conditions: [{ id: "condition-1", name: "Poisoned" }]
          }
        ],
        actionLog: [
          {
            id: "action-bandit",
            round: 1,
            combatantId: "monster-bandit",
            combatantName: "Bandit",
            text: "Swings a scimitar",
            createdAt: now
          }
        ]
      }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /edit combatants/i }));
    await user.click(screen.getByRole("button", { name: /delete bandit/i }));
    expect(screen.getByRole("button", { name: /confirm delete bandit/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm delete bandit/i }));

    expect(screen.queryByLabelText("Delete Bandit")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Name for monster-bandit")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bandit, monster, 1 in initiative order")).not.toBeInTheDocument();
    expect(screen.getByText("Swings a scimitar")).toBeInTheDocument();

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AppState;
      expect(saved.encounter.combatants).toHaveLength(0);
      expect(saved.encounter.actionLog).toHaveLength(1);
      expect(saved.encounter.actionLog[0].combatantName).toBe("Bandit");
    });
  });

  it("removes a combatant card when its Active checkbox is unchecked", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [],
      encounter: {
        id: "encounter-active-toggle",
        name: "Bridge",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            active: true,
            initiativeModifier: 2,
            initiative: 14,
            hp: 6,
            maxHp: 6,
            conditions: []
          }
        ],
        actionLog: []
      }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    expect(screen.getByLabelText("Goblin, monster, 1 in initiative order")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Active for Goblin"));
    expect(screen.queryByLabelText("Goblin, monster, 1 in initiative order")).not.toBeInTheDocument();
  });

  it("moves newly inactive combatants below all active rows and above older inactive rows", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [],
      encounter: {
        id: "encounter-inactive-order",
        name: "Inactive Order",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "monster-alpha",
            name: "Alpha",
            kind: "monster",
            active: true,
            initiativeModifier: 0,
            initiative: 18,
            hp: 8,
            maxHp: 8,
            conditions: []
          },
          {
            id: "monster-beta",
            name: "Beta",
            kind: "monster",
            active: true,
            initiativeModifier: 0,
            initiative: 15,
            hp: 8,
            maxHp: 8,
            conditions: []
          },
          {
            id: "monster-gamma",
            name: "Gamma",
            kind: "monster",
            active: false,
            initiativeModifier: 0,
            initiative: 20,
            hp: 8,
            maxHp: 8,
            conditions: []
          }
        ],
        actionLog: []
      }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    const setupTable = screen.getByRole("table");
    const rowNames = () => within(setupTable).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);

    expect(rowNames()).toEqual(["Alpha", "Beta", "Gamma"]);

    await user.click(screen.getByLabelText("Active for Beta"));
    expect(rowNames()).toEqual(["Alpha", "Beta", "Gamma"]);

    await user.click(screen.getByLabelText("Active for Alpha"));
    expect(rowNames()).toEqual(["Alpha", "Beta", "Gamma"]);

    await user.click(screen.getByLabelText("Active for Beta"));
    expect(rowNames()).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("replaces or clears the active combatant action for the current round", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-action-entry",
        name: "Action Entry",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 17,
            hp: 12,
            maxHp: 20,
            conditions: []
          }
        ],
        actionLog: []
      }
    };
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /record action/i }));
    await user.type(screen.getByLabelText(/action text/i), "Attack Goblin Warrior 1");
    await user.keyboard("{Tab}");

    const log = screen.getByText("Encounter Log").closest(".action-log") as HTMLElement;
    expect(within(log).getByText("Attack Goblin Warrior 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /record action/i }));
    await user.type(screen.getByLabelText(/action text/i), "Cast Sleep");
    await user.keyboard("{Tab}");

    expect(within(log).queryByText("Attack Goblin Warrior 1")).not.toBeInTheDocument();
    expect(within(log).getByText("Cast Sleep")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /record action/i }));
    await user.keyboard("{Tab}");

    expect(within(log).queryByText("Cast Sleep")).not.toBeInTheDocument();
    expect(within(log).getByText("Actions recorded here stay with this encounter.")).toBeInTheDocument();
  });

  it("restores every saved party member when starting a new encounter", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [
        { id: "player-mira", name: "Mira", initiativeModifier: 3 },
        { id: "player-orrin", name: "Orrin", initiativeModifier: -1, maxHp: 16 }
      ],
      encounter: {
        id: "encounter-active",
        name: "Bridge Ambush",
        round: 2,
        currentTurnIndex: 1,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 18,
            hp: 7,
            maxHp: 7,
            conditions: [{ id: "condition-afraid", name: "Frightened" }]
          },
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 14,
            hp: 12,
            maxHp: 20,
            conditions: [{ id: "condition-poisoned", name: "Poisoned" }]
          },
          {
            id: "npc-sildar",
            name: "Sildar",
            kind: "npc",
            initiativeModifier: 1,
            initiative: 9,
            hp: 9,
            maxHp: 9,
            conditions: [{ id: "condition-prone", name: "Prone" }]
          }
        ],
        actionLog: [
          {
            id: "action-mira",
            round: 1,
            combatantId: "player-mira",
            combatantName: "Mira",
            text: "Shoots an arrow",
            createdAt: now
          }
        ]
      }
    };
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /new encounter/i }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AppState;
      expect(saved.encounter.actionLog).toHaveLength(0);
      expect(saved.encounter.combatants.map((combatant) => combatant.name)).toEqual(["Mira", "Orrin", "Sildar"]);
      expect(saved.encounter.combatants.map((combatant) => combatant.kind)).toEqual(["player", "player", "npc"]);
      expect(saved.encounter.combatants.every((combatant) => combatant.initiative === null)).toBe(true);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.conditions.map((condition) => condition.name)).toEqual(["Poisoned"]);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Orrin")?.conditions).toEqual([]);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Sildar")?.conditions.map((condition) => condition.name)).toEqual(["Prone"]);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.maxHp).toBe(20);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Orrin")?.maxHp).toBe(16);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Sildar")?.maxHp).toBe(9);
      expect(saved.encounter.combatants.some((combatant) => combatant.kind === "monster")).toBe(false);
    });
  });

  it("removes every condition from the encounter setup controls", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-conditions-clear",
        name: "Condition Cleanup",
        round: 2,
        currentTurnIndex: 1,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 17,
            hp: 12,
            maxHp: 20,
            conditions: [{ id: "condition-poisoned", name: "Poisoned" }]
          },
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 9,
            hp: 6,
            maxHp: 6,
            conditions: [
              { id: "condition-prone", name: "Prone" },
              { id: "condition-frightened", name: "Frightened" }
            ]
          }
        ],
        actionLog: [
          {
            id: "action-mira",
            round: 1,
            combatantId: "player-mira",
            combatantName: "Mira",
            text: "Shoots an arrow",
            createdAt: now
          }
        ]
      }
    };
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /remove all conditions/i }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AppState;
      expect(saved.encounter.combatants.every((combatant) => combatant.conditions.length === 0)).toBe(true);
      expect(saved.encounter.actionLog).toHaveLength(1);
      expect(saved.encounter.round).toBe(2);
      expect(saved.encounter.currentTurnIndex).toBe(1);
      expect(saved.encounter.combatants.map((combatant) => combatant.name)).toEqual(["Mira", "Goblin"]);
    });
  });

  it("edits initiative scores and max HP directly in the encounter setup table", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-initiative-edit",
        name: "Initiative Entry",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: null,
            hp: 12,
            maxHp: 20,
            conditions: []
          },
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 12,
            hp: 6,
            maxHp: 6,
            conditions: []
          },
          {
            id: "npc-sildar",
            name: "Sildar",
            kind: "npc",
            initiativeModifier: 1,
            initiative: 5,
            hp: 9,
            maxHp: 9,
            conditions: []
          }
        ],
        actionLog: []
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    const setupTable = screen.getByRole("table");
    const rowNames = () => within(setupTable).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);
    expect(rowNames()).toEqual(["Goblin", "Sildar", "Mira"]);

    fireEvent.change(screen.getByLabelText("Initiative for Mira"), { target: { value: "19" } });
    expect(rowNames()).toEqual(["Mira", "Goblin", "Sildar"]);

    fireEvent.change(screen.getByLabelText("HP for Mira"), { target: { value: "18" } });
    expect(screen.getByText(/HP:\s*18\/20/i)).toBeInTheDocument();
    expect(screen.getByText("18/20")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Max HP for Mira"), { target: { value: "24" } });
    expect(screen.getByText(/HP:\s*18\/24/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Initiative for Goblin"), { target: { value: "" } });

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AppState;
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.initiative).toBe(19);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.hp).toBe(18);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.maxHp).toBe(24);
      expect(saved.party.find((player) => player.name === "Mira")?.maxHp).toBe(24);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Goblin")?.initiative).toBeNull();
    });
    expect(rowNames()).toEqual(["Mira", "Sildar", "Goblin"]);
  });

  it("clamps HP so it cannot exceed Max HP", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3, maxHp: 20 }],
      encounter: {
        id: "encounter-hp-clamp",
        name: "Clamp Test",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 17,
            hp: 12,
            maxHp: 20,
            conditions: []
          }
        ],
        actionLog: []
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    fireEvent.change(screen.getByLabelText("HP for Mira"), { target: { value: "25" } });
    expect(screen.getByText(/HP:\s*20\/20/i)).toBeInTheDocument();
    expect(screen.getByText("20/20")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Max HP for Mira"), { target: { value: "15" } });
    expect(screen.getByText(/HP:\s*15\/15/i)).toBeInTheDocument();
    expect(screen.getByText("15/15")).toBeInTheDocument();

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AppState;
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.hp).toBe(15);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.maxHp).toBe(15);
      expect(saved.party.find((player) => player.name === "Mira")?.maxHp).toBe(15);
    });
  });

  it("moves a tied initiative row up one slot with the up-arrow control", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [],
      encounter: {
        id: "encounter-tied-initiative",
        name: "Tie Test",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "monster-alpha",
            name: "Alpha",
            kind: "monster",
            initiativeModifier: 0,
            initiative: 15,
            hp: 5,
            maxHp: 5,
            conditions: []
          },
          {
            id: "monster-beta",
            name: "Beta",
            kind: "monster",
            initiativeModifier: 0,
            initiative: 15,
            hp: 5,
            maxHp: 5,
            conditions: []
          },
          {
            id: "monster-gamma",
            name: "Gamma",
            kind: "monster",
            initiativeModifier: 0,
            initiative: 12,
            hp: 5,
            maxHp: 5,
            conditions: []
          }
        ],
        actionLog: []
      }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    const setupTable = screen.getByRole("table");
    const rowNames = () => within(setupTable).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);

    expect(rowNames()).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(screen.queryByLabelText("Move Alpha up within initiative 15")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Move Beta up within initiative 15")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Move Beta up within initiative 15"));

    expect(rowNames()).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(screen.queryByLabelText("Move Beta up within initiative 15")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Move Alpha up within initiative 15")).toBeInTheDocument();
  });

  it("renders compact turn cards with previous-round actions and collapsed conditions", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-turn-cards",
        name: "Cavern Fight",
        round: 2,
        currentTurnIndex: 1,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 17,
            hp: 12,
            maxHp: 20,
            conditions: [
              { id: "condition-poisoned", name: "Poisoned" },
              { id: "condition-prone", name: "Prone" }
            ]
          },
          {
            id: "npc-sildar",
            name: "Sildar",
            kind: "npc",
            initiativeModifier: 1,
            initiative: 12,
            hp: 8,
            maxHp: 10,
            conditions: []
          },
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 9,
            hp: 6,
            maxHp: 6,
            conditions: []
          }
        ],
        actionLog: [
          {
            id: "action-mira-r1",
            round: 1,
            combatantId: "player-mira",
            combatantName: "Mira",
            text: "Shoots an arrow",
            createdAt: now
          },
          {
            id: "action-mira-r0",
            round: 0,
            combatantId: "player-mira",
            combatantName: "Mira",
            text: "Older action",
            createdAt: now
          }
        ]
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    const miraCard = screen.getByLabelText("Mira, player, 1 in initiative order");
    expect(miraCard).toHaveClass("turn-card-player");
    expect(miraCard).toHaveClass("acted");
    expect(screen.getByLabelText("Sildar, npc, 2 in initiative order")).toHaveClass("current");
    expect(within(miraCard).getByText("Round 1: Shoots an arrow")).toBeInTheDocument();
    expect(within(miraCard).queryByText("Older action")).not.toBeInTheDocument();
    expect(within(miraCard).getByText("Prone")).toBeInTheDocument();
    expect(within(miraCard).queryByText("Poisoned")).not.toBeInTheDocument();
    expect(within(miraCard).getByText("+1")).toHaveAttribute("title", "Poisoned\nProne");
    expect(screen.getByLabelText("Sildar, npc, 2 in initiative order")).toHaveClass("turn-card-npc");
    expect(screen.getByLabelText("Goblin, monster, 3 in initiative order")).toHaveClass("turn-card-monster");
    expect(within(miraCard).getByText("12/20")).toBeInTheDocument();
  });

  it("applies toolbar damage to selected cards using temp HP first and adds Unconscious at 0 HP", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-damage-tool",
        name: "Damage Test",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 17,
            hp: 12,
            maxHp: 20,
            tempHp: 5,
            conditions: []
          },
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 9,
            hp: 3,
            maxHp: 6,
            conditions: []
          },
          {
            id: "monster-ogre",
            name: "Ogre",
            kind: "monster",
            initiativeModifier: 1,
            initiative: 4,
            hp: 0,
            maxHp: 30,
            conditions: []
          }
        ],
        actionLog: []
      }
    };
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^apply damage$/i }));
    await user.type(screen.getByLabelText(/^damage amount$/i), "7");
    await user.keyboard("{Tab}");

    const applyDamageButton = screen.getByRole("button", { name: /^apply 7 damage$/i });
    expect(applyDamageButton).toBeDisabled();

    const miraCard = screen.getByLabelText("Mira, player, 1 in initiative order");
    const goblinCard = screen.getByLabelText("Goblin, monster, 2 in initiative order");
    const ogreCard = screen.getByLabelText("Ogre, monster, 3 in initiative order");

    await user.click(miraCard);
    await user.click(goblinCard);
    await user.click(ogreCard);

    expect(miraCard).toHaveClass("selected");
    expect(goblinCard).toHaveClass("selected");
    expect(ogreCard).not.toHaveClass("selected");
    expect(applyDamageButton).toHaveClass("ready");

    await user.click(goblinCard);
    expect(goblinCard).not.toHaveClass("selected");
    await user.click(goblinCard);
    expect(goblinCard).toHaveClass("selected");

    await user.click(applyDamageButton);

    expect(within(miraCard).getByText("10/20")).toBeInTheDocument();
    expect(within(miraCard).queryByText(/^5$/)).not.toBeInTheDocument();
    expect(within(goblinCard).getByText("0/6")).toBeInTheDocument();
    expect(within(goblinCard).getByText("Unconscious")).toBeInTheDocument();
    expect(within(ogreCard).getByText("0/30")).toBeInTheDocument();
    expect(within(ogreCard).queryByText("Unconscious")).not.toBeInTheDocument();

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AppState;
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.tempHp).toBe(0);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.hp).toBe(10);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Goblin")?.hp).toBe(0);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Goblin")?.conditions.map((condition) => condition.name)).toContain("Unconscious");
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Ogre")?.conditions).toEqual([]);
    });
  });

  it("applies a searched condition to selected combatant cards", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-conditions",
        name: "Sleep Spell",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 17,
            hp: 12,
            maxHp: 20,
            conditions: []
          },
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 9,
            hp: 6,
            maxHp: 6,
            conditions: []
          }
        ],
        actionLog: []
      }
    };
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^apply condition$/i }));
    const conditionInput = screen.getByLabelText(/^condition$/i);
    await user.type(conditionInput, "po");
    await user.keyboard("{Tab}");
    const applyPoisonedButton = screen.getByRole("button", { name: /^apply poisoned$/i });
    expect(applyPoisonedButton).toBeDisabled();

    const miraCard = screen.getByLabelText("Mira, player, 1 in initiative order");
    const goblinCard = screen.getByLabelText("Goblin, monster, 2 in initiative order");
    await user.click(goblinCard);
    expect(goblinCard).toHaveClass("selected");
    expect(miraCard).not.toHaveClass("selected");
    expect(applyPoisonedButton).toHaveClass("ready");

    await user.click(applyPoisonedButton);

    expect(within(goblinCard).getByText("Poisoned")).toBeInTheDocument();
    expect(within(miraCard).queryByText("Poisoned")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^apply condition$/i }));
    await user.type(screen.getByLabelText(/^condition$/i), "Sleepy");
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: /^apply sleepy$/i })).toBeInTheDocument();
  });

  it("enters card selection mode when a condition is picked from the input list", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-condition-list",
        name: "List Pick",
        round: 1,
        currentTurnIndex: 0,
        createdAt: now,
        updatedAt: now,
        combatants: [
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 17,
            hp: 12,
            maxHp: 20,
            conditions: []
          }
        ],
        actionLog: []
      }
    };
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^apply condition$/i }));
    fireEvent.change(screen.getByLabelText(/^condition$/i), { target: { value: "Prone" } });

    expect(screen.getByRole("button", { name: /^apply prone$/i })).toBeDisabled();
    await user.click(screen.getByLabelText("Mira, player, 1 in initiative order"));
    expect(screen.getByRole("button", { name: /^apply prone$/i })).toHaveClass("ready");
  });

  it("persists the app after refresh", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("button", { name: /new combatant/i }));
    await user.type(screen.getByLabelText(/name for combatant-/i), "Orrin");
    await user.tab();
    unmount();

    render(<App />);

    expect(screen.getAllByText("Orrin").length).toBeGreaterThan(0);
  });
});
