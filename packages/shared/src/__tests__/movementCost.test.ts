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
  GameState
} from "../types";
import { attackMovementCost, edgeKey } from "../engine";

// Costi di movimento dal Player Aid Sheet (Movement 4.2.3):
//   1 hex chiaro | 1 città/forte AMICO | 2 città/forte NEMICO | 2 rough senza città/forte
//   +1 canale/montagna/fiume | +2 stretto
//   +1 attacco con meteo Fair | +2 attacco con meteo Poor/Severe
// Il beneficio della Transport Line (4.2.3.4) non vale entrando/attaccando in un
// hex con città, forte o unità nemica.

const ATT = { q: 0, r: 0 };
const DEF = { q: 1, r: 0 };

type HexFeatures = {
  country?: string;
  city: boolean;
  port: boolean;
  productionCenter: boolean;
  capital: boolean;
  prohibited: boolean;
  fadedDot: boolean;
  controller?: Side;
};

const makeHex = (
  q: number,
  r: number,
  terrain = TerrainType.PLAIN,
  features: Partial<HexFeatures> = {},
  terrainTags: string[] = ["plain"]
) => ({
  coord: { q, r },
  terrain,
  terrainTags,
  features: {
    city: false,
    port: false,
    productionCenter: false,
    capital: false,
    prohibited: false,
    fadedDot: false,
    ...features
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

const makeState = (
  defenderHex: ReturnType<typeof makeHex>,
  over: { units?: Unit[]; weather?: WeatherType; river?: boolean; mountain?: boolean; strait?: boolean } = {}
): GameState => {
  const map = new Map<string, ReturnType<typeof makeHex>>();
  map.set("0,0", makeHex(0, 0));
  map.set("1,0", defenderHex);
  const units = new Map<string, Unit>();
  (over.units || []).forEach((u) => units.set(u.id, u));
  const crossing = edgeKey(ATT, DEF);
  return {
    id: "test",
    turn: 1,
    turnCode: "May-40",
    phase: GamePhase.OPERATIONS,
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
    riverEdges: new Set<string>(over.river ? [crossing] : []),
    mountainEdges: new Set<string>(over.mountain ? [crossing] : []),
    straitEdges: new Set<string>(over.strait ? [crossing] : []),
    impassableEdges: new Set<string>(),
    history: [],
    timestamp: new Date()
  } as unknown as GameState;
};

const attacker = makeUnit({ id: "att", side: Side.AXIS, position: ATT, country: "Germany" });
const defender = makeUnit({ id: "def", side: Side.ALLIED, position: DEF, country: "France" });
const fort = makeUnit({ id: "fort", side: Side.ALLIED, position: DEF, type: UnitType.FORT, country: "France" });

const costOf = (state: GameState): number => attackMovementCost(state, state.units.get("att")!, DEF);

describe("Costo terreno del bersaglio", () => {
  it("hex chiaro costa 1 (+1 attacco Fair)", () => {
    expect(costOf(makeState(makeHex(1, 0), { units: [attacker, defender] }))).toBe(1 + 1);
  });

  it("hex rough costa 2 (+1 attacco Fair)", () => {
    const hex = makeHex(1, 0, TerrainType.FOREST, {}, ["forest"]);
    expect(costOf(makeState(hex, { units: [attacker, defender] }))).toBe(2 + 1);
  });

  it("città NEMICA costa 2, non 1", () => {
    const hex = makeHex(1, 0, TerrainType.PLAIN, { city: true, controller: Side.ALLIED });
    expect(costOf(makeState(hex, { units: [attacker, defender] }))).toBe(2 + 1);
  });

  it("città AMICA costa 1", () => {
    const hex = makeHex(1, 0, TerrainType.PLAIN, { city: true, controller: Side.AXIS });
    expect(costOf(makeState(hex, { units: [attacker, defender] }))).toBe(1 + 1);
  });

  it("capitale, porto e centro produzione nemici contano come città (2)", () => {
    for (const feature of ["capital", "port", "productionCenter"] as const) {
      const hex = makeHex(1, 0, TerrainType.PLAIN, { [feature]: true, controller: Side.ALLIED });
      expect(costOf(makeState(hex, { units: [attacker, defender] })), feature).toBe(2 + 1);
    }
  });

  it("città nemica in hex rough costa 2, non 4: i costi terreno non si sommano", () => {
    const hex = makeHex(1, 0, TerrainType.FOREST, { city: true, controller: Side.ALLIED }, ["forest"]);
    expect(costOf(makeState(hex, { units: [attacker, defender] }))).toBe(2 + 1);
  });

  it("forte nemico costa 2 anche senza città", () => {
    const hex = makeHex(1, 0);
    expect(costOf(makeState(hex, { units: [attacker, defender, fort] }))).toBe(2 + 1);
  });

  it("forte amico costa 1", () => {
    const friendlyFort = makeUnit({ id: "fort", side: Side.AXIS, position: DEF, type: UnitType.FORT });
    const hex = makeHex(1, 0);
    expect(costOf(makeState(hex, { units: [attacker, defender, friendlyFort] }))).toBe(1 + 1);
  });
});

describe("Costo del lato di esagono", () => {
  it("fiume aggiunge +1", () => {
    expect(costOf(makeState(makeHex(1, 0), { units: [attacker, defender], river: true }))).toBe(1 + 1 + 1);
  });

  it("montagna aggiunge +1", () => {
    expect(costOf(makeState(makeHex(1, 0), { units: [attacker, defender], mountain: true }))).toBe(1 + 1 + 1);
  });

  it("stretto aggiunge +2", () => {
    expect(costOf(makeState(makeHex(1, 0), { units: [attacker, defender], strait: true }))).toBe(1 + 2 + 1);
  });

  it("il lato conta una volta sola: fiume + montagna resta +1", () => {
    const s = makeState(makeHex(1, 0), { units: [attacker, defender], river: true, mountain: true });
    expect(costOf(s)).toBe(1 + 1 + 1);
  });

  it("esempio del regolamento 4.2.1: fiume + città nemica + rough = 3 MP di movimento", () => {
    // "A ground unit moving across a river hexside (+1 MP) into a hex with an
    // enemy city (2 MP) and rough terrain (2 MP) pays three movement points."
    const hex = makeHex(1, 0, TerrainType.FOREST, { city: true, controller: Side.ALLIED }, ["forest"]);
    const s = makeState(hex, { units: [attacker, defender], river: true });
    // attackMovementCost include anche il costo d'attacco per meteo: qui Fair = +1.
    expect(costOf(s) - 1).toBe(3);
  });
});

describe("Costo addizionale d'attacco per meteo", () => {
  it("Fair aggiunge +1, Poor e Severe aggiungono +2", () => {
    const base = makeHex(1, 0);
    expect(costOf(makeState(base, { units: [attacker, defender], weather: WeatherType.FAIR }))).toBe(1 + 1);
    expect(costOf(makeState(base, { units: [attacker, defender], weather: WeatherType.POOR }))).toBe(1 + 2);
    expect(costOf(makeState(base, { units: [attacker, defender], weather: WeatherType.SEVERE }))).toBe(1 + 2);
  });

  it("esempio del regolamento 4.2.3.3: città nemica + fiume + Fair = 4 MP", () => {
    // "This attack cost four MP (2 for the defender's hex that contains an enemy
    // city, +1 for the river hexside, and +1 for Attacking a unit in a hex
    // affected by Fair weather)."
    const hex = makeHex(1, 0, TerrainType.PLAIN, { city: true, controller: Side.ALLIED });
    expect(costOf(makeState(hex, { units: [attacker, defender], river: true }))).toBe(4);
  });

  it("esempio del regolamento 4.2.1: hex chiaro + fiume + Fair = 3 MP", () => {
    // "the total movement point cost of three (1 MP for Clear hex, +1 MP for
    // Moving across a river hexside, and +1 MP for Attacking [in] Fair weather)"
    expect(costOf(makeState(makeHex(1, 0), { units: [attacker, defender], river: true }))).toBe(3);
  });
});
