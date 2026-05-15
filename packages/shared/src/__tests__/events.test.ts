import { describe, expect, it } from "vitest";
import {
  calculateNavalEvacuationTargets,
  canCommandUnit,
  canStrategicMove,
  createInitialGameState,
  endSovietCounterattack,
  executeNavalEvacuationTo,
  playMapEventMarker,
  playRasputitsaEvent,
  playSovietCounterattackEvent,
  playStrategicMoveEvent
} from "../engine";
import { AttackType, GamePhase, GameSubPhase, GameState, Side, TerrainType, Unit, UnitStatus, UnitType } from "../types";

const opsState = (scenario: string, side: Side): GameState => ({
  ...createInitialGameState({ scenario }),
  phase: GamePhase.OPERATIONS,
  subPhase: GameSubPhase.ACTIONS,
  currentSide: side
});

const firstMapPlacement = (state: GameState, side: Side, markerId: string): GameState | null => {
  for (const hex of state.map.values()) {
    const next = playMapEventMarker(state, side, markerId, hex.coord);
    if (next) return next;
  }
  return null;
};

const liveGroundUnits = (state: GameState, side: Side): Unit[] =>
  Array.from(state.units.values()).filter((unit) =>
    unit.side === side &&
    unit.type !== UnitType.AIR &&
    unit.type !== UnitType.FORT &&
    unit.status !== UnitStatus.DESTROYED
  );

describe("event markers", () => {
  it("Strategic Move event reopens one extra strategic move after the normal one was used", () => {
    const base = {
      ...createInitialGameState({ scenario: "france1941" }),
      phase: GamePhase.STRATEGIC_MOVEMENT,
      subPhase: GameSubPhase.NONE,
      currentSide: Side.AXIS,
      strategicMoveUsed: { [Side.AXIS]: true }
    };
    const candidate = Array.from(base.units.values()).find((unit) =>
      unit.side === Side.AXIS &&
      unit.type !== UnitType.FORT &&
      canStrategicMove({ ...base, strategicMoveUsed: {} }, unit)
    );
    expect(candidate).toBeDefined();
    expect(canStrategicMove(base, candidate!)).toBe(false);

    const next = playStrategicMoveEvent(base, Side.AXIS, "Strategic Move");

    expect(next).not.toBeNull();
    expect(next!.factionCards[Side.AXIS].eventsBox).not.toContain("Strategic Move");
    expect(next!.strategicMoveUsed?.[Side.AXIS]).toBeUndefined();
    expect(canStrategicMove(next!, candidate!)).toBe(true);
    expect(next!.eventTurnTrack?.some((entry) => entry.markerId === "Strategic Move" && entry.side === Side.AXIS)).toBe(true);
  });

  it("Soviet Counterattack makes Allied Soviet units commandable during Axis operations", () => {
    const base = {
      ...createInitialGameState({ scenario: "barbarossa1941" }),
      phase: GamePhase.OPERATIONS,
      subPhase: GameSubPhase.ACTIONS,
      currentSide: Side.AXIS
    };
    const sovietUnit = Array.from(base.units.values()).find((unit) =>
      unit.side === Side.ALLIED &&
      unit.type !== UnitType.FORT &&
      unit.status !== "destroyed"
    );
    expect(sovietUnit).toBeDefined();
    expect(canCommandUnit(base, sovietUnit!)).toBe(false);

    const next = playSovietCounterattackEvent(base, "Soviet Counterattack");

    expect(next).not.toBeNull();
    expect(next!.sovietCounterattackActive).toBe(true);
    expect(next!.currentSide).toBe(Side.AXIS);
    expect(next!.factionCards[Side.ALLIED].eventsBox).not.toContain("Soviet Counterattack");
    expect(canCommandUnit(next!, sovietUnit!)).toBe(true);

    const finished = endSovietCounterattack(next!);
    expect(finished).not.toBeNull();
    expect(finished!.sovietCounterattackActive).toBe(false);
    expect(canCommandUnit(finished!, sovietUnit!)).toBe(false);
  });

  it.each([
    ["barbarossa1941", Side.AXIS, "Germany Airdrop"],
    ["barbarossa1941", Side.ALLIED, "Partisans"],
    ["france1944", Side.ALLIED, "USA Surprise Attack"]
  ])("%s can place %s only on a legal map hex", (scenario, side, markerId) => {
    const base = opsState(scenario, side);
    expect(base.factionCards[side].eventsBox).toContain(markerId);

    const next = firstMapPlacement(base, side, markerId);

    expect(next).not.toBeNull();
    expect(next!.factionCards[side].eventsBox).not.toContain(markerId);
    expect(next!.mapEventMarkerDetails?.some((detail) => detail.markerId === markerId && detail.side === side)).toBe(true);
    expect(firstMapPlacement(next!, side, markerId)).toBeNull();
  });

  it("Mulberry places only on a coastal non-port hex occupied by a friendly ground unit", () => {
    const base = opsState("france1944", Side.ALLIED);
    const coastalNonPort = Array.from(base.map.values()).find((hex) =>
      (hex.terrain === TerrainType.COASTAL || hex.terrainTags.includes("coast")) &&
      !hex.features.port &&
      !hex.features.prohibited
    );
    const unit = liveGroundUnits(base, Side.ALLIED)[0];
    expect(coastalNonPort).toBeDefined();
    expect(unit).toBeDefined();
    const units = new Map(base.units);
    units.set(unit.id, { ...unit, position: coastalNonPort!.coord });
    const withUnitOnCoast = { ...base, units };

    const next = playMapEventMarker(withUnitOnCoast, Side.ALLIED, "Western Mulberry", coastalNonPort!.coord);

    expect(next).not.toBeNull();
    expect(next!.factionCards[Side.ALLIED].eventsBox).not.toContain("Western Mulberry");
    expect(next!.mapEventMarkerDetails?.some((detail) => detail.markerId === "Western Mulberry" && detail.kind === "mulberry")).toBe(true);
    expect(playMapEventMarker(next!, Side.ALLIED, "Western Mulberry", coastalNonPort!.coord)).toBeNull();
  });

  it("Naval Evacuation moves one eligible UK ground unit, reduces it, and schedules the marker return", () => {
    const scenarios = ["france1940", "france1941", "france1944", "franceItaly1944"];
    const candidate = scenarios.flatMap((scenario) => {
      const state = opsState(scenario, Side.ALLIED);
      return liveGroundUnits(state, Side.ALLIED)
        .filter((unit) => unit.country === "UK")
        .map((unit) => ({ state, unit, targets: calculateNavalEvacuationTargets(state, unit) }))
        .filter((entry) => entry.targets.length > 0);
    })[0];
    expect(candidate).toBeDefined();

    const next = executeNavalEvacuationTo(candidate.state, candidate.unit.id, candidate.targets[0]);

    expect(next).not.toBeNull();
    const moved = next!.units.get(candidate.unit.id)!;
    expect(moved.position).toEqual(candidate.targets[0]);
    expect(moved.reduced).toBe(true);
    expect(moved.activated).toBe(true);
    expect(next!.factionCards[Side.ALLIED].eventsBox.some((id) => id.toLowerCase().includes("naval evacuation"))).toBe(false);
    expect(next!.eventTurnTrack?.some((entry) => entry.markerId.toLowerCase().includes("naval evacuation"))).toBe(true);
  });

  it("Rasputitsa cancels an Axis pending attack and consumes the Soviet marker", () => {
    const base = opsState("barbarossa1941", Side.AXIS);
    const attacker = liveGroundUnits(base, Side.AXIS)[0];
    const defender = liveGroundUnits(base, Side.ALLIED)[0];
    expect(attacker).toBeDefined();
    expect(defender).toBeDefined();
    const units = new Map(base.units);
    units.set(attacker.id, { ...attacker, activated: true, moved: true, movementSpent: 2 });
    const withCombat: GameState = {
      ...base,
      units,
      pendingCombat: {
        kind: "commit",
        attackerId: attacker.id,
        defenderId: defender.id,
        attackType: AttackType.MOBILE,
        additionalAttackerIds: [],
        stage: "attacker"
      }
    };

    const next = playRasputitsaEvent(withCombat, "Rasputitsa");

    expect(next).not.toBeNull();
    expect(next!.pendingCombat).toBeUndefined();
    expect(next!.factionCards[Side.ALLIED].eventsBox).not.toContain("Rasputitsa");
    expect(next!.units.get(attacker.id)?.activated).toBe(false);
    expect(next!.units.get(attacker.id)?.moved).toBe(false);
  });
});
