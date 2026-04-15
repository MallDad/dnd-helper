import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("App workflow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a party member, adds grouped monsters, starts combat, tracks conditions, and records actions", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/player name/i), "Mira");
    await user.clear(screen.getByLabelText(/player initiative modifier/i));
    await user.type(screen.getByLabelText(/player initiative modifier/i), "3");
    await user.click(screen.getByRole("button", { name: /save player/i }));

    expect(screen.getByText("Mira")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await user.type(screen.getByLabelText(/npc or monster/i), "Goblin");
    await user.clear(screen.getByLabelText(/^count$/i));
    await user.type(screen.getByLabelText(/^count$/i), "2");
    await user.selectOptions(screen.getByLabelText(/roll initiative/i), "grouped");
    await user.click(screen.getByRole("button", { name: /add npcs/i }));

    await user.type(screen.getAllByPlaceholderText("Manual")[0], "15");
    await user.click(screen.getByRole("button", { name: /start combat/i }));

    expect(screen.queryByText(/current turn/i)).not.toBeInTheDocument();
    expect(screen.getByText("HP: xxx")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getAllByText(/round 1/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /add condition/i }));
    const conditionDialog = screen.getByRole("dialog", { name: /add condition/i });
    await user.selectOptions(screen.getByLabelText(/^condition$/i), "Poisoned");
    await user.type(screen.getByLabelText(/^expiry$/i), "until save succeeds");
    await user.click(within(conditionDialog).getByRole("button", { name: /add condition/i }));

    expect(screen.getAllByText("Poisoned").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /remove poisoned from/i }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /record action/i }));
    const actionDialog = screen.getByRole("dialog", { name: /record action/i });
    await user.type(screen.getByLabelText(/action taken/i), "Shoots an arrow");
    await user.click(within(actionDialog).getByRole("button", { name: /record action/i }));

    const log = screen.getByText("Encounter Log").closest(".action-log");
    expect(log).not.toBeNull();
    expect(within(log as HTMLElement).getByText("Shoots an arrow")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await user.click(screen.getByRole("button", { name: /next turn/i }));

    expect(screen.getAllByText(/round 2/i).length).toBeGreaterThan(0);
  });

  it("persists the app after refresh", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.type(screen.getByLabelText(/player name/i), "Orrin");
    await user.click(screen.getByRole("button", { name: /save player/i }));
    unmount();

    render(<App />);

    expect(screen.getByText("Orrin")).toBeInTheDocument();
  });
});
