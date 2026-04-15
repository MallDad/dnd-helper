import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEFAULT_CONDITIONS_2024 } from "./conditions";
import {
  createEmptyEncounter,
  latestActionByCombatant,
  makeNpcCombatants,
  sortCombatantsForTurnOrder
} from "./encounters";
import { createId } from "./id";
import { defaultState, loadState, saveState } from "./storage";
import type { ActiveCondition, AppState, CombatantKind, Encounter, EncounterCombatant, PlayerCharacter, RollMode } from "./types";

type PlayerForm = {
  id?: string;
  name: string;
  initiativeModifier: string;
  notes: string;
};

type NpcForm = {
  name: string;
  kind: CombatantKind;
  count: string;
  initiativeModifier: string;
  rollMode: RollMode;
  notes: string;
};

type ConditionForm = {
  combatantId: string;
  name: string;
  customName: string;
  note: string;
  expires: string;
};

const emptyPlayerForm: PlayerForm = {
  name: "",
  initiativeModifier: "0",
  notes: ""
};

const emptyNpcForm: NpcForm = {
  name: "",
  kind: "monster",
  count: "1",
  initiativeModifier: "0",
  rollMode: "per-creature",
  notes: ""
};

function numberFromInput(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatModifier(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function updateEncounter(state: AppState, updater: (encounter: Encounter) => Encounter): AppState {
  return {
    ...state,
    encounter: {
      ...updater(state.encounter),
      updatedAt: new Date().toISOString()
    }
  };
}

function App() {
  const [state, setState] = useState<AppState>(() => {
    if (typeof window === "undefined") {
      return defaultState();
    }

    return loadState();
  });
  const [playerForm, setPlayerForm] = useState<PlayerForm>(emptyPlayerForm);
  const [npcForm, setNpcForm] = useState<NpcForm>(emptyNpcForm);
  const [actionText, setActionText] = useState("");
  const [activeDialog, setActiveDialog] = useState<"condition" | "action" | null>(null);
  const [conditionForm, setConditionForm] = useState<ConditionForm>({
    combatantId: "",
    name: DEFAULT_CONDITIONS_2024[0],
    customName: "",
    note: "",
    expires: ""
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  const orderedCombatants = useMemo(
    () => sortCombatantsForTurnOrder(state.encounter.combatants),
    [state.encounter.combatants]
  );
  const currentCombatant = orderedCombatants[state.encounter.currentTurnIndex] ?? orderedCombatants[0];
  const currentOrderNumber = currentCombatant
    ? orderedCombatants.findIndex((combatant) => combatant.id === currentCombatant.id) + 1
    : 0;
  const activeCombatantIds = new Set(state.encounter.combatants.map((combatant) => combatant.id));
  const availablePlayers = state.party.filter(
    (player) => !state.encounter.combatants.some((combatant) => combatant.id === player.id)
  );

  function commitState(nextState: AppState) {
    setState(nextState);
  }

  function handleSavePlayer(event: FormEvent) {
    event.preventDefault();
    const name = playerForm.name.trim();

    if (!name) {
      return;
    }

    const player: PlayerCharacter = {
      id: playerForm.id ?? createId("player"),
      name,
      initiativeModifier: numberFromInput(playerForm.initiativeModifier),
      notes: playerForm.notes.trim() || undefined
    };

    commitState({
      ...state,
      party: playerForm.id
        ? state.party.map((item) => (item.id === player.id ? player : item))
        : [...state.party, player]
    });
    setPlayerForm(emptyPlayerForm);
  }

  function handleDeletePlayer(id: string) {
    commitState({
      ...state,
      party: state.party.filter((player) => player.id !== id)
    });
  }

  function addPlayerToEncounter(player: PlayerCharacter) {
    const combatant: EncounterCombatant = {
      id: player.id,
      name: player.name,
      kind: "player",
      initiativeModifier: player.initiativeModifier,
      initiative: null,
      conditions: [],
      notes: player.notes
    };

    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: [...encounter.combatants, combatant]
    })));
  }

  function handleAddNpc(event: FormEvent) {
    event.preventDefault();
    const name = npcForm.name.trim();

    if (!name) {
      return;
    }

    const combatants = makeNpcCombatants({
      name,
      kind: npcForm.kind === "npc" ? "npc" : "monster",
      count: numberFromInput(npcForm.count, 1),
      initiativeModifier: numberFromInput(npcForm.initiativeModifier),
      rollMode: npcForm.rollMode,
      notes: npcForm.notes
    });

    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: [...encounter.combatants, ...combatants]
    })));
    setNpcForm(emptyNpcForm);
  }

  function updateCombatant(id: string, updates: Partial<EncounterCombatant>) {
    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: encounter.combatants.map((combatant) =>
        combatant.id === id ? { ...combatant, ...updates } : combatant
      )
    })));
  }

  function removeCombatant(id: string) {
    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      currentTurnIndex: Math.min(encounter.currentTurnIndex, Math.max(encounter.combatants.length - 2, 0)),
      combatants: encounter.combatants.filter((combatant) => combatant.id !== id),
      actionLog: encounter.actionLog.filter((action) => action.combatantId !== id)
    })));
  }

  function moveCombatant(id: string, direction: -1 | 1) {
    const index = state.encounter.combatants.findIndex((combatant) => combatant.id === id);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= state.encounter.combatants.length) {
      return;
    }

    const nextCombatants = [...state.encounter.combatants];
    [nextCombatants[index], nextCombatants[targetIndex]] = [nextCombatants[targetIndex], nextCombatants[index]];

    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: nextCombatants
    })));
  }

  function startEncounter() {
    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      status: "active",
      round: Math.max(encounter.round, 1),
      currentTurnIndex: 0
    })));
  }

  function endEncounter() {
    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      status: "complete"
    })));
  }

  function newEncounter() {
    commitState({
      ...state,
      encounter: createEmptyEncounter()
    });
    setActionText("");
  }

  function nextTurn() {
    if (orderedCombatants.length === 0) {
      return;
    }

    commitState(updateEncounter(state, (encounter) => {
      const nextIndex = encounter.currentTurnIndex + 1;

      if (nextIndex >= orderedCombatants.length) {
        return {
          ...encounter,
          currentTurnIndex: 0,
          round: encounter.round + 1
        };
      }

      return {
        ...encounter,
        currentTurnIndex: nextIndex
      };
    }));
  }

  function previousTurn() {
    if (orderedCombatants.length === 0) {
      return;
    }

    commitState(updateEncounter(state, (encounter) => {
      const previousIndex = encounter.currentTurnIndex - 1;

      if (previousIndex < 0) {
        return {
          ...encounter,
          currentTurnIndex: orderedCombatants.length - 1,
          round: Math.max(1, encounter.round - 1)
        };
      }

      return {
        ...encounter,
        currentTurnIndex: previousIndex
      };
    }));
  }

  function handleAddAction(event: FormEvent) {
    event.preventDefault();

    if (!currentCombatant || !actionText.trim()) {
      return;
    }

    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      actionLog: [
        ...encounter.actionLog,
        {
          id: createId("action"),
          round: encounter.round,
          combatantId: currentCombatant.id,
          combatantName: currentCombatant.name,
          text: actionText.trim(),
          createdAt: new Date().toISOString()
        }
      ]
    })));
    setActionText("");
    setActiveDialog(null);
  }

  function handleAddCondition(event: FormEvent) {
    event.preventDefault();
    const combatantId = conditionForm.combatantId || currentCombatant?.id;
    const selectedName = conditionForm.name === "Custom" ? conditionForm.customName : conditionForm.name;
    const conditionName = selectedName.trim();

    if (!combatantId || !conditionName) {
      return;
    }

    const condition: ActiveCondition = {
      id: createId("condition"),
      name: conditionName,
      note: conditionForm.note.trim() || undefined,
      expires: conditionForm.expires.trim() || undefined
    };

    const combatant = state.encounter.combatants.find((item) => item.id === combatantId);

    updateCombatant(combatantId, {
      conditions: [...(combatant?.conditions ?? []), condition]
    });
    setConditionForm({
      combatantId,
      name: DEFAULT_CONDITIONS_2024[0],
      customName: "",
      note: "",
      expires: ""
    });
    setActiveDialog(null);
  }

  function removeCondition(combatantId: string, conditionId: string) {
    const combatant = state.encounter.combatants.find((item) => item.id === combatantId);

    if (!combatant) {
      return;
    }

    updateCombatant(combatantId, {
      conditions: combatant.conditions.filter((condition) => condition.id !== conditionId)
    });
  }

  function openConditionDialog() {
    setConditionForm({
      combatantId: currentCombatant?.id ?? "",
      name: DEFAULT_CONDITIONS_2024[0],
      customName: "",
      note: "",
      expires: ""
    });
    setActiveDialog("condition");
  }

  function openActionDialog() {
    setActionText("");
    setActiveDialog("action");
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local DM tracker</p>
          <h1>D&D Helper</h1>
        </div>
        <div className="header-status">
          <span>{state.party.length} players</span>
          <span>{state.encounter.combatants.length} combatants</span>
          <span>Round {state.encounter.round}</span>
        </div>
      </header>

      <section className="workspace" aria-label="D&D helper workspace">
        <section className="panel party-panel" aria-labelledby="party-heading">
          <div className="panel-heading">
            <h2 id="party-heading">Party Roster</h2>
            <span>Saved locally</span>
          </div>

          <form className="stacked-form" onSubmit={handleSavePlayer}>
            <label>
              Player name
              <input
                value={playerForm.name}
                onChange={(event) => setPlayerForm({ ...playerForm, name: event.target.value })}
                placeholder="Mira"
              />
            </label>
            <label>
              Player initiative modifier
              <input
                type="number"
                value={playerForm.initiativeModifier}
                onChange={(event) => setPlayerForm({ ...playerForm, initiativeModifier: event.target.value })}
              />
            </label>
            <label>
              Notes
              <textarea
                value={playerForm.notes}
                onChange={(event) => setPlayerForm({ ...playerForm, notes: event.target.value })}
                placeholder="Optional table notes"
              />
            </label>
            <div className="button-row">
              <button type="submit">{playerForm.id ? "Update Player" : "Save Player"}</button>
              {playerForm.id ? (
                <button type="button" className="secondary" onClick={() => setPlayerForm(emptyPlayerForm)}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <div className="list">
            {state.party.length === 0 ? <p className="empty">Add player characters before the session starts.</p> : null}
            {state.party.map((player) => (
              <article className="list-item" key={player.id}>
                <div>
                  <strong>{player.name}</strong>
                  <span>Initiative {formatModifier(player.initiativeModifier)}</span>
                  {player.notes ? <p>{player.notes}</p> : null}
                </div>
                <div className="item-actions">
                  <button type="button" className="secondary" onClick={() => setPlayerForm({
                    id: player.id,
                    name: player.name,
                    initiativeModifier: String(player.initiativeModifier),
                    notes: player.notes ?? ""
                  })}>
                    Edit
                  </button>
                  <button type="button" className="secondary" onClick={() => addPlayerToEncounter(player)} disabled={!availablePlayers.includes(player)}>
                    Add
                  </button>
                  <button type="button" className="danger" onClick={() => handleDeletePlayer(player.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel setup-panel" aria-labelledby="setup-heading">
          <div className="panel-heading">
            <h2 id="setup-heading">Encounter Setup</h2>
            <input
              aria-label="Encounter name"
              className="encounter-name"
              value={state.encounter.name}
              onChange={(event) => commitState(updateEncounter(state, (encounter) => ({ ...encounter, name: event.target.value })))}
            />
          </div>

          <form className="npc-grid" onSubmit={handleAddNpc}>
            <label>
              NPC or monster
              <input
                value={npcForm.name}
                onChange={(event) => setNpcForm({ ...npcForm, name: event.target.value })}
                placeholder="Goblin"
              />
            </label>
            <label>
              Type
              <select
                value={npcForm.kind}
                onChange={(event) => setNpcForm({ ...npcForm, kind: event.target.value as CombatantKind })}
              >
                <option value="monster">Monster</option>
                <option value="npc">NPC</option>
              </select>
            </label>
            <label>
              Count
              <input
                type="number"
                min="1"
                value={npcForm.count}
                onChange={(event) => setNpcForm({ ...npcForm, count: event.target.value })}
              />
            </label>
            <label>
              NPC initiative modifier
              <input
                type="number"
                value={npcForm.initiativeModifier}
                onChange={(event) => setNpcForm({ ...npcForm, initiativeModifier: event.target.value })}
              />
            </label>
            <label>
              Roll initiative
              <select
                value={npcForm.rollMode}
                onChange={(event) => setNpcForm({ ...npcForm, rollMode: event.target.value as RollMode })}
              >
                <option value="per-creature">Per creature</option>
                <option value="grouped">By monster type</option>
              </select>
            </label>
            <label>
              Notes
              <input
                value={npcForm.notes}
                onChange={(event) => setNpcForm({ ...npcForm, notes: event.target.value })}
                placeholder="Optional"
              />
            </label>
            <button type="submit">Add NPCs</button>
          </form>

          <div className="combatant-list">
            {state.encounter.combatants.length === 0 ? (
              <p className="empty">Add players and monsters to build the encounter.</p>
            ) : null}
            {state.encounter.combatants.map((combatant) => (
              <article className="combatant-edit" key={combatant.id}>
                <div>
                  <strong>{combatant.name}</strong>
                  <span>{combatant.kind}</span>
                </div>
                <label>
                  Initiative
                  <input
                    type="number"
                    value={combatant.initiative ?? ""}
                    onChange={(event) => updateCombatant(combatant.id, {
                      initiative: event.target.value === "" ? null : numberFromInput(event.target.value)
                    })}
                    placeholder="Manual"
                  />
                </label>
                <div className="item-actions">
                  <button type="button" className="secondary" onClick={() => moveCombatant(combatant.id, -1)}>
                    Up
                  </button>
                  <button type="button" className="secondary" onClick={() => moveCombatant(combatant.id, 1)}>
                    Down
                  </button>
                  <button type="button" className="danger" onClick={() => removeCombatant(combatant.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="button-row encounter-controls">
            {state.encounter.status !== "active" ? (
              <button type="button" onClick={startEncounter} disabled={state.encounter.combatants.length === 0}>
                Start Combat
              </button>
            ) : (
              <button type="button" className="danger" onClick={endEncounter}>
                End Combat
              </button>
            )}
            <button type="button" className="secondary" onClick={newEncounter}>
              New Encounter
            </button>
          </div>
        </section>

        <section className="panel combat-panel" aria-labelledby="combat-heading">
          <div className="panel-heading">
            <h2 id="combat-heading">Combat Tracker</h2>
            <span>{state.encounter.status}</span>
          </div>

          <div className="turn-controls">
            <button type="button" className="secondary" onClick={previousTurn} disabled={orderedCombatants.length === 0}>
              Previous
            </button>
            <div className="current-status" aria-label="Current combatant status">
              <div className="status-heading">
                <strong>{currentCombatant?.name ?? "No combatants"}</strong>
                <span>{currentCombatant ? `${currentOrderNumber}/${orderedCombatants.length}` : "0/0"}</span>
              </div>
              <div className="status-meta">
                <span>HP: xxx</span>
                {currentCombatant ? <span>Initiative: {currentCombatant.initiative ?? "-"}</span> : null}
              </div>
              <div className="status-section">
                <span className="status-label">Conditions</span>
                <div className="condition-chips">
                  {!currentCombatant || currentCombatant.conditions.length === 0 ? (
                    <span className="quiet">No conditions</span>
                  ) : null}
                  {currentCombatant?.conditions.map((condition) => (
                    <span
                      className="condition-chip"
                      key={condition.id}
                      title={[condition.note, condition.expires].filter(Boolean).join(" - ")}
                    >
                      {condition.name}
                      <button
                        type="button"
                        className="chip-remove"
                        aria-label={`Remove ${condition.name} from ${currentCombatant.name}`}
                        onClick={() => removeCondition(currentCombatant.id, condition.id)}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="status-actions">
                <button type="button" className="secondary" onClick={openConditionDialog} disabled={!currentCombatant}>
                  Add Condition
                </button>
                <button type="button" onClick={openActionDialog} disabled={!currentCombatant}>
                  Record Action
                </button>
              </div>
            </div>
            <button type="button" onClick={nextTurn} disabled={orderedCombatants.length === 0}>
              Next Turn
            </button>
          </div>

          <div className="turn-order">
            {orderedCombatants.map((combatant, index) => {
              const latestAction = latestActionByCombatant(state.encounter, combatant.id);
              const isCurrent = combatant.id === currentCombatant?.id;

              return (
                <article className={`turn-card${isCurrent ? " current" : ""}`} key={combatant.id}>
                  <div className="turn-card-header">
                    <span className="initiative-score">{combatant.initiative ?? "-"}</span>
                    <div>
                      <strong>{combatant.name}</strong>
                      <span>{combatant.kind} - {index + 1} in order</span>
                    </div>
                  </div>
                  <div className="condition-chips">
                    {combatant.conditions.length === 0 ? <span className="quiet">No conditions</span> : null}
                    {combatant.conditions.map((condition) => (
                      <span
                        className="condition-chip"
                        key={condition.id}
                        title={[condition.note, condition.expires].filter(Boolean).join(" - ")}
                      >
                        {condition.name}
                        <button
                          type="button"
                          className="chip-remove"
                          aria-label={`Remove ${condition.name} from ${combatant.name}`}
                          onClick={() => removeCondition(combatant.id, condition.id)}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                  {latestAction ? <p className="latest-action">Latest: {latestAction.text}</p> : null}
                </article>
              );
            })}
          </div>

          <div className="action-log">
            <h3>Encounter Log</h3>
            {state.encounter.actionLog.filter((action) => activeCombatantIds.has(action.combatantId)).length === 0 ? (
              <p className="empty">Actions recorded here stay with this encounter.</p>
            ) : null}
            {state.encounter.actionLog
              .filter((action) => activeCombatantIds.has(action.combatantId))
              .slice()
              .reverse()
              .map((action) => (
                <article className="log-entry" key={action.id}>
                  <span>Round {action.round}</span>
                  <strong>{action.combatantName}</strong>
                  <p>{action.text}</p>
                </article>
              ))}
          </div>
        </section>
      </section>

      {activeDialog === "condition" ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="condition-dialog-title">
            <div className="dialog-heading">
              <h2 id="condition-dialog-title">Add Condition</h2>
              <button type="button" className="secondary close-button" onClick={() => setActiveDialog(null)}>
                Close
              </button>
            </div>
            <form className="dialog-form" onSubmit={handleAddCondition}>
              <p className="dialog-target">{currentCombatant?.name ?? "No combatant selected"}</p>
              <label>
                Condition
                <select
                  value={conditionForm.name}
                  onChange={(event) => setConditionForm({ ...conditionForm, name: event.target.value })}
                >
                  {DEFAULT_CONDITIONS_2024.map((condition) => (
                    <option value={condition} key={condition}>
                      {condition}
                    </option>
                  ))}
                  <option value="Custom">Custom</option>
                </select>
              </label>
              {conditionForm.name === "Custom" ? (
                <label>
                  Custom name
                  <input
                    value={conditionForm.customName}
                    onChange={(event) => setConditionForm({ ...conditionForm, customName: event.target.value })}
                  />
                </label>
              ) : null}
              <label>
                Expiry
                <input
                  value={conditionForm.expires}
                  onChange={(event) => setConditionForm({ ...conditionForm, expires: event.target.value })}
                  placeholder="Until save succeeds"
                />
              </label>
              <label>
                Note
                <input
                  value={conditionForm.note}
                  onChange={(event) => setConditionForm({ ...conditionForm, note: event.target.value })}
                  placeholder="Optional"
                />
              </label>
              <div className="button-row">
                <button type="submit" disabled={!currentCombatant}>
                  Add Condition
                </button>
                <button type="button" className="secondary" onClick={() => setActiveDialog(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {activeDialog === "action" ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title">
            <div className="dialog-heading">
              <h2 id="action-dialog-title">Record Action</h2>
              <button type="button" className="secondary close-button" onClick={() => setActiveDialog(null)}>
                Close
              </button>
            </div>
            <form className="dialog-form" onSubmit={handleAddAction}>
              <p className="dialog-target">{currentCombatant?.name ?? "No combatant selected"}</p>
              <label>
                Action taken
                <textarea
                  value={actionText}
                  onChange={(event) => setActionText(event.target.value)}
                  placeholder={currentCombatant ? `${currentCombatant.name} attacks, dashes, casts...` : "Add combatants first"}
                />
              </label>
              <div className="button-row">
                <button type="submit" disabled={!currentCombatant || !actionText.trim()}>
                  Record Action
                </button>
                <button type="button" className="secondary" onClick={() => setActiveDialog(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
