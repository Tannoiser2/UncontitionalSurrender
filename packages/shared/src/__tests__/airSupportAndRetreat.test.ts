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
  GameState,
  HexCoord
} from "../types";
import {
  getEligibleAirSupporters,
  getAirCombatPreview,
  computeLegalRetreatHexes,
  coordKey,
  neighborsOf
} from "../engine";

// 6.2.3: l'unità aerea deve essere della stessa nazionalità del difensore o di
// una delle unità terrestri attaccanti.
// Player Aid (Air Combat DRM): il -2 del bomber è nella colonna
// "Attacker or Defender", quindi vale anche in difesa.

const ATT: HexCoord = { q: 0, r: 0 };
const DEF: HexCoord = { q: 1, r: 0 };

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

const makeUnit = (over: Partial<Unit> & { id: string; side: Side; position: HexCoord }): Unit => ({
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

const makeState = (units: Unit[]): GameState => {
  const map = new Map<string, ReturnType<typeof makeHex>>();
  for (let q = -2; q <= 4; q++) {
    for (let r = -2; r <= 4; r++) map.set(coordKey({ q, r }), makeHex(q, r));
  }
  const unitMap = new Map<string, Unit>();
  units.forEach((u) => unitMap.set(u.id, u));
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
    units: unitMap,
    map: map as unknown as GameState["map"],
    riverEdges: new Set<string>(),
    mountainEdges: new Set<string>(),
    straitEdges: new Set<string>(),
    impassableEdges: new Set<string>(),
    history: [],
    timestamp: new Date()
  } as unknown as GameState;
};

const attacker = makeUnit({ id: "att", side: Side.AXIS, position: ATT, country: "Germany" });
const defender = makeUnit({ id: "def", side: Side.ALLIED, position: DEF, country: "France" });
const air = (id: string, side: Side, country: string, over: Partial<Unit> = {}) =>
  makeUnit({ id, side, position: { q: 2, r: 0 }, type: UnitType.AIR, country, sorties: 0, ...over });

describe("Air Support — vincolo di nazionalità (6.2.3)", () => {
  it("l'attaccante può impegnare un aereo della nazionalità di un'unità attaccante", () => {
    const state = makeState([attacker, defender, air("luft", Side.AXIS, "Germany")]);
    const eligible = getEligibleAirSupporters(state, "att", "def", [], Side.AXIS).map((u) => u.id);
    expect(eligible).toContain("luft");
  });

  it("l'attaccante NON può impegnare un aereo di un'altra nazionalità", () => {
    const state = makeState([attacker, defender, air("regia", Side.AXIS, "Italy")]);
    const eligible = getEligibleAirSupporters(state, "att", "def", [], Side.AXIS).map((u) => u.id);
    expect(eligible).not.toContain("regia");
  });

  it("un'unità attaccante addizionale rende eleggibile la sua nazionalità", () => {
    const italian = makeUnit({ id: "add", side: Side.AXIS, position: { q: 0, r: 1 }, country: "Italy" });
    const state = makeState([attacker, defender, italian, air("regia", Side.AXIS, "Italy")]);
    const eligible = getEligibleAirSupporters(state, "att", "def", ["add"], Side.AXIS).map((u) => u.id);
    expect(eligible).toContain("regia");
  });

  it("il difensore può impegnare solo aerei della propria nazionalità", () => {
    const state = makeState([
      attacker,
      defender,
      air("armee", Side.ALLIED, "France"),
      air("raf", Side.ALLIED, "UK")
    ]);
    const eligible = getEligibleAirSupporters(state, "att", "def", [], Side.ALLIED).map((u) => u.id);
    expect(eligible).toContain("armee");
    expect(eligible).not.toContain("raf");
  });

  it("resta valido il limite di raggio di 5 esagoni", () => {
    const state = makeState([attacker, defender, air("luft", Side.AXIS, "Germany", { position: { q: 9, r: 9 } })]);
    expect(getEligibleAirSupporters(state, "att", "def", [], Side.AXIS)).toHaveLength(0);
  });
});

describe("Air Combat — bomber -2 anche in difesa", () => {
  const previewFor = (defenderIsBomber: boolean) => {
    const attackerAir = air("att_air", Side.AXIS, "Germany");
    const defenderAir = air("def_air", Side.ALLIED, "UK", { bomber: defenderIsBomber });
    const state = makeState([attackerAir, defenderAir]);
    return getAirCombatPreview(state, attackerAir, defenderAir);
  };

  it("un caccia in difesa non subisce il malus", () => {
    expect(previewFor(false).defenderModifier).toBe(1); // solo +1 UK
  });

  it("un bomber in difesa subisce -2", () => {
    expect(previewFor(true).defenderModifier).toBe(1 - 2);
  });
});

describe("Ritirata e forti (5.3.5 / 5.3.5.1)", () => {
  // Hex di ritirata plausibile: adiacente al difensore e lontano dall'attaccante.
  const awayFromAttacker = neighborsOf(DEF).filter(
    (c) => coordKey(c) !== coordKey(ATT) && Math.max(Math.abs(c.q - ATT.q), Math.abs(c.r - ATT.r)) > 1
  );

  const optionsWith = (extra: Unit[]): string[] => {
    const state = makeState([attacker, defender, ...extra]);
    return computeLegalRetreatHexes(state, state.units.get("def")!, [state.units.get("att")!]).map(coordKey);
  };

  it("senza forti ci sono hex di ritirata disponibili", () => {
    expect(optionsWith([]).length).toBeGreaterThan(0);
  });

  it("un forte AMICO nell'hex NON impedisce la ritirata (5.3.5)", () => {
    const target = awayFromAttacker[0];
    const friendlyFort = makeUnit({ id: "fort", side: Side.ALLIED, position: target, type: UnitType.FORT, country: "France" });
    expect(optionsWith([friendlyFort])).toContain(coordKey(target));
  });

  it("un forte NEMICO nell'hex impedisce la ritirata (5.3.5.1)", () => {
    const target = awayFromAttacker[0];
    const enemyFort = makeUnit({ id: "fort", side: Side.AXIS, position: target, type: UnitType.FORT, country: "Germany" });
    expect(optionsWith([enemyFort])).not.toContain(coordKey(target));
  });
});
