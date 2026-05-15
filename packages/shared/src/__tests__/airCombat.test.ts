import { describe, expect, it } from "vitest";
import {
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
import { getAirCombatPreview, moveUnit } from "../engine";

const ATT_POS = { q: 0, r: 0 };
const DEF_POS = { q: 1, r: 0 };

const makeHex = (q: number, r: number, country?: string) => ({
  coord: { q, r },
  terrain: TerrainType.PLAIN,
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

const makeRailHex = (q: number, r: number, country?: string) => ({
  ...makeHex(q, r, country),
  railEdges: ["W" as const]
});

const makeUnit = (over: Partial<Unit> & { id: string; side: Side; position: { q: number; r: number } }): Unit => ({
  name: over.id,
  country: undefined,
  type: UnitType.AIR,
  strength: 3,
  maxStrength: 3,
  status: UnitStatus.READY,
  morale: 8,
  moved: false,
  combat: false,
  leadership: 0,
  sorties: 0,
  ...over
});

const makeState = (
  over: { units?: Unit[]; weather?: WeatherType; ukAt?: "att" | "def" | "none" } = {}
): GameState => {
  const map = new Map<string, ReturnType<typeof makeHex>>();
  map.set("0,0", makeHex(0, 0, over.ukAt === "att" ? "UK" : undefined));
  map.set("1,0", makeHex(1, 0, over.ukAt === "def" ? "UK" : undefined));
  const units = new Map<string, Unit>();
  (over.units || []).forEach((u) => units.set(u.id, u));
  return {
    id: "test",
    turn: 1,
    turnCode: "T1",
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
    riverEdges: new Set<string>(),
    mountainEdges: new Set<string>(),
    straitEdges: new Set<string>(),
    impassableEdges: new Set<string>(),
    history: [],
    timestamp: new Date()
  } as GameState;
};

const att = (over: Partial<Unit> = {}): Unit =>
  makeUnit({ id: "att", side: Side.AXIS, position: ATT_POS, country: "Germany", ...over });
const def = (over: Partial<Unit> = {}): Unit =>
  makeUnit({ id: "def", side: Side.ALLIED, position: DEF_POS, country: "UK", ...over });

const previewFor = (s: GameState, opts: Parameters<typeof getAirCombatPreview>[3] = {}) => {
  return getAirCombatPreview(s, s.units.get("att")!, s.units.get("def")!, { attackerRoll: 4, defenderRoll: 4, ...opts });
};

describe("Air DRM — nazionalità", () => {
  it("Germany attacker dà +2", () => {
    const s = makeState({ units: [att({ country: "Germany" }), def({ country: undefined })] });
    expect(previewFor(s).attackerModifier).toBe(2);
  });

  it("UK attacker dà +1", () => {
    const s = makeState({ units: [att({ country: "UK", side: Side.ALLIED }), def({ country: undefined })] });
    expect(previewFor(s).attackerModifier).toBe(1);
  });

  it("USA attacker dà +1", () => {
    const s = makeState({ units: [att({ country: "USA", side: Side.ALLIED }), def({ country: undefined })] });
    expect(previewFor(s).attackerModifier).toBe(1);
  });

  it("Defender Germany dà +2", () => {
    const s = makeState({ units: [att({ country: undefined }), def({ country: "Germany", side: Side.AXIS })] });
    expect(previewFor(s).defenderModifier).toBe(2);
  });
});

describe("Air DRM — bomber e supply", () => {
  it("Bomber attacker: -2", () => {
    const s = makeState({ units: [att({ country: undefined, bomber: true }), def({ country: undefined })] });
    expect(previewFor(s).attackerModifier).toBe(-2);
  });

  it("Low supply attacker: -2", () => {
    const s = makeState({ units: [att({ country: undefined, supplyState: SupplyState.LOW }), def({ country: undefined })] });
    expect(previewFor(s).attackerModifier).toBe(-2);
  });

  it("No supply attaccante: halving del finale (no DRM, ma halving sì)", () => {
    // attackerRoll 4 + 0 DRM = 4, halved = 2
    const s = makeState({ units: [att({ country: undefined, supplyState: SupplyState.NO }), def({ country: undefined })] });
    expect(previewFor(s).attackerFinal).toBe(2);
  });
});

describe("Air DRM — meteo", () => {
  it("Poor weather: -2 sia attaccante che difensore", () => {
    const s = makeState({ weather: WeatherType.POOR, units: [att({ country: undefined }), def({ country: undefined })] });
    const p = previewFor(s);
    expect(p.attackerModifier).toBe(-2);
    expect(p.defenderModifier).toBe(-2);
  });

  it("Severe weather: halving sia attaccante che difensore", () => {
    // 4 + 0 = 4 → halved = 2
    const s = makeState({ weather: WeatherType.SEVERE, units: [att({ country: undefined }), def({ country: undefined })] });
    const p = previewFor(s);
    expect(p.attackerFinal).toBe(2);
    expect(p.defenderFinal).toBe(2);
  });
});

describe("Air DRM — sortite e jets", () => {
  it("Sortite ridotte di sortie count", () => {
    const s = makeState({ units: [att({ country: undefined, sorties: 2 }), def({ country: undefined })] });
    expect(previewFor(s).attackerModifier).toBe(-2);
  });

  it("Jets attacker: +2", () => {
    const s = makeState({ units: [att({ country: undefined }), def({ country: undefined })] });
    expect(previewFor(s, { attackerJets: true }).attackerModifier).toBe(2);
  });
});

describe("Air DRM — Britain defense", () => {
  it("UK/USA defender in hex UK contro attaccante non in UK, isAirStrike: +2", () => {
    const s = makeState({ ukAt: "def", units: [att({ country: undefined }), def({ country: "UK" })] });
    const p = previewFor(s, { isAirStrike: true });
    // UK defender: westernUnit +1, Britain Defense +2 = +3
    expect(p.defenderModifier).toBe(3);
  });

  it("Britain defense non si applica se attaccante è anch'esso in UK", () => {
    const s = makeState({ ukAt: "att", units: [att({ country: undefined }), def({ country: "UK" })] });
    // map ha UK su attaccante ma non difensore: difensore prende solo westernUnit +1
    const p = previewFor(s, { isAirStrike: true });
    expect(p.defenderModifier).toBe(1);
  });

  it("Britain defense non si applica se isAirStrike è false (ground support)", () => {
    const s = makeState({ ukAt: "def", units: [att({ country: undefined }), def({ country: "UK" })] });
    const p = previewFor(s, { isAirStrike: false });
    expect(p.defenderModifier).toBe(1);
  });
});

describe("Air combat preview — risultato CRT", () => {
  it("Germany +2 vs neutrale: attFinal=6 defFinal=4 → cella riga 4 col 6 = DR+2", () => {
    const s = makeState({ units: [att({ country: "Germany" }), def({ country: undefined })] });
    const p = previewFor(s);
    expect(p.attackerFinal).toBe(6);
    expect(p.defenderFinal).toBe(4);
    expect(p.resultCode).toBe("DR");
    expect(p.resultBonus).toBe(2);
  });

  it("clamp a 1 quando final negativo (Reduced reso impossibile ma proviamo low supply estremo)", () => {
    // attacker low supply -2 + sortie -5 = -7, rollo 4 → 4-7 = -3, clamped a 1
    const s = makeState({ units: [att({ country: undefined, sorties: 5, supplyState: SupplyState.LOW }), def({ country: undefined })] });
    expect(previewFor(s).attackerFinal).toBe(1);
  });
});

describe("4.2.3.7 Air Displacement", () => {
  it("sposta una air nemica con movimento aereo anche a 6 sortite, senza attivarla", () => {
    const ground = makeUnit({
      id: "ground",
      side: Side.AXIS,
      country: "Germany",
      type: UnitType.INFANTRY,
      position: { q: 0, r: 0 },
      sorties: undefined
    });
    const air = def({
      id: "air",
      position: { q: 1, r: 0 },
      sorties: 6,
      activated: false,
      moved: false
    });
    const s = makeState({ units: [ground, air] });
    s.map.set("2,0", makeRailHex(2, 0, "UK") as GameState["map"] extends Map<string, infer H> ? H : never);

    const next = moveUnit(s, "ground", { q: 1, r: 0 });
    const displaced = next.units.get("air")!;

    expect(displaced.position).toEqual({ q: 2, r: 0 });
    expect(displaced.sorties).toBe(6);
    expect(displaced.activated).toBe(false);
    expect(displaced.moved).toBe(false);
    expect(next.history.some((entry) => entry.note?.includes("Air Displacement"))).toBe(true);
  });
});
