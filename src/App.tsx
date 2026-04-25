import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { DEFAULT_CONDITIONS_2024 } from "./conditions";
import {
  createEmptyEncounter,
  latestActionByCombatantForRound,
  sortCombatantsForTurnOrder
} from "./encounters";
import { createId } from "./id";
import { defaultState, loadState, saveState } from "./storage";
import type { AppState, CombatantKind, Encounter, EncounterCombatant } from "./types";

function numberFromInput(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampHpToMax(hp: number, maxHp: number): number {
  return Math.min(Math.max(0, hp), Math.max(0, maxHp));
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
  const [actionText, setActionText] = useState("");
  const [isActionToolOpen, setIsActionToolOpen] = useState(false);
  const [isConditionToolOpen, setIsConditionToolOpen] = useState(false);
  const [conditionSearch, setConditionSearch] = useState("");
  const [chosenConditionName, setChosenConditionName] = useState("");
  const [selectedConditionTargets, setSelectedConditionTargets] = useState<string[]>([]);
  const [isDamageToolOpen, setIsDamageToolOpen] = useState(false);
  const [isDamageTargeting, setIsDamageTargeting] = useState(false);
  const [damageAmount, setDamageAmount] = useState("");
  const [selectedDamageTargets, setSelectedDamageTargets] = useState<string[]>([]);
  const [editableNameIds, setEditableNameIds] = useState<string[]>([]);
  const [editableTypeIds, setEditableTypeIds] = useState<string[]>([]);
  const [isCombatantEditMode, setIsCombatantEditMode] = useState(false);
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const orderedCombatants = useMemo(
    () => sortCombatantsForTurnOrder(state.encounter.combatants),
    [state.encounter.combatants]
  );
  const activeCombatants = useMemo(
    () => orderedCombatants.filter((combatant) => combatant.active !== false),
    [orderedCombatants]
  );
  const currentCombatant = activeCombatants[state.encounter.currentTurnIndex] ?? activeCombatants[0];
  const currentOrderNumber = currentCombatant
    ? activeCombatants.findIndex((combatant) => combatant.id === currentCombatant.id) + 1
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
  const selectedDamageAmount = damageAmount.trim();
  function commitState(nextState: AppState) {
    setState(nextState);
  }

  function clearConditionTool() {
    setConditionSearch("");
    setChosenConditionName("");
    setSelectedConditionTargets([]);
    setIsConditionToolOpen(false);
  }

  function clearDamageTool() {
    setDamageAmount("");
    setSelectedDamageTargets([]);
    setIsDamageTargeting(false);
    setIsDamageToolOpen(false);
  }

  function updateCombatant(id: string, updates: Partial<EncounterCombatant>) {
    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: encounter.combatants.map((combatant) =>
        combatant.id === id ? { ...combatant, ...updates } : combatant
      )
    })));
  }

  function updateCombatantInitiative(id: string, value: string) {
    const initiative = value.trim() === "" ? null : numberFromInput(value);
    updateCombatant(id, { initiative });
  }

  function moveCombatantUpWithinInitiative(id: string) {
    const orderedIndex = orderedCombatants.findIndex((combatant) => combatant.id === id);

    if (orderedIndex <= 0) {
      return;
    }

    const currentCombatant = orderedCombatants[orderedIndex];
    const previousCombatant = orderedCombatants[orderedIndex - 1];

    if (!currentCombatant || !previousCombatant || currentCombatant.initiative !== previousCombatant.initiative) {
      return;
    }

    commitState(updateEncounter(state, (encounter) => {
      const combatants = [...encounter.combatants];
      const currentIndex = combatants.findIndex((combatant) => combatant.id === currentCombatant.id);
      const previousIndex = combatants.findIndex((combatant) => combatant.id === previousCombatant.id);

      if (currentIndex < 0 || previousIndex < 0) {
        return encounter;
      }

      [combatants[currentIndex], combatants[previousIndex]] = [combatants[previousIndex], combatants[currentIndex]];

      return {
        ...encounter,
        combatants
      };
    }));
  }

  function updateCombatantActive(id: string, active: boolean) {
    commitState(updateEncounter(state, (encounter) => {
      const currentIndex = encounter.combatants.findIndex((combatant) => combatant.id === id);

      if (currentIndex < 0) {
        return encounter;
      }

      const currentCombatant = encounter.combatants[currentIndex];
      const remainingCombatants = encounter.combatants.filter((combatant) => combatant.id !== id);
      const updatedCombatant = { ...currentCombatant, active };
      let insertAt = remainingCombatants.length;

      if (active) {
        const firstInactiveIndex = remainingCombatants.findIndex((combatant) => combatant.active === false);
        insertAt = firstInactiveIndex >= 0 ? firstInactiveIndex : remainingCombatants.length;
      } else {
        const lastActiveIndex = remainingCombatants.reduce(
          (lastIndex, combatant, index) => combatant.active !== false ? index : lastIndex,
          -1
        );
        insertAt = lastActiveIndex + 1;
      }

      const combatants = [...remainingCombatants];
      combatants.splice(insertAt, 0, updatedCombatant);
      const nextActiveCount = combatants.filter((combatant) => combatant.active !== false).length;

      return {
        ...encounter,
        combatants,
        currentTurnIndex: nextActiveCount === 0 ? 0 : Math.min(encounter.currentTurnIndex, nextActiveCount - 1)
      };
    }));
  }

  function updateCombatantMaxHp(combatant: EncounterCombatant, value: string) {
    const maxHp = Math.max(0, numberFromInput(value));

    commitState(updateEncounter({
      ...state,
      party: combatant.kind === "player"
        ? state.party.map((player) => (player.id === combatant.id ? { ...player, maxHp } : player))
        : state.party
    }, (encounter) => ({
      ...encounter,
      combatants: encounter.combatants.map((item) =>
        item.id === combatant.id ? { ...item, maxHp, hp: clampHpToMax(item.hp ?? 0, maxHp) } : item
      )
    })));
  }

  function updateCombatantTempHp(id: string, value: string) {
    const tempHp = Math.max(0, numberFromInput(value));
    updateCombatant(id, { tempHp });
  }

  function updateCombatantHp(id: string, value: string) {
    const combatant = state.encounter.combatants.find((item) => item.id === id);
    const hp = clampHpToMax(numberFromInput(value), combatant?.maxHp ?? 0);
    updateCombatant(id, { hp });
  }

  function addInlineCombatant() {
    const id = createId("combatant");

    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: [
        ...encounter.combatants,
        {
          id,
          name: "",
          kind: "monster",
          active: true,
          initiativeModifier: 0,
          initiative: null,
          hp: 0,
          maxHp: 0,
          tempHp: 0,
          conditions: []
        }
      ]
    })));
    setEditableNameIds((current) => [...current, id]);
    setEditableTypeIds((current) => [...current, id]);
  }

  function toggleCombatantEditMode() {
    setIsCombatantEditMode((isEditing) => {
      if (isEditing) {
        setArmedDeleteId(null);
      }

      return !isEditing;
    });
  }

  function updateCombatantName(id: string, value: string) {
    updateCombatant(id, { name: value });
  }

  function lockCombatantName(id: string) {
    const combatant = state.encounter.combatants.find((item) => item.id === id);
    const nextName = combatant?.name.trim() ? combatant.name.trim() : "Unnamed Combatant";

    updateCombatant(id, { name: nextName });
    setEditableNameIds((current) => current.filter((editableId) => editableId !== id));
  }

  function updateCombatantType(id: string, value: CombatantKind) {
    updateCombatant(id, { kind: value });
  }

  function lockCombatantType(id: string) {
    setEditableTypeIds((current) => current.filter((editableId) => editableId !== id));
  }

  function toggleDeleteArm(id: string) {
    setArmedDeleteId((current) => current === id ? null : id);
  }

  function deleteCombatant(id: string) {
    commitState(updateEncounter(state, (encounter) => {
      const combatants = encounter.combatants.filter((combatant) => combatant.id !== id);
      const nextActiveCount = combatants.filter((combatant) => combatant.active !== false).length;

      return {
        ...encounter,
        combatants,
        currentTurnIndex: nextActiveCount === 0 ? 0 : Math.min(encounter.currentTurnIndex, nextActiveCount - 1)
      };
    }));
    setEditableNameIds((current) => current.filter((editableId) => editableId !== id));
    setEditableTypeIds((current) => current.filter((editableId) => editableId !== id));
    setArmedDeleteId(null);
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
        active: existingCombatant?.active ?? true,
        initiativeModifier: player.initiativeModifier,
        initiative: null,
        hp: existingCombatant?.hp ?? 0,
        maxHp: existingCombatant?.maxHp ?? player.maxHp ?? 0,
        tempHp: existingCombatant?.tempHp ?? 0,
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

  function removeAllConditions() {
    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: encounter.combatants.map((combatant) => ({
        ...combatant,
        conditions: []
      }))
    })));
  }

  function longRest() {
    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: encounter.combatants.map((combatant) => ({
        ...combatant,
        hp: combatant.maxHp ?? 0,
        tempHp: 0
      }))
    })));
  }

  function nextTurn() {
    if (activeCombatants.length === 0) {
      return;
    }

    commitState(updateEncounter(state, (encounter) => {
      const nextIndex = encounter.currentTurnIndex + 1;

      if (nextIndex >= activeCombatants.length) {
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
    if (activeCombatants.length === 0 || state.encounter.round <= 1 && state.encounter.currentTurnIndex <= 0) {
      return;
    }

    commitState(updateEncounter(state, (encounter) => {
      const previousIndex = encounter.currentTurnIndex - 1;

      if (previousIndex < 0) {
        return {
          ...encounter,
          currentTurnIndex: activeCombatants.length - 1,
          round: Math.max(1, encounter.round - 1)
        };
      }

      return {
        ...encounter,
        currentTurnIndex: previousIndex
      };
    }));
  }

  function recordCurrentAction() {
    if (!currentCombatant) {
      return;
    }

    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      actionLog: [
        ...encounter.actionLog.filter(
          (action) => action.combatantId !== currentCombatant.id || action.round !== encounter.round
        ),
        ...(actionText.trim()
          ? [{
              id: createId("action"),
              round: encounter.round,
              combatantId: currentCombatant.id,
              combatantName: currentCombatant.name,
              text: actionText.trim(),
              createdAt: new Date().toISOString()
            }]
          : [])
      ]
    })));
    setActionText("");
    setIsActionToolOpen(false);
  }

  function handleActionTextKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setActionText("");
      setIsActionToolOpen(false);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      recordCurrentAction();
    }
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

  function openActionTool() {
    setActionText("");
    setIsActionToolOpen(true);
  }

  function hp(combatant: EncounterCombatant) {
    return combatant.hp ?? 0;
  }

  function maxHp(combatant: EncounterCombatant) {
    return combatant.maxHp ?? 0;
  }

  function tempHp(combatant: EncounterCombatant) {
    return Math.max(0, combatant.tempHp ?? 0);
  }

  function toggleDamageTool() {
    if (isDamageToolOpen) {
      clearDamageTool();
      return;
    }

    clearConditionTool();
    setDamageAmount("");
    setSelectedDamageTargets([]);
    setIsDamageTargeting(false);
    setIsDamageToolOpen(true);
  }

  function handleDamageAmountChange(event: ChangeEvent<HTMLInputElement>) {
    setDamageAmount(event.target.value.replace(/[^\d]/g, ""));
  }

  function handleDamageAmountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      clearDamageTool();
      return;
    }

    if (event.key === "Tab" && Math.floor(numberFromInput(selectedDamageAmount)) > 0) {
      event.preventDefault();
      setIsDamageTargeting(true);
    }
  }

  function toggleConditionTool() {
    if (isConditionToolOpen) {
      clearConditionTool();
      return;
    }

    clearDamageTool();
    setIsConditionToolOpen(true);
  }

  function handleConditionSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      clearConditionTool();
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
      clearConditionTool();
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

  function toggleDamageTarget(combatantId: string) {
    if (!isDamageToolOpen || !isDamageTargeting) {
      return;
    }

    const combatant = activeCombatants.find((item) => item.id === combatantId);

    if (!combatant || hp(combatant) <= 0) {
      return;
    }

    setSelectedDamageTargets((targetIds) =>
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
    clearConditionTool();
  }

  function applyDamageToTargets() {
    const damage = Math.max(0, Math.floor(numberFromInput(selectedDamageAmount)));

    if (damage <= 0 || selectedDamageTargets.length === 0) {
      return;
    }

    commitState(updateEncounter(state, (encounter) => ({
      ...encounter,
      combatants: encounter.combatants.map((combatant) => {
        if (!selectedDamageTargets.includes(combatant.id) || hp(combatant) <= 0) {
          return combatant;
        }

        const currentTempHp = tempHp(combatant);
        const tempHpAfterDamage = Math.max(0, currentTempHp - damage);
        const remainingDamage = Math.max(0, damage - currentTempHp);
        const hpAfterDamage = Math.max(0, hp(combatant) - remainingDamage);
        const hasUnconscious = combatant.conditions.some((condition) => condition.name === "Unconscious");

        return {
          ...combatant,
          tempHp: tempHpAfterDamage,
          hp: hpAfterDamage,
          conditions:
            hpAfterDamage === 0 && !hasUnconscious
              ? [...combatant.conditions, { id: createId("condition"), name: "Unconscious" }]
              : combatant.conditions
        };
      })
    })));
    clearDamageTool();
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
          </div>

          <div className="compact-table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Active</th>
                  <th><span className="compact-table-heading-label">Init</span></th>
                  <th className="compact-table-heading-cell"><span className="compact-table-heading-label">HP</span></th>
                  <th className="compact-table-heading-cell"><span className="compact-table-heading-label">Max<br />HP</span></th>
                  <th className="compact-table-heading-cell"><span className="compact-table-heading-label">Temp HP</span></th>
                </tr>
              </thead>
              <tbody>
                {state.encounter.combatants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">Add combatants to build the encounter.</td>
                  </tr>
                ) : null}
                {orderedCombatants.map((combatant) => {
                  const orderedIndex = orderedCombatants.findIndex((item) => item.id === combatant.id);
                  const previousCombatant = orderedIndex > 0 ? orderedCombatants[orderedIndex - 1] : null;
                  const canMoveUpWithinInitiative =
                    combatant.initiative !== null &&
                    previousCombatant?.initiative === combatant.initiative;
                  const isNameEditable = isCombatantEditMode || editableNameIds.includes(combatant.id);
                  const isTypeEditable = isCombatantEditMode || editableTypeIds.includes(combatant.id);
                  const isDeleteArmed = armedDeleteId === combatant.id;

                  return (
                    <tr key={combatant.id}>
                      <td>
                        <div className="name-cell">
                          {isCombatantEditMode ? (
                            <button
                              type="button"
                              className={`delete-combatant-button${isDeleteArmed ? " armed" : ""}`}
                              aria-label={isDeleteArmed ? `Confirm delete ${combatant.name || combatant.id}` : `Delete ${combatant.name || combatant.id}`}
                              onClick={() => {
                                if (isDeleteArmed) {
                                  deleteCombatant(combatant.id);
                                  return;
                                }

                                toggleDeleteArm(combatant.id);
                              }}
                            >
                              {isDeleteArmed ? "✓" : "🗑"}
                            </button>
                          ) : null}
                          {isNameEditable ? (
                            <input
                              className="compact-name-input"
                              aria-label={`Name for ${combatant.id}`}
                              value={combatant.name}
                              onChange={(event) => updateCombatantName(combatant.id, event.target.value)}
                              onBlur={() => lockCombatantName(combatant.id)}
                              placeholder="Combatant name"
                              autoFocus
                            />
                          ) : (
                            <span>{combatant.name}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {isTypeEditable ? (
                          <select
                            className="compact-select-input"
                            aria-label={`Type for ${combatant.name || combatant.id}`}
                            value={combatant.kind}
                            onChange={(event) => updateCombatantType(combatant.id, event.target.value as CombatantKind)}
                            onBlur={() => lockCombatantType(combatant.id)}
                            autoFocus={!isNameEditable}
                          >
                            <option value="player">Player</option>
                            <option value="npc">NPC</option>
                            <option value="monster">Monster</option>
                          </select>
                        ) : (
                          combatant.kind === "player" ? "Player" : combatant.kind === "npc" ? "NPC" : "Monster"
                        )}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Active for ${combatant.name || combatant.id}`}
                          checked={combatant.active !== false}
                          onChange={(event) => updateCombatantActive(combatant.id, event.target.checked)}
                        />
                      </td>
                      <td>
                        <div className="initiative-cell">
                          {canMoveUpWithinInitiative ? (
                            <button
                              type="button"
                              className="initiative-move-button"
                              aria-label={`Move ${combatant.name} up within initiative ${combatant.initiative}`}
                              onClick={() => moveCombatantUpWithinInitiative(combatant.id)}
                            >
                              {"\u2191"}
                            </button>
                          ) : (
                            <span className="initiative-move-spacer" aria-hidden="true" />
                          )}
                          <input
                            className="compact-number-input compact-number-input-short"
                            type="number"
                            aria-label={`Initiative for ${combatant.name}`}
                            value={combatant.initiative ?? ""}
                            onChange={(event) => updateCombatantInitiative(combatant.id, event.target.value)}
                            placeholder="-"
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          className="compact-number-input compact-number-input-medium"
                          type="number"
                          min="0"
                          aria-label={`HP for ${combatant.name}`}
                          value={combatant.hp || ""}
                          onChange={(event) => updateCombatantHp(combatant.id, event.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          className="compact-number-input compact-number-input-medium"
                          type="number"
                          min="0"
                          aria-label={`Max HP for ${combatant.name}`}
                          value={combatant.maxHp || ""}
                          onChange={(event) => updateCombatantMaxHp(combatant, event.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          className="compact-number-input compact-number-input-short"
                          type="number"
                          min="0"
                          aria-label={`Temp HP for ${combatant.name}`}
                          value={combatant.tempHp || ""}
                          onChange={(event) => updateCombatantTempHp(combatant.id, event.target.value)}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="inline-control-row">
            <button type="button" className="secondary section-add-toggle" onClick={addInlineCombatant}>
              New Combatant
            </button>
            <button
              type="button"
              className={`secondary section-add-toggle${isCombatantEditMode ? " active-toggle" : ""}`}
              onClick={toggleCombatantEditMode}
            >
              {isCombatantEditMode ? "Done Edits" : "Edit Combatants"}
            </button>
          </div>

          <div className="button-row encounter-controls">
            <button type="button" className="secondary" onClick={newEncounter}>
              New Encounter
            </button>
            <button type="button" className="secondary" onClick={longRest} disabled={state.encounter.combatants.length === 0}>
              Long Rest
            </button>
            <button type="button" className="secondary" onClick={removeAllConditions} disabled={state.encounter.combatants.length === 0}>
              Remove All Conditions
            </button>
          </div>
        </section>

        <section className="panel combat-panel" aria-labelledby="combat-heading">
          <div className="panel-heading">
            <h2 id="combat-heading">Combat Tracker</h2>
          </div>

          <div className="turn-controls">
            <div className="turn-tool-buttons">
              {!isActionToolOpen ? (
                <button type="button" className="secondary action-tool-control" onClick={openActionTool} disabled={!currentCombatant}>
                  Record Action
                </button>
              ) : (
                <input
                  className="action-tool-control action-search-control"
                  aria-label="Action text"
                  value={actionText}
                  onChange={(event) => setActionText(event.target.value)}
                  onKeyDown={handleActionTextKeyDown}
                  placeholder="Action"
                  autoFocus
                />
              )}
              {!isConditionToolOpen ? (
                <button type="button" className="secondary condition-tool-control" onClick={toggleConditionTool} disabled={activeCombatants.length === 0}>
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
              {!isDamageToolOpen ? (
                <button type="button" className="secondary condition-tool-control" onClick={toggleDamageTool} disabled={activeCombatants.every((combatant) => hp(combatant) <= 0)}>
                  Apply Damage
                </button>
              ) : !isDamageTargeting ? (
                <input
                  className="condition-tool-control condition-search-control"
                  aria-label="Damage amount"
                  value={damageAmount}
                  onChange={handleDamageAmountChange}
                  onKeyDown={handleDamageAmountKeyDown}
                  placeholder="Damage"
                  inputMode="numeric"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className={`condition-tool-control condition-apply-control${selectedDamageTargets.length > 0 ? " ready" : ""}`}
                  onClick={applyDamageToTargets}
                  disabled={selectedDamageTargets.length === 0 || Math.floor(numberFromInput(selectedDamageAmount)) <= 0}
                >
                  Apply {selectedDamageAmount} Damage
                </button>
              )}
            </div>
            <button type="button" className="secondary" onClick={previousTurn} disabled={activeCombatants.length === 0 || isAtEncounterStart}>
              Previous
            </button>
            <div className="current-status" aria-label="Current combatant status">
              <div className="status-heading">
                <strong>{currentCombatant?.name ?? "No combatants"}</strong>
                <span className="status-hp">
                  HP: {currentCombatant ? `${hp(currentCombatant)}/${maxHp(currentCombatant)}` : "0/0"}
                </span>
                <span>{currentCombatant ? `${currentOrderNumber}/${activeCombatants.length}` : "0/0"}</span>
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
                {currentCombatant && tempHp(currentCombatant) > 0 ? (
                  <span className="status-temp-hp">Temp HP: {tempHp(currentCombatant)}</span>
                ) : null}
              </div>
            </div>
            <button type="button" onClick={nextTurn} disabled={activeCombatants.length === 0}>
              Next Turn
            </button>
          </div>

          <div className="turn-order">
            {activeCombatants.map((combatant, index) => {
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
              const isSelectedForDamage = selectedDamageTargets.includes(combatant.id);
              const isDamageSelectable = isDamageToolOpen && isDamageTargeting && hp(combatant) > 0;

              return (
                <article
                  className={[
                    "turn-card",
                    `turn-card-${combatant.kind}`,
                    isCurrent ? "current" : "",
                    hasActedThisRound ? "acted" : "",
                    isConditionToolOpen || isDamageSelectable ? "selectable" : "",
                    isSelectedForCondition || isSelectedForDamage ? "selected" : "",
                    isDamageToolOpen && isDamageTargeting && hp(combatant) <= 0 ? "unavailable" : ""
                  ].filter(Boolean).join(" ")}
                  key={combatant.id}
                  aria-label={`${combatant.name}, ${combatant.kind}, ${index + 1} in initiative order`}
                  aria-selected={isConditionToolOpen ? isSelectedForCondition : isDamageToolOpen && isDamageTargeting ? isSelectedForDamage : undefined}
                  onClick={() => {
                    if (isConditionToolOpen) {
                      toggleConditionTarget(combatant.id);
                      return;
                    }

                    if (isDamageToolOpen && isDamageTargeting) {
                      toggleDamageTarget(combatant.id);
                    }
                  }}
                >
                  <strong>{combatant.name}</strong>
                  <div className="turn-card-hp-row">
                    {tempHp(combatant) > 0 ? (
                      <span className="turn-card-temp-hp">{tempHp(combatant)}</span>
                    ) : null}
                    <span className="turn-card-hp">{hp(combatant)}/{maxHp(combatant)}</span>
                  </div>
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
            {state.encounter.actionLog.length === 0 ? (
              <p className="empty">Actions recorded here stay with this encounter.</p>
            ) : null}
            {state.encounter.actionLog
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
    </main>
  );
}

export default App;
