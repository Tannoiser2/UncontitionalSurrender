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
import { isEnemyZoc, movesBetweenSameEnemyZoc, neighborsOf, coordKey } from "../engine";

// Regola 4.2.3.1 (EZOC Restrictions):
//  • Un'unità non può muovere direttamente fra due hex che contengono l'EZOC
//    esercitata dalla STESSA unità nemica.
//  • A inizio attivazione può invece entrare in un hex con EZOC di un'unità
//    DIVERSA, purché non violi la regola precedente.
// Regola 14.8: nessuna EZOC è esercitata in un hex con marker No EZOC.

const makeHex = (q: number, r: number, noEzocMarker = false) => ({
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
  supply: 10,
  noEzocMarker
});

const makeUnit = (id: string, side: Side, position: HexCoord): Unit => ({
  id,
  name: id,
  side,
  position,
  type: UnitType.INFANTRY,
  strength: 3,
  maxStrength: 3,
  status: UnitStatus.READY,
  morale: 8,
  moved: false,
  combat: false,
  leadership: 0
});

// Griglia 5x5 così che tutti gli hex usati esistano.
const makeState = (units: Unit[], noEzocAt: HexCoord[] = []): GameState => {
  const map = new Map<string, ReturnType<typeof makeHex>>();
  for (let q = -1; q <= 4; q++) {
    for (let r = -1; r <= 4; r++) {
      const flagged = noEzocAt.some((c) => c.q === q && c.r === r);
      map.set(coordKey({ q, r }), makeHex(q, r, flagged));
    }
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

describe("EZOC — regola della stessa unità (4.2.3.1)", () => {
  // Nemico in (2,2): esercita ZOC su tutti i suoi sei adiacenti.
  const enemy = makeUnit("fr10", Side.ALLIED, { q: 2, r: 2 });
  const around = neighborsOf({ q: 2, r: 2 });

  it("vietato muovere fra due hex nella ZOC della STESSA unità", () => {
    const state = makeState([enemy]);
    // Due adiacenti del nemico che siano anche adiacenti fra loro.
    const pairs = around.flatMap((a) =>
      neighborsOf(a)
        .filter((b) => around.some((x) => x.q === b.q && x.r === b.r))
        .map((b) => [a, b] as const)
    );
    expect(pairs.length).toBeGreaterThan(0);
    pairs.forEach(([from, to]) => {
      expect(
        movesBetweenSameEnemyZoc(state, from, to, Side.AXIS),
        `da ${coordKey(from)} a ${coordKey(to)}`
      ).toBe(true);
    });
  });

  it("consentito muovere verso la ZOC di un'unità DIVERSA", () => {
    // Due nemici distanti fra loro: le rispettive ZOC non si sovrappongono.
    const enemyA = makeUnit("fr10", Side.ALLIED, { q: 0, r: 0 });
    const enemyB = makeUnit("fr6", Side.ALLIED, { q: 3, r: 0 });
    const state = makeState([enemyA, enemyB]);
    const from = { q: 1, r: 0 }; // solo nella ZOC di A
    const to = { q: 2, r: 0 }; // solo nella ZOC di B
    expect(isEnemyZoc(state, from, Side.AXIS)).toBe(true);
    expect(isEnemyZoc(state, to, Side.AXIS)).toBe(true);
    expect(movesBetweenSameEnemyZoc(state, from, to, Side.AXIS)).toBe(false);
  });

  it("consentito uscire da una EZOC verso un hex senza EZOC", () => {
    const state = makeState([enemy]);
    const from = around[0];
    const far = { q: 4, r: 4 };
    expect(isEnemyZoc(state, far, Side.AXIS)).toBe(false);
    expect(movesBetweenSameEnemyZoc(state, from, far, Side.AXIS)).toBe(false);
  });

  it("nessun vincolo se l'hex di partenza non è in EZOC", () => {
    const state = makeState([enemy]);
    const far = { q: 4, r: 4 };
    expect(movesBetweenSameEnemyZoc(state, far, around[0], Side.AXIS)).toBe(false);
  });
});

describe("Marker No EZOC (14.8)", () => {
  const enemy = makeUnit("fr10", Side.ALLIED, { q: 2, r: 2 });
  const target = neighborsOf({ q: 2, r: 2 })[0];

  it("senza marker l'hex adiacente al nemico è in EZOC", () => {
    expect(isEnemyZoc(makeState([enemy]), target, Side.AXIS)).toBe(true);
  });

  it("con il marker nessuna EZOC è esercitata in quell'hex", () => {
    const state = makeState([enemy], [target]);
    expect(isEnemyZoc(state, target, Side.AXIS)).toBe(false);
  });

  it("il marker vale solo per il proprio hex, non per i vicini", () => {
    const state = makeState([enemy], [target]);
    const other = neighborsOf({ q: 2, r: 2 }).find((c) => coordKey(c) !== coordKey(target))!;
    expect(isEnemyZoc(state, other, Side.AXIS)).toBe(true);
  });

  it("il marker sblocca il passaggio altrimenti vietato dalla regola della stessa unità", () => {
    const plain = makeState([enemy]);
    const pair = neighborsOf({ q: 2, r: 2 })
      .flatMap((a) =>
        neighborsOf(a)
          .filter((b) => neighborsOf({ q: 2, r: 2 }).some((x) => coordKey(x) === coordKey(b)))
          .map((b) => [a, b] as const)
      )[0];
    expect(movesBetweenSameEnemyZoc(plain, pair[0], pair[1], Side.AXIS)).toBe(true);
    const withMarker = makeState([enemy], [pair[1]]);
    expect(movesBetweenSameEnemyZoc(withMarker, pair[0], pair[1], Side.AXIS)).toBe(false);
  });
});

describe("EZOC — esclusioni note", () => {
  it("un'unità che occupa un forte non esercita ZOC (1.7)", () => {
    const enemy = { ...makeUnit("fr10", Side.ALLIED, { q: 2, r: 2 }), occupyingFort: true };
    const state = makeState([enemy]);
    expect(isEnemyZoc(state, neighborsOf({ q: 2, r: 2 })[0], Side.AXIS)).toBe(false);
  });

  it("le unità aeree non esercitano ZOC", () => {
    const air = { ...makeUnit("luf", Side.ALLIED, { q: 2, r: 2 }), type: UnitType.AIR };
    const state = makeState([air]);
    expect(isEnemyZoc(state, neighborsOf({ q: 2, r: 2 })[0], Side.AXIS)).toBe(false);
  });
});
