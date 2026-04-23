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

  it("creates a party member, adds grouped monsters, starts combat, tracks conditions, and records actions", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add player/i }));
    await user.type(screen.getByLabelText(/player name/i), "Mira");
    await user.clear(screen.getByLabelText(/player initiative modifier/i));
    await user.type(screen.getByLabelText(/player initiative modifier/i), "3");
    await user.click(screen.getByRole("button", { name: /save player/i }));

    expect(screen.getAllByText("Mira").length).toBeGreaterThan(0);

    expect(screen.queryByLabelText(/npc or monster/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add npc\/monster/i }));
    await user.type(screen.getByLabelText(/npc or monster/i), "Goblin");
    await user.clear(screen.getByLabelText(/^count$/i));
    await user.type(screen.getByLabelText(/^count$/i), "2");
    await user.selectOptions(screen.getByLabelText(/roll initiative/i), "grouped");
    await user.click(screen.getByRole("button", { name: /add npcs/i }));

    const setupTable = screen.getByRole("table");
    const setupRows = within(setupTable).getAllByRole("row").slice(1);
    expect(setupRows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "Goblin 1",
      "Goblin 2",
      "Mira"
    ]);

    await user.click(screen.getByRole("button", { name: /start combat/i }));

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
      expect(saved.encounter.combatants.map((combatant) => combatant.name)).toEqual(["Mira"]);
      expect(saved.encounter.combatants[0].kind).toBe("player");
      expect(saved.encounter.combatants[0].initiative).toBeNull();
      expect(saved.encounter.combatants[0].conditions.map((condition) => condition.name)).toEqual(["Poisoned"]);
      expect(saved.encounter.status).toBe("setup");
      expect(saved.encounter.round).toBe(1);
    });
  }, 10000);

  it("does not wrap previous turn before the first combatant in round one", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add npc\/monster/i }));
    await user.type(screen.getByLabelText(/npc or monster/i), "Goblin");
    await user.clear(screen.getByLabelText(/^count$/i));
    await user.type(screen.getByLabelText(/^count$/i), "2");
    await user.click(screen.getByRole("button", { name: /add npcs/i }));
    await user.click(screen.getByRole("button", { name: /start combat/i }));

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

  it("replaces or clears the active combatant action for the current round", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-action-entry",
        name: "Action Entry",
        status: "active",
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
            currentHp: 12,
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
        status: "active",
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
            currentHp: 7,
            maxHp: 7,
            conditions: [{ id: "condition-afraid", name: "Frightened" }]
          },
          {
            id: "player-mira",
            name: "Mira",
            kind: "player",
            initiativeModifier: 3,
            initiative: 14,
            currentHp: 12,
            maxHp: 20,
            conditions: [{ id: "condition-poisoned", name: "Poisoned" }]
          },
          {
            id: "npc-sildar",
            name: "Sildar",
            kind: "npc",
            initiativeModifier: 1,
            initiative: 9,
            currentHp: 9,
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
        status: "active",
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
            currentHp: 12,
            maxHp: 20,
            conditions: [{ id: "condition-poisoned", name: "Poisoned" }]
          },
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 9,
            currentHp: 6,
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
        status: "setup",
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
            currentHp: 12,
            maxHp: 20,
            conditions: []
          },
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 12,
            currentHp: 6,
            maxHp: 6,
            conditions: []
          },
          {
            id: "npc-sildar",
            name: "Sildar",
            kind: "npc",
            initiativeModifier: 1,
            initiative: 5,
            currentHp: 9,
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

    fireEvent.change(screen.getByLabelText("Max HP for Mira"), { target: { value: "24" } });
    expect(screen.getByText(/HP:\s*12\/24/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Initiative for Goblin"), { target: { value: "" } });

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AppState;
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.initiative).toBe(19);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Mira")?.maxHp).toBe(24);
      expect(saved.party.find((player) => player.name === "Mira")?.maxHp).toBe(24);
      expect(saved.encounter.combatants.find((combatant) => combatant.name === "Goblin")?.initiative).toBeNull();
    });
    expect(rowNames()).toEqual(["Mira", "Sildar", "Goblin"]);
  });

  it("renders compact turn cards with previous-round actions, HP controls, and collapsed conditions", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-turn-cards",
        name: "Cavern Fight",
        status: "active",
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
            currentHp: 12,
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
            currentHp: 8,
            maxHp: 10,
            conditions: []
          },
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 9,
            currentHp: 6,
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
    expect(within(miraCard).getByRole("button", { name: "12/20" })).toBeInTheDocument();
    expect(within(miraCard).getByText("Round 1: Shoots an arrow")).toBeInTheDocument();
    expect(within(miraCard).queryByText("Older action")).not.toBeInTheDocument();
    expect(within(miraCard).getByText("Prone")).toBeInTheDocument();
    expect(within(miraCard).queryByText("Poisoned")).not.toBeInTheDocument();
    expect(within(miraCard).getByText("+1")).toHaveAttribute("title", "Poisoned\nProne");
    expect(screen.getByLabelText("Sildar, npc, 2 in initiative order")).toHaveClass("turn-card-npc");
    expect(screen.getByLabelText("Goblin, monster, 3 in initiative order")).toHaveClass("turn-card-monster");

    await user.click(within(miraCard).getByRole("button", { name: "12/20" }));
    const damageDialog = screen.getByRole("dialog", { name: /apply damage/i });
    await user.type(screen.getByLabelText(/damage taken/i), "5");
    await user.click(within(damageDialog).getByRole("button", { name: /apply damage/i }));
    expect(within(miraCard).getByRole("button", { name: "7/20" })).toBeInTheDocument();

    await user.click(within(miraCard).getByRole("button", { name: "7/20" }));
    await user.click(screen.getByRole("button", { name: /dead/i }));
    expect(within(miraCard).getByRole("button", { name: "0/20" })).toBeInTheDocument();
  });

  it("applies a searched condition to selected combatant cards", async () => {
    const now = new Date().toISOString();
    const seededState: AppState = {
      party: [{ id: "player-mira", name: "Mira", initiativeModifier: 3 }],
      encounter: {
        id: "encounter-conditions",
        name: "Sleep Spell",
        status: "active",
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
            currentHp: 12,
            maxHp: 20,
            conditions: []
          },
          {
            id: "monster-goblin",
            name: "Goblin",
            kind: "monster",
            initiativeModifier: 2,
            initiative: 9,
            currentHp: 6,
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
        status: "active",
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
            currentHp: 12,
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

    await user.click(screen.getByRole("button", { name: /add player/i }));
    await user.type(screen.getByLabelText(/player name/i), "Orrin");
    await user.click(screen.getByRole("button", { name: /save player/i }));
    unmount();

    render(<App />);

    expect(screen.getAllByText("Orrin").length).toBeGreaterThan(0);
  });
});
