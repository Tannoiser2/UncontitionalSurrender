import { describe, expect, it } from "vitest";
import {
  GamePhase,
  GameSubPhase,
  Side,
  TerrainType,
  Unit,
  UnitStatus,
  UnitType,
  WeatherMapCategory,
  WeatherType,
  AttackType,
  GameState
} from "../types";
import { getCombatPreview, coordKey } from "../engine";

// 13.1 Airdrop: "If an enemy air or ground unit in the placement hex is attacked
// during the phase, the defending unit applies a combat -2 DRM."
// Non è un bonus all'attaccante e non si estende agli hex adiacenti.

const ATT = { q: 0, r: 0 };
const DEF = { q: 1, r: 0 };

const makeHex = (q: number, r: number) => ({
  coord: { q, r },
  terrain: TerrainType.PLAIN,
  terrainTags: ["plain"],
  features: {
    city: false,
    port: false,
    productionCenter: false,
    capital: false,
    prohibited: false,
    fadedDot: false
  },
  railEdges: [],
  zoc: new Set<string>(),
  units: [] as string[],
  supply: 10
});

const makeUnit = (over: Partial<Unit> & { id: string; side: Side; position: { q: number; r: number } }): Unit => ({
  name: over.id,
  type: UnitType.INFANTRY,
  strength: 3,
  maxStrength: 3,
  status: UnitStatus.READY,
  morale: 8,
  moved: false,
  combat: false,
  leadership: 0,
  ...over
});

const makeState = (airdropAxis: string[] = []): GameState => {
  const map = new Map<string, ReturnType<typeof makeHex>>();
  for (let q = -1; q <= 3; q++) map.set(coordKey({ q, r: 0 }), makeHex(q, 0));
  const units = new Map<string, Unit>();
  [
    makeUnit({ id: "att", side: Side.AXIS, position: ATT, country: "Germany" }),
    makeUnit({ id: "def", side: Side.ALLIED, position: DEF, country: "France" })
  ].forEach((u) => units.set(u.id, u));
  return {
    id: "test",
    turn: 1,
    turnCode: "May-40",
    phase: GamePhase.OPERATIONS,
    subPhase: GameSubPhase.ACTIONS,
    currentSide: Side.AXIS,
    weather: WeatherType.FAIR,
    weatherMap: WeatherMapCategory.OTHER_MAPS,
    factionCards: {
      [Side.AXIS]: { side: Side.AXIS, productionPoints: {}, nationalWill: {}, eventsBox: [], eliminatedBox: [], mobilizationBox: [] },
      [Side.ALLIED]: { side: Side.ALLIED, productionPoints: {}, nationalWill: {}, eventsBox: [], eliminatedBox: [], mobilizationBox: [] }
    },
    units,
    map: map as unknown as GameState["map"],
    riverEdges: new Set<string>(),
    mountainEdges: new Set<string>(),
    straitEdges: new Set<string>(),
    impassableEdges: new Set<string>(),
    airdropMarkers: { [Side.AXIS]: airdropAxis, [Side.ALLIED]: [] },
    history: [],
    timestamp: new Date()
  } as unknown as GameState;
};

const preview = (state: GameState) =>
  getCombatPreview(state, state.units.get("att")!, state.units.get("def")!, { attackType: AttackType.MOBILE });

describe("Airdrop (13.1) — effetto in combattimento", () => {
  it("senza marker nessuno dei due lati è modificato dall'airdrop", () => {
    const base = preview(makeState());
    expect(base.attackerModifier).toBe(2); // solo il +2 Germania
    expect(base.defenderModifier).toBe(1); // solo il +1 Western
  });

  it("marker sull'hex del difensore: -2 al DIFENSORE, attaccante invariato", () => {
    const withMarker = preview(makeState([coordKey(DEF)]));
    expect(withMarker.attackerModifier).toBe(2);
    expect(withMarker.defenderModifier).toBe(1 - 2);
  });

  it("marker su un hex adiacente non ha alcun effetto", () => {
    const adjacent = preview(makeState([coordKey({ q: 2, r: 0 })]));
    expect(adjacent.attackerModifier).toBe(2);
    expect(adjacent.defenderModifier).toBe(1);
  });

  it("marker sull'hex dell'attaccante non ha alcun effetto", () => {
    const onAttacker = preview(makeState([coordKey(ATT)]));
    expect(onAttacker.defenderModifier).toBe(1);
  });

  it("la nota di anteprima descrive il malus al difensore", () => {
    const notes = preview(makeState([coordKey(DEF)])).airSupportNote ?? "";
    expect(notes).toContain("difensore");
    expect(notes).not.toContain("+1 DRM attaccante");
  });
});
