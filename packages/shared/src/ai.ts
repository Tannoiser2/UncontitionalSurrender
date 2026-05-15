import {
  ActionType,
  CombatResultCode,
  GamePhase,
  GameState,
  GameSubPhase,
  Hex,
  HexCoord,
  Side,
  Unit,
  UnitStatus,
  UnitType,
  WeatherType
} from "./types";
import {
  activateUnitForAction,
  attackMovementCost,
  calculateReachableHexes,
  canCommandUnit,
  commitCombatEventMarker,
  confirmAirCommit,
  designateAssault,
  endUnitActivation,
  getEligibleAirSupporters,
  getEligibleCombatEventMarkers,
  getUnitsOnHex,
  hexDistance,
  initiateMobileAttack,
  isEnemyZoc,
  moveUnit,
  neighborsOf,
  resolveAdvanceChoice,
  resolveDefenderCannotRetreatChoice,
  resolveRetreatChoice,
  sameCoord,
  supplyStateOf
} from "./engine";

export type AiActionKind = "attack" | "move" | "hold" | "pending" | "none";

export interface AiDecision {
  kind: AiActionKind;
  side: Side;
  unitId?: string;
  target?: HexCoord;
  score: number;
  note: string;
}

export interface AiStepResult {
  state: GameState;
  decision: AiDecision;
}

const ENEMY_OF: Record<Side, Side> = {
  [Side.AXIS]: Side.ALLIED,
  [Side.ALLIED]: Side.AXIS
};

const isGroundCombatUnit = (unit: Unit): boolean =>
  unit.type !== UnitType.AIR && unit.type !== UnitType.FORT && unit.status !== UnitStatus.DESTROYED;

const unitStepValue = (unit: Unit): number => {
  const base = unit.type === UnitType.ARMOR ? 4 : unit.type === UnitType.AIR ? 3 : 2;
  const strength = unit.reduced ? 0.55 : 1;
  const supply = supplyStateOf(unit) === "no" ? 0.45 : supplyStateOf(unit) === "low" ? 0.75 : 1;
  return base * strength * supply + unit.morale * 0.12 + unit.leadership * 0.3;
};

const hexObjectiveValue = (hex: Hex | undefined): number => {
  if (!hex) return 0;
  let value = 0;
  if (hex.features.capital) value += 18;
  if (hex.features.productionCenter) value += 12;
  if (hex.features.city) value += 8;
  if (hex.features.port) value += 5;
  return value;
};

const minimumDistanceToEnemy = (state: GameState, coord: HexCoord, side: Side): number => {
  let best = Infinity;
  state.units.forEach((unit) => {
    if (!isGroundCombatUnit(unit) || unit.side === side) return;
    best = Math.min(best, hexDistance(coord, unit.position));
  });
  return Number.isFinite(best) ? best : 0;
};

const evaluateStateForSide = (state: GameState, side: Side): number => {
  let score = 0;
  state.units.forEach((unit) => {
    if (unit.status === UnitStatus.DESTROYED) {
      score += unit.side === side ? -8 : 8;
      return;
    }
    const value = unitStepValue(unit);
    score += unit.side === side ? value : -value;
    if (unit.activated && unit.side === side) score -= 0.08;
  });

  state.map.forEach((hex) => {
    const value = hexObjectiveValue(hex);
    if (value === 0) return;
    if (hex.features.controller === side) score += value;
    else if (hex.features.controller === ENEMY_OF[side]) score -= value;
  });

  if (state.victory) {
    if (state.victory.winner === side) score += 1000;
    else if (state.victory.winner === ENEMY_OF[side]) score -= 1000;
  }

  return score;
};

const retreatScore = (state: GameState, coord: HexCoord, side: Side): number => {
  const hex = state.map.get(`${coord.q},${coord.r}`);
  const enemyDistance = minimumDistanceToEnemy(state, coord, side);
  return enemyDistance * 2 + (hex?.features.controller === side ? 2 : 0) + hexObjectiveValue(hex) * 0.2;
};

const combatImportance = (state: GameState, defender: Unit): number => {
  const defenderHex = state.map.get(`${defender.position.q},${defender.position.r}`);
  return unitStepValue(defender) * 3 + hexObjectiveValue(defenderHex);
};

const eventPriority = (eventId: string, committingSide: Side, attackerSide: Side): number => {
  const id = eventId.toLowerCase();
  let score = 0;
  if (id.includes("tanks")) score += 8;
  if (id.includes("ground support")) score += 7;
  if (id.includes("ultra")) score += 7;
  if (id.includes("free forces")) score += 5;
  if (id.includes("snafu")) score += 5;
  if (id.includes("rockets")) score += 4;
  if (id.includes("jets")) score += 3;
  if (committingSide !== attackerSide && (id.includes("snafu") || id.includes("ultra") || id.includes("ground support"))) score += 2;
  return score;
};

const chooseAiCombatEvent = (state: GameState): string | null => {
  const pending = state.pendingCombat;
  if (!pending || pending.kind !== "commit") return null;
  const attacker = state.units.get(pending.attackerId);
  const defender = state.units.get(pending.defenderId);
  if (!attacker || !defender) return null;
  const committingSide = pending.stage === "attacker" ? attacker.side : defender.side;
  const committedEvents = committingSide === attacker.side
    ? pending.eventMarkerAttackerIds || []
    : pending.eventMarkerDefenderIds || [];
  if (committedEvents.length > 0) return null;
  const importance = combatImportance(state, defender);
  const eligible = getEligibleCombatEventMarkers(
    state,
    pending.attackerId,
    pending.defenderId,
    pending.additionalAttackerIds,
    committingSide,
    committedEvents
  );
  if (eligible.length === 0) return null;
  const [best] = eligible.sort(
    (a, b) => eventPriority(b.id, committingSide, attacker.side) - eventPriority(a.id, committingSide, attacker.side)
  );
  if (!best) return null;
  if (eventPriority(best.id, committingSide, attacker.side) + importance * 0.2 < 7) return null;
  return best.id;
};

const chooseAiAirSupport = (state: GameState): Unit | null => {
  const pending = state.pendingCombat;
  if (!pending || pending.kind !== "commit") return null;
  const attacker = state.units.get(pending.attackerId);
  const defender = state.units.get(pending.defenderId);
  if (!attacker || !defender) return null;
  const committingSide = pending.stage === "attacker" ? attacker.side : defender.side;
  const alreadyCommitted = pending.stage === "attacker" ? pending.airSupportAttackerId : pending.airSupportDefenderId;
  if (alreadyCommitted) return null;
  if (combatImportance(state, defender) < 10) return null;
  const eligible = getEligibleAirSupporters(
    state,
    pending.attackerId,
    pending.defenderId,
    pending.additionalAttackerIds,
    committingSide
  );
  if (eligible.length === 0) return null;
  return eligible.sort((a, b) => (a.sorties ?? 0) - (b.sorties ?? 0) || unitStepValue(b) - unitStepValue(a))[0] || null;
};

export const resolveAiPendingCombat = (state: GameState): AiStepResult | null => {
  const pending = state.pendingCombat;
  if (!pending) return null;

  if (pending.kind === "commit") {
    const attacker = state.units.get(pending.attackerId);
    const defender = state.units.get(pending.defenderId);
    const side = pending.stage === "attacker" ? attacker?.side : defender?.side;
    const eventId = chooseAiCombatEvent(state);
    if (eventId) {
      const next = commitCombatEventMarker(state, eventId);
      if (next) {
        return {
          state: next,
          decision: {
            kind: "pending",
            side: side || state.currentSide,
            score: evaluateStateForSide(next, side || state.currentSide),
            note: `IA commit evento: ${eventId}.`
          }
        };
      }
    }
    const air = chooseAiAirSupport(state);
    if (air) {
      const next = confirmAirCommit(state, air.id);
      if (next) {
        return {
          state: next,
          decision: {
            kind: "pending",
            side: side || state.currentSide,
            unitId: air.id,
            score: evaluateStateForSide(next, side || state.currentSide),
            note: `IA commit supporto aereo: ${air.name}.`
          }
        };
      }
    }
    const next = confirmAirCommit(state, null);
    if (!next) return null;
    return {
      state: next,
      decision: {
        kind: "pending",
        side: side || state.currentSide,
        score: evaluateStateForSide(next, side || state.currentSide),
        note: "IA passa il commit aereo/evento."
      }
    };
  }

  if (pending.kind === "retreat") {
    if (pending.allowDefenderCannotRetreat) {
      const noRetreat = resolveDefenderCannotRetreatChoice(state);
      if (noRetreat) {
        const defender = state.units.get(pending.defenderId);
        return {
          state: noRetreat,
          decision: {
            kind: "pending",
            side: defender?.side || ENEMY_OF[state.currentSide],
            score: evaluateStateForSide(noRetreat, defender?.side || ENEMY_OF[state.currentSide]),
            note: "IA sceglie di non ritirarsi dal forte."
          }
        };
      }
    }

    const defender = state.units.get(pending.defenderId);
    const side = defender?.side || ENEMY_OF[state.currentSide];
    const target = [...pending.options].sort((a, b) => retreatScore(state, b, side) - retreatScore(state, a, side))[0];
    const next = target ? resolveRetreatChoice(state, target) : null;
    if (!next) return null;
    return {
      state: next,
      decision: {
        kind: "pending",
        side,
        target,
        score: evaluateStateForSide(next, side),
        note: "IA risolve la ritirata."
      }
    };
  }

  const attacker = state.units.get(pending.attackerId);
  const side = attacker?.side || state.currentSide;
  const attackerId = pending.advanceAttackerIds?.[0] || pending.attackerId;
  const shouldAdvance = pending.forceAdvance || pending.resultCode === CombatResultCode.DE || pending.resultCode === CombatResultCode.DD || pending.resultCode === CombatResultCode.DR;
  const next = resolveAdvanceChoice(state, shouldAdvance, attackerId);
  if (!next) return null;
  return {
    state: next,
    decision: {
      kind: "pending",
      side,
      target: pending.defenderHex,
      score: evaluateStateForSide(next, side),
      note: shouldAdvance ? "IA avanza dopo il combattimento." : "IA rinuncia all'avanzata."
    }
  };
};

const finishPendingChain = (state: GameState): GameState => {
  let next = state;
  for (let i = 0; i < 8 && next.pendingCombat; i += 1) {
    const resolved = resolveAiPendingCombat(next);
    if (!resolved || resolved.state === next) break;
    next = resolved.state;
  }
  return next;
};

const hasFortAt = (state: GameState, coord: HexCoord): boolean =>
  getUnitsOnHex(state, coord).some((unit) => unit.type === UnitType.FORT && unit.status !== UnitStatus.DESTROYED);

const enemyGroundUnitsAdjacentTo = (state: GameState, unit: Unit): Unit[] =>
  neighborsOf(unit.position)
    .flatMap((coord) => getUnitsOnHex(state, coord))
    .filter((target) => isGroundCombatUnit(target) && target.side !== unit.side);

const attackScoreBonus = (defender: Unit): number => 45 + unitStepValue(defender) * 8;

const tryAttack = (state: GameState, attacker: Unit, defender: Unit): GameState | null => {
  const useAssault =
    state.weather === WeatherType.POOR ||
    state.weather === WeatherType.SEVERE ||
    hasFortAt(state, defender.position);

  const cost = attackMovementCost(state, attacker, defender.position);
  if (!Number.isFinite(cost)) return null;

  const next = useAssault
    ? designateAssault(state, attacker.id, defender.position)
    : initiateMobileAttack(state, attacker.id, defender.id);

  return next ? finishPendingChain(next) : null;
};

const moveDestinationScore = (state: GameState, unit: Unit, coord: HexCoord): number => {
  const hex = state.map.get(`${coord.q},${coord.r}`);
  const objective = hexObjectiveValue(hex);
  const captures = hex?.features.controller === ENEMY_OF[unit.side] ? objective * 2 : objective;
  const enemyDistance = minimumDistanceToEnemy(state, coord, unit.side);
  const pressure = enemyDistance > 0 ? Math.max(0, 8 - enemyDistance) : 0;
  const adjacentEnemies = neighborsOf(coord).reduce(
    (count, neighbor) =>
      count + getUnitsOnHex(state, neighbor).filter((target) => isGroundCombatUnit(target) && target.side !== unit.side).length,
    0
  );
  const ezocPenalty = isEnemyZoc(state, coord, unit.side) ? -1.5 : 0;
  return captures + pressure + adjacentEnemies * 18 + ezocPenalty;
};

const adjacentMoveDestinations = (state: GameState, unit: Unit) =>
  calculateReachableHexes(state, unit)
    .filter((move) => hexDistance(unit.position, move.coord) === 1)
    .filter((move) => !sameCoord(move.coord, unit.position))
    .filter((move) =>
      !getUnitsOnHex(state, move.coord).some(
        (occupant) => occupant.side !== unit.side && occupant.status !== UnitStatus.DESTROYED
      )
    );

const addAiHistory = (state: GameState, decision: AiDecision): GameState => ({
  ...state,
  history: [
    {
      type: decision.kind === "attack" ? ActionType.ATTACK : decision.kind === "move" ? ActionType.MOVE : ActionType.HOLD,
      side: decision.side,
      unitId: decision.unitId,
      toPos: decision.target,
      note: decision.note,
      timestamp: new Date()
    },
    ...state.history
  ],
  timestamp: new Date()
});

export const runAiOperationStep = (state: GameState, side: Side = state.currentSide): AiStepResult => {
  const pending = resolveAiPendingCombat(state);
  if (pending) return pending;

  if (state.phase !== GamePhase.OPERATIONS || state.subPhase !== GameSubPhase.ACTIONS || state.currentSide !== side) {
    return {
      state,
      decision: {
        kind: "none",
        side,
        score: evaluateStateForSide(state, side),
        note: "IA disponibile durante la fase Operazioni/Azioni del lato corrente."
      }
    };
  }

  const candidates: AiStepResult[] = [];
  const commandable = Array.from(state.units.values())
    .filter((unit) => canCommandUnit(state, unit))
    .filter((unit) => unit.side === side)
    .sort((a, b) => unitStepValue(b) - unitStepValue(a));

  for (const unit of commandable) {
    const activatedState = unit.moved ? state : activateUnitForAction(state, unit.id);
    if (!activatedState) continue;
    const activeUnit = activatedState.units.get(unit.id);
    if (!activeUnit) continue;

    if (isGroundCombatUnit(activeUnit)) {
      for (const defender of enemyGroundUnitsAdjacentTo(activatedState, activeUnit)) {
        const attacked = tryAttack(activatedState, activeUnit, defender);
        if (!attacked) continue;
        const decision: AiDecision = {
          kind: "attack",
          side,
          unitId: activeUnit.id,
          target: defender.position,
          score: evaluateStateForSide(attacked, side) + attackScoreBonus(defender),
          note: `IA: ${activeUnit.name} attacca ${defender.name}.`
        };
        candidates.push({ state: addAiHistory(attacked, decision), decision });
      }

      const destinations = adjacentMoveDestinations(activatedState, activeUnit)
        .sort((a, b) => moveDestinationScore(activatedState, activeUnit, b.coord) - moveDestinationScore(activatedState, activeUnit, a.coord))
        .slice(0, 6);

      for (const destination of destinations) {
        const moved = moveUnit(activatedState, activeUnit.id, destination.coord);
        const decision: AiDecision = {
          kind: "move",
          side,
          unitId: activeUnit.id,
          target: destination.coord,
          score: evaluateStateForSide(moved, side) + moveDestinationScore(activatedState, activeUnit, destination.coord),
          note: `IA: ${activeUnit.name} muove.`
        };
        candidates.push({ state: addAiHistory(moved, decision), decision });
      }
    }

    const held = endUnitActivation(activatedState, activeUnit.id);
    const holdDecision: AiDecision = {
      kind: "hold",
      side,
      unitId: activeUnit.id,
      score: evaluateStateForSide(held, side) - 0.5,
      note: `IA: ${activeUnit.name} resta in posizione.`
    };
    candidates.push({ state: addAiHistory(held, holdDecision), decision: holdDecision });
  }

  if (candidates.length === 0) {
    const decision: AiDecision = {
      kind: "none",
      side,
      score: evaluateStateForSide(state, side),
      note: "IA: nessuna unita attivabile; termina le azioni del lato."
    };
    return { state: addAiHistory(state, decision), decision };
  }

  return candidates.sort((a, b) => b.decision.score - a.decision.score)[0];
};
