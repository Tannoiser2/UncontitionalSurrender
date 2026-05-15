import { describe, expect, it } from "vitest";
import {
  AttackType,
  GamePhase,
  GameSubPhase,
  Side,
  SupplyState,
  TerrainType,
  Unit,
  UnitStatus,
  UnitType,
  WeatherMapCategory,
  WeatherType,
  GameState
} from "../types";
import { computeAttackerDrm, edgeKey } from "../engine";

// Fixture minima: due hex pianura adiacenti, attacker su (0,0), defender su (1,0).
const ATT_POS = { q: 0, r: 0 };
const DEF_POS = { q: 1, r: 0 };

const makeHex = (q: number, r: number, terrain = TerrainType.PLAIN, country?: string) => ({
  coord: { q, r },
  terrain,
  terrainTags: ["plain" as const],
  features: {
    country,
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

const makeUnit = (overrides: Partial<Unit> & { id: string; side: Side; position: { q: number; r: number } }): Unit => ({
  name: overrides.id,
  country: undefined,
  type: UnitType.INFANTRY,
  strength: 3,
  maxStrength: 3,
  status: UnitStatus.READY,
  morale: 8,
  moved: false,
  combat: false,
  leadership: 0,
  ...overrides
});

const makeState = (over: Omit<Partial<GameState>, "units"> & { units?: Unit[]; weather?: WeatherType } = {}): GameState => {
  const map = new Map<string, ReturnType<typeof makeHex>>();
  map.set("0,0", makeHex(0, 0));
  map.set("1,0", makeHex(1, 0));
  const units = new Map<string, Unit>();
  (over.units || []).forEach((u) => units.set(u.id, u));
  const { units: _ignore, ...rest } = over;
  return {
    id: "test",
    turn: 1,
    turnCode: "T1",
    phase: GamePhase.MOVEMENT,
    subPhase: GameSubPhase.ACTIONS,
    currentSide: Side.AXIS,
    weather: over.weather ?? WeatherType.FAIR,
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
    history: [],
    timestamp: new Date(),
    ...rest
  } as GameState;
};

const att = (over: Partial<Unit> = {}): Unit =>
  makeUnit({ id: "att", side: Side.AXIS, position: ATT_POS, country: "Germany", ...over });
const def = (over: Partial<Unit> = {}): Unit =>
  makeUnit({ id: "def", side: Side.ALLIED, position: DEF_POS, country: "France", ...over });

const drmFor = (state: GameState, extra?: { attackType?: AttackType; amph?: boolean; addl?: Unit[] }) => {
  const a = state.units.get("att")!;
  const d = state.units.get("def")!;
  return computeAttackerDrm(state, a, extra?.addl ?? [], d, extra?.attackType ?? AttackType.MOBILE, extra?.amph ?? false);
};

describe("computeAttackerDrm — nazionalità e modificatori unità", () => {
  it("Germany attacker dà +2", () => {
    const s = makeState({ units: [att({ country: "Germany" }), def()] });
    expect(drmFor(s).germanyUnit).toBe(2);
  });

  it("France/UK/USA attacker dà +1", () => {
    for (const country of ["France", "UK", "USA"]) {
      const s = makeState({ units: [att({ country }), def()] });
      expect(drmFor(s).westernUnit, country).toBe(1);
    }
  });

  it("Elite dà +1", () => {
    const s = makeState({ units: [att({ elite: true }), def()] });
    expect(drmFor(s).elite).toBe(1);
  });

  it("Reduced attacker dà -2", () => {
    const s = makeState({ units: [att({ reduced: true }), def()] });
    expect(drmFor(s).reduced).toBe(-2);
  });

  it("Low supply attacker dà -2", () => {
    const s = makeState({ units: [att({ supplyState: SupplyState.LOW }), def()] });
    expect(drmFor(s).lowSupply).toBe(-2);
  });
});

describe("computeAttackerDrm — Tank weather", () => {
  it("Tank con Fair weather dà +2", () => {
    const s = makeState({ weather: WeatherType.FAIR, units: [att({ type: UnitType.ARMOR }), def()] });
    expect(drmFor(s).tankFair).toBe(2);
    expect(drmFor(s).tankPoor).toBe(0);
  });

  it("Tank con Poor weather dà +1", () => {
    const s = makeState({ weather: WeatherType.POOR, units: [att({ type: UnitType.ARMOR }), def()] });
    expect(drmFor(s).tankFair).toBe(0);
    expect(drmFor(s).tankPoor).toBe(1);
  });

  it("Tank con Severe weather: nessun bonus tank, ma severeWeatherHalving", () => {
    const s = makeState({ weather: WeatherType.SEVERE, units: [att({ type: UnitType.ARMOR }), def()] });
    expect(drmFor(s).tankFair).toBe(0);
    expect(drmFor(s).tankPoor).toBe(0);
    expect(drmFor(s).severeWeatherHalving).toBe(true);
  });
});

describe("computeAttackerDrm — weather attaccante", () => {
  it("Attacking in Poor weather dà -1", () => {
    const s = makeState({ weather: WeatherType.POOR, units: [att(), def()] });
    expect(drmFor(s).attackerVsPoorWeather).toBe(-1);
  });

  it("Fair weather: nessun malus poor", () => {
    const s = makeState({ weather: WeatherType.FAIR, units: [att(), def()] });
    expect(drmFor(s).attackerVsPoorWeather).toBe(0);
  });
});

describe("computeAttackerDrm — terreno e hexside", () => {
  it("River edge dà -1 (attacker crossing river/mountain)", () => {
    const s = makeState({ units: [att(), def()] });
    s.riverEdges.add(edgeKey(ATT_POS, DEF_POS));
    expect(drmFor(s).attackerCrossingRiverOrMountain).toBe(-1);
  });

  it("Mountain edge dà -1", () => {
    const s = makeState({ units: [att(), def()] });
    s.mountainEdges.add(edgeKey(ATT_POS, DEF_POS));
    expect(drmFor(s).attackerCrossingRiverOrMountain).toBe(-1);
  });

  it("Strait edge dà -2", () => {
    const s = makeState({ units: [att(), def()] });
    s.straitEdges.add(edgeKey(ATT_POS, DEF_POS));
    expect(drmFor(s).attackerCrossingStrait).toBe(-2);
  });

  it("Strait edge non si applica in attacco anfibio", () => {
    const s = makeState({ units: [att(), def()] });
    s.straitEdges.add(edgeKey(ATT_POS, DEF_POS));
    expect(drmFor(s, { amph: true }).attackerCrossingStrait).toBe(0);
  });

  it("Senza strait edge attivo, il DRM rimane 0", () => {
    const s = makeState({ units: [att(), def()] });
    expect(drmFor(s).attackerCrossingStrait).toBe(0);
  });

  it("River + Strait sommano correttamente nel totale (Germany +2 attaccante)", () => {
    const s = makeState({ units: [att(), def()] });
    s.riverEdges.add(edgeKey(ATT_POS, DEF_POS));
    s.straitEdges.add(edgeKey(ATT_POS, DEF_POS));
    const d = drmFor(s);
    expect(d.attackerCrossingRiverOrMountain).toBe(-1);
    expect(d.attackerCrossingStrait).toBe(-2);
    // Su fixture 2-hex il defender è sempre Isolated (+2). Germany +2 + isolated +2 - river 1 - strait 2 = +1.
    expect(d.total).toBe(1);
  });
});

describe("computeAttackerDrm — city/rough", () => {
  it("Difensore in città dà -1 all'attaccante", () => {
    const s = makeState({ units: [att(), def()] });
    const hex = (s.map as Map<string, ReturnType<typeof makeHex>>).get("1,0")!;
    hex.features.city = true;
    expect(drmFor(s).attackerVsCityRough).toBe(-1);
  });
});

describe("computeAttackerDrm — anfibio", () => {
  it("Amphibious: -1 sul DRM", () => {
    const s = makeState({ units: [att(), def()] });
    expect(drmFor(s, { amph: true }).amphibiousAttacker).toBe(-1);
  });

  it("Amphibious non subisce malus river/mountain", () => {
    const s = makeState({ units: [att(), def()] });
    s.riverEdges.add(edgeKey(ATT_POS, DEF_POS));
    s.mountainEdges.add(edgeKey(ATT_POS, DEF_POS));
    expect(drmFor(s, { amph: true }).attackerCrossingRiverOrMountain).toBe(0);
  });
});

describe("computeAttackerDrm — isolated", () => {
  it("Defender senza vicini amici e senza retreat hex è Isolated (+2)", () => {
    const s = makeState({ units: [att(), def()] });
    expect(drmFor(s).isolated).toBe(2);
  });
});

describe("computeAttackerDrm — halving", () => {
  it("No supply attiva halving", () => {
    const s = makeState({ units: [att({ supplyState: SupplyState.NO }), def()] });
    expect(drmFor(s).noSupplyHalving).toBe(true);
  });

  it("Severe weather attiva halving (anche se non c'è no-supply)", () => {
    const s = makeState({ weather: WeatherType.SEVERE, units: [att(), def()] });
    expect(drmFor(s).severeWeatherHalving).toBe(true);
  });
});
