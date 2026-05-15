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
import { canCommandUnit } from "../engine";

// ── Minimal fixture ───────────────────────────────────────────────────────────

const makeHex = (q: number, r: number, opts: { country?: string; port?: boolean } = {}) => ({
  coord: { q, r },
  terrain: TerrainType.PLAIN,
  terrainTags: ["plain" as const],
  features: {
    country: opts.country,
    controller: Side.AXIS as Side | "neutral" | undefined,
    city: false,
    port: opts.port ?? false,
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
  country: over.country ?? "Germany",
  type: UnitType.INFANTRY,
  strength: 3,
  maxStrength: 3,
  status: UnitStatus.READY,
  morale: 8,
  moved: false,
  combat: false,
  leadership: 0,
  sorties: 0,
  activated: false,
  ...over
});

const makeFnaState = (over: { units?: Unit[]; turn?: number } = {}): GameState => {
  const map = new Map();
  map.set("0,0", makeHex(0, 0));
  map.set("1,0", makeHex(1, 0));
  const units = new Map<string, Unit>();
  (over.units || []).forEach((u) => units.set(u.id, u));
  return {
    id: "test",
    turn: over.turn ?? 1,
    turnCode: "Nov-42",
    scenarioId: "frenchNorthAfrica1942" as GameState["scenarioId"],
    phase: GamePhase.OPERATIONS,
    subPhase: GameSubPhase.ACTIONS,
    currentSide: Side.AXIS,
    weather: WeatherType.FAIR,
    weatherMap: WeatherMapCategory.BALKANS_FNA_ITALY,
    factionCards: {
      [Side.AXIS]: {
        side: Side.AXIS,
        productionPoints: { Germany: null, Italy: null, "Fr.N.Africa": 2 },
        nationalWill: { Germany: null, Italy: null, "Fr.N.Africa": 5 },
        eventsBox: [],
        eliminatedBox: [],
        mobilizationBox: []
      },
      [Side.ALLIED]: {
        side: Side.ALLIED,
        productionPoints: { UK: null, USA: null },
        nationalWill: { UK: null, USA: null },
        eventsBox: [],
        eliminatedBox: [],
        mobilizationBox: []
      }
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

// ── Tests: Germany 5 Pz T1 restriction ───────────────────────────────────────

describe("FNA 1942: Germany 5 Pz non puo attivarsi al turno 1", () => {
  const g5pz = makeUnit({ id: "germany_5_pz", side: Side.AXIS, position: { q: 0, r: 0 } });
  const otherAxisUnit = makeUnit({ id: "germany_10", side: Side.AXIS, position: { q: 1, r: 0 } });

  it("germany_5_pz T1: canCommandUnit = false", () => {
    const s = makeFnaState({ units: [g5pz], turn: 1 });
    expect(canCommandUnit(s, g5pz)).toBe(false);
  });

  it("altra unita Asse T1: canCommandUnit = true", () => {
    const s = makeFnaState({ units: [otherAxisUnit], turn: 1 });
    expect(canCommandUnit(s, otherAxisUnit)).toBe(true);
  });

  it("germany_5_pz T2: canCommandUnit = true", () => {
    const s = makeFnaState({ units: [g5pz], turn: 2 });
    expect(canCommandUnit(s, g5pz)).toBe(true);
  });
});

// ── Tests: Allied force-invasions pending ─────────────────────────────────────

describe("FNA 1942: prime due azioni Alleate devono essere invasioni iniziali", () => {
  // Con nessuna invasione completata, solo le unita FNA initial invasion sono comandabili.
  // Qui testiamo che un'altra unita Alleata sia bloccata finche le invasioni non sono completate.
  const uk1Can = makeUnit({ id: "uk_1_can", side: Side.ALLIED, position: { q: 0, r: 0 }, mapPresence: "east_na" as Unit["mapPresence"] });
  const usaTskFrc = makeUnit({ id: "usa_tsk_frc", side: Side.ALLIED, position: { q: 0, r: 0 }, mapPresence: "east_na" as Unit["mapPresence"] });
  const otherAllied = makeUnit({ id: "uk_other", side: Side.ALLIED, position: { q: 0, r: 0 }, country: "UK" });

  const makeFnaAlliedState = (units: Unit[], turn = 1): GameState => {
    const base = makeFnaState({ units, turn });
    return { ...base, currentSide: Side.ALLIED };
  };

  it("con 0 invasioni completate: unita non-FNA Alleata non puo attivarsi", () => {
    const s = makeFnaAlliedState([uk1Can, usaTskFrc, otherAllied]);
    expect(canCommandUnit(s, otherAllied)).toBe(false);
  });

  it("con 0 invasioni completate: uk_1_can puo attivarsi", () => {
    const s = makeFnaAlliedState([uk1Can, usaTskFrc, otherAllied]);
    expect(canCommandUnit(s, uk1Can)).toBe(true);
  });
});
