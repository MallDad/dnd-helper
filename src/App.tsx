import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { DEFAULT_CONDITIONS_2024 } from "./conditions";
import {
  createEmptyEncounter,
  latestActionByCombatant,
  latestActionByCombatantForRound,
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

type DamageForm = {
  combatantId: string;
  amount: string;
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
  const [activeDialog, setActiveDialog] = useState<"condition" | "action" | "damage" | null>(null);
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [isNpcFormOpen, setIsNpcFormOpen] = useState(false);
  const [damageForm, setDamageForm] = useState<DamageForm>({
    combatantId: "",
    amount: ""
  });
  const [isConditionToolOpen, setIsConditionToolOpen] = useState(false);
  const [conditionSearch, setConditionSearch] = useState("");
  const [chosenConditionName, setChosenConditionName] = useState("");
  const [selectedConditionTargets, setSelectedConditionTargets] = useState<string[]>([]);
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
  const isAtEncounterStart = state.encounter.round <= 1 && state.encounter.currentTurnIndex <= 0;
  const previousRound = state.encounter.round - 1;
  const currentLatestAction = currentCombatant
    ? latestActionByCombatantForRound(state.encounter, currentCombatant.id, previousRound)
    : null;
  const trimmedConditionSearch = conditionSearch.trim();
  const conditionMatches = trimmedConditionSearch
    ? DEFAULT_CONDITIONS_2024.filter((condition) =>
      condition.toLowerCase().includes(trimmedConditionSearch.toLowerCase())
    )
    : DEFAULT_CONDITIONS_2024;
  const selectedConditionName = chosenConditionName.trim();
  const activeCombatantIds = new Set(state.encounter.combatants.map((combatant) => combatant.id));
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
        : [...state.party, player],
      encounter: state.encounter.combatants.some((combatant) => combatant.id === player.id)
        ? state.encounter
        : {
          ...state.encounter,
          combatants: [
            ...state.encounter.combatants,
            {
              id: player.id,
              name: player.name,
              kind: "player",
              initiativeModifier: player.initiativeModifier,
              initiative: null,
              currentHp: 0,
              maxHp: 0,
              conditions: [],
              notes: player.notes
            }
          ],
          updatedAt: new Date().toISOString()
        }
    });
    setPlayerForm(emptyPlayerForm);
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
    const nextEncounter = createEmptyEncounter();
    const existingPlayerCombatants = new Map(
      state.encounter.combatants
        .filter((combatant) => combatant.kind === "player")
        .map((combatant) => [combatant.id, combatant])
    );
    const players = state.party.map((player) => {
      const existingCombatant = existingPlayerCombatants.get(player.id);

      return {
        id: player.id,
        name: player.name,
        kind: "player" as const,
        initiativeModifier: player.initiativeModifier,
        initiative: null,
        currentHp: existingCombatant?.currentHp ?? 0,
        maxHp: existingCombatant?.maxHp ?? 0,
        conditions: existingCombatant?.conditions ?? [],
        notes: player.notes
      };
    });
    const npcs = state.encounter.combatants
      .filter((combatant) => combatant.kind === "npc")
      .map((combatant) => ({
        ...combatant,
        initiative: null
      }));

    commitState({
      ...state,
      encounter: {
        ...nextEncounter,
        combatants: [...players, ...npcs]
      }
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
    if (orderedCombatants.length === 0 || state.encounter.round <= 1 && state.encounter.currentTurnIndex <= 0) {
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

  function openDamageDialog(combatantId: string) {
    setDamageForm({
      combatantId,
      amount: ""
    });
    setActiveDialog("damage");
  }

  function selectedDamageCombatant() {
    return state.encounter.combatants.find((combatant) => combatant.id === damageForm.combatantId);
  }

  function currentHp(combatant: EncounterCombatant) {
    return combatant.currentHp ?? 0;
  }

  function maxHp(combatant: EncounterCombatant) {
    return combatant.maxHp ?? 0;
  }

  function applyDamage(event: FormEvent) {
    event.preventDefault();
    const combatant = selectedDamageCombatant();

    if (!combatant) {
      return;
    }

    const damage = Math.max(0, Math.floor(numberFromInput(damageForm.amount)));
    updateCombatant(combatant.id, {
      currentHp: Math.max(0, currentHp(combatant) - damage)
    });
    setDamageForm({ combatantId: "", amount: "" });
    setActiveDialog(null);
  }

  function markDead() {
    const combatant = selectedDamageCombatant();

    if (!combatant) {
      return;
    }

    updateCombatant(combatant.id, {
      currentHp: 0
    });
    setDamageForm({ combatantId: "", amount: "" });
    setActiveDialog(null);
  }

  function toggleConditionTool() {
    setIsConditionToolOpen((isOpen) => {
      if (isOpen) {
        setConditionSearch("");
        setChosenConditionName("");
        setSelectedConditionTargets([]);
      }

      return !isOpen;
    });
  }

  function handleConditionSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setConditionSearch("");
      setChosenConditionName("");
      setSelectedConditionTargets([]);
      setIsConditionToolOpen(false);
      return;
    }

    if (event.key === "Tab") {
      const conditionName = conditionMatches[0] ?? trimmedConditionSearch;

      if (conditionName) {
        event.preventDefault();
        setConditionSearch(conditionName);
        setChosenConditionName(conditionName);
      }
    }
  }

  function handleConditionSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const exactMatch = DEFAULT_CONDITIONS_2024.find((condition) => condition.toLowerCase() === value.trim().toLowerCase());

    setConditionSearch(value);

    if (exactMatch) {
      setConditionSearch(exactMatch);
      setChosenConditionName(exactMatch);
    }
  }

  function handleChosenConditionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setConditionSearch("");
      setChosenConditionName("");
      setSelectedConditionTargets([]);
      setIsConditionToolOpen(false);
    }
  }

  function toggleConditionTarget(combatantId: string) {
    if (!isConditionToolOpen) {
      return;
    }

    setSelectedConditionTargets((targetIds) =>
      targetIds.includes(combatantId)
        ? targetIds.filter((targetId) => targetId !== combatantId)
        : [...targetIds, combatantId]
    );
  }

  function applyConditionToTargets() {
    const conditionName = selectedConditionName.trim();

    if (!conditionName || selectedConditionTargets.length === 0) {
      return;
    }

    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: encounter.combatants.map((combatant) =>
        selectedConditionTargets.includes(combatant.id)
          ? {
            ...combatant,
            conditions: [
              ...combatant.conditions,
              {
                id: createId("condition"),
                name: conditionName
              }
            ]
          }
          : combatant
      )
    })));
    setConditionSearch("");
    setChosenConditionName("");
    setSelectedConditionTargets([]);
    setIsConditionToolOpen(false);
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

          <button
            type="button"
            className="secondary section-add-toggle"
            aria-expanded={isPlayerFormOpen}
            onClick={() => setIsPlayerFormOpen((isOpen) => !isOpen)}
          >
            Add Player
          </button>

          {isPlayerFormOpen ? (
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
          ) : null}

          <button
            type="button"
            className="secondary section-add-toggle"
            aria-expanded={isNpcFormOpen}
            onClick={() => setIsNpcFormOpen((isOpen) => !isOpen)}
          >
            Add NPC/Monster
          </button>

          {isNpcFormOpen ? (
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
          ) : null}

          <div className="compact-table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Initiative</th>
                  <th>Conditions</th>
                  <th>Last Action</th>
                </tr>
              </thead>
              <tbody>
                {state.encounter.combatants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">Add players and monsters to build the encounter.</td>
                  </tr>
                ) : null}
                {orderedCombatants.map((combatant) => {
                  const latestAction = latestActionByCombatant(state.encounter, combatant.id);

                  return (
                    <tr key={combatant.id}>
                      <td>{combatant.name}</td>
                      <td>{combatant.initiative ?? "-"}</td>
                      <td>
                        {combatant.conditions.map((condition) => (
                          <span className="compact-table-line" key={condition.id}>{condition.name}</span>
                        ))}
                      </td>
                      <td>{latestAction?.text ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            <div className="turn-tool-buttons">
              {!isConditionToolOpen ? (
                <button type="button" className="secondary condition-tool-control" onClick={toggleConditionTool} disabled={orderedCombatants.length === 0}>
                  Apply Condition
                </button>
              ) : selectedConditionName ? (
                <button
                  type="button"
                  className={`condition-tool-control condition-apply-control${selectedConditionTargets.length > 0 ? " ready" : ""}`}
                  onClick={applyConditionToTargets}
                  onKeyDown={handleChosenConditionKeyDown}
                  disabled={selectedConditionTargets.length === 0}
                >
                  Apply {selectedConditionName}
                </button>
              ) : (
                <>
                  <input
                    className="condition-tool-control condition-search-control"
                    aria-label="Condition"
                    value={conditionSearch}
                    onChange={handleConditionSearchChange}
                    onKeyDown={handleConditionSearchKeyDown}
                    placeholder="Condition"
                    list="condition-options"
                    autoFocus
                  />
                  <datalist id="condition-options">
                    {DEFAULT_CONDITIONS_2024.map((condition) => (
                      <option value={condition} key={condition} />
                    ))}
                  </datalist>
                </>
              )}
              <button type="button" className="secondary" disabled>
                Apply Damage
              </button>
            </div>
            <button type="button" className="secondary" onClick={previousTurn} disabled={orderedCombatants.length === 0 || isAtEncounterStart}>
              Previous
            </button>
            <div className="current-status" aria-label="Current combatant status">
              <div className="status-heading">
                <strong>{currentCombatant?.name ?? "No combatants"}</strong>
                <span className="status-hp">
                  HP: {currentCombatant ? `${currentHp(currentCombatant)}/${maxHp(currentCombatant)}` : "0/0"}
                </span>
                <span>{currentCombatant ? `${currentOrderNumber}/${orderedCombatants.length}` : "0/0"}</span>
              </div>
              <div className="status-actions">
                <button type="button" className="secondary" onClick={openConditionDialog} disabled={!currentCombatant}>
                  Add Condition
                </button>
                <button type="button" onClick={openActionDialog} disabled={!currentCombatant}>
                  Record Action
                </button>
              </div>
              <div className="status-details">
                {currentLatestAction ? (
                  <p className="latest-action">Round {currentLatestAction.round}: {currentLatestAction.text}</p>
                ) : null}
                <div className="condition-chips status-condition-chips" aria-label="Current conditions">
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
            </div>
            <button type="button" onClick={nextTurn} disabled={orderedCombatants.length === 0}>
              Next Turn
            </button>
          </div>

          <div className="turn-order">
            {orderedCombatants.map((combatant, index) => {
              const previousRoundAction = latestActionByCombatantForRound(
                state.encounter,
                combatant.id,
                previousRound
              );
              const isCurrent = combatant.id === currentCombatant?.id;
              const hasActedThisRound = index < state.encounter.currentTurnIndex;
              const latestCondition = combatant.conditions[combatant.conditions.length - 1];
              const additionalConditionCount = Math.max(combatant.conditions.length - 1, 0);
              const conditionTooltip = combatant.conditions.map((condition) => condition.name).join("\n");
              const isSelectedForCondition = selectedConditionTargets.includes(combatant.id);

              return (
                <article
                  className={[
                    "turn-card",
                    `turn-card-${combatant.kind}`,
                    isCurrent ? "current" : "",
                    hasActedThisRound ? "acted" : "",
                    isConditionToolOpen ? "selectable" : "",
                    isSelectedForCondition ? "selected" : ""
                  ].filter(Boolean).join(" ")}
                  key={combatant.id}
                  aria-label={`${combatant.name}, ${combatant.kind}, ${index + 1} in initiative order`}
                  aria-selected={isConditionToolOpen ? isSelectedForCondition : undefined}
                  onClick={() => toggleConditionTarget(combatant.id)}
                >
                  <strong>{combatant.name}</strong>
                  <button
                    type="button"
                    className="turn-card-hp"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDamageDialog(combatant.id);
                    }}
                  >
                    {currentHp(combatant)}/{maxHp(combatant)}
                  </button>
                  <p className="turn-card-action">
                    {previousRoundAction ? `Round ${previousRoundAction.round}: ${previousRoundAction.text}` : ""}
                  </p>
                  <div className="turn-card-conditions">
                    {latestCondition ? (
                      <span
                        className="turn-card-condition"
                        title={[latestCondition.note, latestCondition.expires].filter(Boolean).join(" - ")}
                      >
                        {latestCondition.name}
                      </span>
                    ) : null}
                    {additionalConditionCount > 0 ? (
                      <span className="turn-card-more" title={conditionTooltip}>
                        +{additionalConditionCount}
                      </span>
                    ) : null}
                  </div>
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

      {activeDialog === "damage" ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="damage-dialog-title">
            <div className="dialog-heading">
              <h2 id="damage-dialog-title">Apply Damage</h2>
              <button type="button" className="secondary close-button" onClick={() => setActiveDialog(null)}>
                Close
              </button>
            </div>
            <form className="dialog-form" onSubmit={applyDamage}>
              <p className="dialog-target">
                {selectedDamageCombatant()
                  ? `${selectedDamageCombatant()?.name} HP ${currentHp(selectedDamageCombatant() as EncounterCombatant)}/${maxHp(selectedDamageCombatant() as EncounterCombatant)}`
                  : "No combatant selected"}
              </p>
              <label>
                Damage taken
                <input
                  type="number"
                  min="0"
                  value={damageForm.amount}
                  onChange={(event) => setDamageForm({ ...damageForm, amount: event.target.value })}
                />
              </label>
              <div className="button-row">
                <button type="submit" disabled={!selectedDamageCombatant() || !damageForm.amount.trim()}>
                  Apply Damage
                </button>
                <button type="button" className="danger small-button" onClick={markDead} disabled={!selectedDamageCombatant()}>
                  Dead
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
