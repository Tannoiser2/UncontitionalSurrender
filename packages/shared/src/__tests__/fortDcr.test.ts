import { describe, expect, it } from "vitest";
import {
  AttackType,
  CombatResultCode,
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
import {
  applyCombatResult,
  resolveDefenderCannotRetreatChoice,
  resolveAdvanceChoice
} from "../engine";

// ─── fixtures ────────────────────────────────────────────────────────────────

const POS_ATT = { q: 0, r: 0 };
const POS_DEF = { q: 1, r: 0 };
const POS_ADJ = { q: 2, r: 0 }; // vicino al defender, non occupato

const makeHex = (q: number, r: number, extra?: { city?: boolean; capital?: boolean; port?: boolean; country?: string; controller?: string }) => ({
  coord: { q, r },
  terrain: TerrainType.PLAIN,
  terrainTags: ["plain" as const],
  features: {
    country: extra?.country,
    controller: extra?.controller as any,
    city: Boolean(extra?.city),
    capital: Boolean(extra?.capital),
    port: Boolean(extra?.port),
    productionCenter: false,
    prohibited: false,
    fadedDot: false
  },
  railEdges: [] as any[],
  zoc: new Set<string>(),
  units: [] as string[],
  supply: 10
});

const makeUnit = (over: Partial<Unit> & { id: string; side: Side; position: { q: number; r: number } }): Unit => ({
  name: over.id,
  country: "Germany",
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

interface MakeStateOpts {
  units?: Unit[];
  fortAt?: { q: number; r: number };         // Fort unit sul hex
  extraHexes?: Array<{ q: number; r: number; city?: boolean; capital?: boolean; country?: string; controller?: string }>;
}

const makeState = (opts: MakeStateOpts = {}): GameState => {
  const map = new Map<string, any>();
  map.set("0,0", makeHex(0, 0));
  map.set("1,0", makeHex(1, 0));
  map.set("2,0", makeHex(2, 0));
  (opts.extraHexes || []).forEach((e) => {
    const key = `${e.q},${e.r}`;
    map.set(key, makeHex(e.q, e.r, e));
  });

  const units = new Map<string, Unit>();
  (opts.units || []).forEach((u) => units.set(u.id, u));

  // Fort unit on fortAt (se specificato)
  if (opts.fortAt) {
    const fort: Unit = makeUnit({ id: "fort", side: Side.AXIS, position: opts.fortAt, type: UnitType.FORT, country: "Germany" });
    units.set(fort.id, fort);
  }

  return {
    id: "test",
    turn: 1,
    turnCode: "T1",
    phase: GamePhase.MOVEMENT,
    subPhase: GameSubPhase.ACTIONS,
    currentSide: Side.AXIS,
    weather: WeatherType.FAIR,
    weatherMap: WeatherMapCategory.OTHER_MAPS,
    factionCards: {
      [Side.AXIS]: { side: Side.AXIS, productionPoints: {}, nationalWill: {}, eventsBox: [], eliminatedBox: [], mobilizationBox: [] },
      [Side.ALLIED]: { side: Side.ALLIED, productionPoints: {}, nationalWill: {}, eventsBox: [], eliminatedBox: [], mobilizationBox: [] }
    },
    units,
    map: map as GameState["map"],
    riverEdges: new Set<string>(),
    mountainEdges: new Set<string>(),
    straitEdges: new Set<string>(),
    impassableEdges: new Set<string>(),
    history: [],
    timestamp: new Date()
  } as GameState;
};

const att = (over: Partial<Unit> = {}): Unit =>
  makeUnit({ id: "att", side: Side.AXIS, position: POS_ATT, ...over });
const def = (over: Partial<Unit> = {}): Unit =>
  makeUnit({ id: "def", side: Side.ALLIED, country: "France", position: POS_DEF, ...over });

// Outcome helpers
const outcome = (code: CombatResultCode) => ({
  attackerFinal: 8,
  defenderFinal: 4,
  attackerRoll: 4,
  defenderRoll: 4,
  attackerDrm: {} as any,
  defenderDrm: {} as any,
  resultCode: code
});

// ─── 1. DR: retreat normale (senza fort) ─────────────────────────────────────

describe("DR — retreat normale", () => {
  it("DR con un solo retreat hex: retreat automatica + pendingCombat advance", () => {
    // Con esattamente 1 retreat hex e difensore non in fort → retreat automatica
    const s = makeState({ units: [att(), def()] });
    const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    // Defender si è ritirato in automatico
    expect(result.units.get("def")!.status).toBe(UnitStatus.READY);
    expect(result.units.get("def")!.position).toEqual(POS_ADJ);
    // Attaccante ha pendingCombat advance
    expect(result.pendingCombat?.kind).toBe("advance");
  });

  it("DR senza retreat hex: defender reduce (full → reduced)", () => {
    // Defender su hex senza vicini liberi — tolgo l'hex adiacente
    const map = new Map<string, any>();
    map.set("0,0", makeHex(0, 0));
    map.set("1,0", makeHex(1, 0));
    // No hex 2,0 → nessuna retreat disponibile

    const units = new Map<string, Unit>();
    units.set("att", att());
    units.set("def", def());
    const s = { ...makeState(), map: map as GameState["map"], units } as GameState;

    const result = applyCombatResult(s, units.get("att")!, [], units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    const d = result.units.get("def")!;
    expect(d.reduced).toBe(true);
    expect(d.status).not.toBe(UnitStatus.DESTROYED);
  });

  it("DR non propone retreat in un esagono gia occupato da unita terrestre amica", () => {
    const blocker = makeUnit({ id: "friendly-blocker", side: Side.ALLIED, country: "France", position: POS_ADJ });
    const s = makeState({ units: [att(), def(), blocker] });

    const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);

    const d = result.units.get("def")!;
    expect(d.position).toEqual(POS_DEF);
    expect(d.reduced).toBe(true);
    expect(result.pendingCombat?.kind).not.toBe("retreat");
  });

  it("DR senza retreat hex su defender già reduced: eliminato", () => {
    const map = new Map<string, any>();
    map.set("0,0", makeHex(0, 0));
    map.set("1,0", makeHex(1, 0));

    const units = new Map<string, Unit>();
    units.set("att", att());
    units.set("def", def({ reduced: true }));
    const s = { ...makeState(), map: map as GameState["map"], units } as GameState;

    const result = applyCombatResult(s, units.get("att")!, [], units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    expect(result.units.get("def")!.status).toBe(UnitStatus.DESTROYED);
  });
});

// ─── 2. DR vs fort: flow DCR ──────────────────────────────────────────────────

describe("DR vs fort — flow DCR (allowDefenderCannotRetreat)", () => {
  it("DR vs fort: pendingCombat ha allowDefenderCannotRetreat=true", () => {
    // Defender occupa un fort (occupyingFort=true) con retreat hex disponibili
    const s = makeState({ units: [att(), def({ occupyingFort: true })], fortAt: POS_DEF });
    const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    expect(result.pendingCombat?.kind).toBe("retreat");
    const pending = result.pendingCombat;
    expect(pending?.kind === "retreat" && pending.allowDefenderCannotRetreat).toBe(true);
  });

  it("DCR su full-strength: defender si riduce in place (non eliminato)", () => {
    const s = makeState({ units: [att(), def({ occupyingFort: true })], fortAt: POS_DEF });
    const afterCombat = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    const pc = afterCombat.pendingCombat;
    expect(pc?.kind).toBe("retreat");

    const result = resolveDefenderCannotRetreatChoice(afterCombat);
    expect(result).not.toBeNull();
    const d = result!.units.get("def")!;
    expect(d.reduced).toBe(true);
    expect(d.status).not.toBe(UnitStatus.DESTROYED);
    // Rimane sul suo hex
    expect(d.position).toEqual(POS_DEF);
  });

  it("DCR su reduced: defender eliminato", () => {
    const s = makeState({ units: [att(), def({ occupyingFort: true, reduced: true })], fortAt: POS_DEF });
    const afterCombat = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    const pc1 = afterCombat.pendingCombat;
    expect(pc1?.kind === "retreat" && pc1.allowDefenderCannotRetreat).toBe(true);

    const result = resolveDefenderCannotRetreatChoice(afterCombat);
    expect(result).not.toBeNull();
    expect(result!.units.get("def")!.status).toBe(UnitStatus.DESTROYED);
  });

  it("DCR su reduced Mobile: marker noEzoc piazzato", () => {
    const s = makeState({ units: [att(), def({ occupyingFort: true, reduced: true })], fortAt: POS_DEF });
    const afterCombat = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.MOBILE, outcome(CombatResultCode.DR), false);

    const result = resolveDefenderCannotRetreatChoice(afterCombat);
    expect(result).not.toBeNull();
    const hex = result!.map.get("1,0");
    expect(hex?.noEzocMarker).toBe(true);
  });

  it("DCR su reduced Assault: NO marker noEzoc (solo Mobile piazza marker)", () => {
    const s = makeState({ units: [att(), def({ occupyingFort: true, reduced: true })], fortAt: POS_DEF });
    const afterCombat = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);

    const result = resolveDefenderCannotRetreatChoice(afterCombat);
    expect(result).not.toBeNull();
    const hex = result!.map.get("1,0");
    expect(hex?.noEzocMarker).toBeFalsy();
  });

  it("DCR non applicabile se pendingCombat non è retreat", () => {
    const s = makeState({ units: [att(), def()] });
    expect(resolveDefenderCannotRetreatChoice(s)).toBeNull();
  });

  it("DCR non applicabile se allowDefenderCannotRetreat è false", () => {
    const s = makeState({ units: [att(), def()] });
    const afterCombat = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    const pcCheck = afterCombat.pendingCombat;
    // senza fort → allowDefenderCannotRetreat non settato
    const hasAllow = pcCheck?.kind === "retreat" && Boolean(pcCheck.allowDefenderCannotRetreat);
    expect(hasAllow).toBeFalsy();
    expect(resolveDefenderCannotRetreatChoice(afterCombat)).toBeNull();
  });
});

// ─── 3. Advance post-DCR ─────────────────────────────────────────────────────

describe("Advance dopo DCR eliminazione", () => {
  it("Dopo DCR su reduced: attaccante ha pendingCombat advance verso l'ex-hex del defender", () => {
    const s = makeState({ units: [att(), def({ occupyingFort: true, reduced: true })], fortAt: POS_DEF });
    const afterCombat = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    const afterDcr = resolveDefenderCannotRetreatChoice(afterCombat)!;

    const pc2 = afterDcr.pendingCombat;
    expect(pc2?.kind).toBe("advance");
    expect(pc2?.kind === "advance" && pc2.options).toContainEqual(POS_DEF);
  });

  it("Advance accettato: attaccante si sposta sul hex del defender", () => {
    const s = makeState({ units: [att(), def({ occupyingFort: true, reduced: true })], fortAt: POS_DEF });
    const afterCombat = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    const afterDcr = resolveDefenderCannotRetreatChoice(afterCombat)!;

    const afterAdvance = resolveAdvanceChoice(afterDcr, true);
    expect(afterAdvance).not.toBeNull();
    expect(afterAdvance!.units.get("att")!.position).toEqual(POS_DEF);
  });

  it("Advance rifiutato: attaccante rimane sul suo hex", () => {
    const s = makeState({ units: [att(), def({ occupyingFort: true, reduced: true })], fortAt: POS_DEF });
    const afterCombat = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DR), false);
    const afterDcr = resolveDefenderCannotRetreatChoice(afterCombat)!;

    const afterAdvance = resolveAdvanceChoice(afterDcr, false);
    expect(afterAdvance).not.toBeNull();
    expect(afterAdvance!.units.get("att")!.position).toEqual(POS_ATT);
  });
});

// ─── 4. DD e DE — comportamento standard ─────────────────────────────────────

describe("DD — Defender Disrupted", () => {
  it("DD su full-strength: defender reduced + retreat", () => {
    const s = makeState({ units: [att(), def()] });
    const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DD), false);
    // Con retreat hex disponibile → pendingCombat retreat, defender già reduced
    const d = result.units.get("def")!;
    if (result.pendingCombat?.kind === "retreat") {
      expect(d.reduced).toBe(true);
    } else {
      // retreat automatica (1 hex)
      expect(d.reduced).toBe(true);
      expect(d.position).not.toEqual(POS_DEF);
    }
  });

  it("DD su reduced: defender eliminato", () => {
    const s = makeState({ units: [att(), def({ reduced: true })] });
    const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DD), false);
    expect(result.units.get("def")!.status).toBe(UnitStatus.DESTROYED);
  });
});

describe("DE — Defender Eliminated", () => {
  it("DE: defender eliminato indipendentemente da full/reduced", () => {
    for (const reduced of [false, true]) {
      const s = makeState({ units: [att(), def({ reduced })] });
      const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DE), false);
      expect(result.units.get("def")!.status, `reduced=${reduced}`).toBe(UnitStatus.DESTROYED);
    }
  });

  it("DE Mobile: marker noEzoc piazzato sul hex del defender", () => {
    const s = makeState({ units: [att(), def()] });
    const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.MOBILE, outcome(CombatResultCode.DE), false);
    const hex = result.map.get("1,0");
    expect(hex?.noEzocMarker).toBe(true);
  });

  it("DE Assault: nessun marker noEzoc", () => {
    const s = makeState({ units: [att(), def()] });
    const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.DE), false);
    const hex = result.map.get("1,0");
    expect(hex?.noEzocMarker).toBeFalsy();
  });
});

// ─── 5. AA — attaccante subisce perdita ──────────────────────────────────────

describe("AA — Attacker Adverse", () => {
  it("AA su full-strength attaccante: ridotto", () => {
    const s = makeState({ units: [att(), def()] });
    const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.AA), false);
    const a = result.units.get("att")!;
    expect(a.reduced).toBe(true);
    expect(a.status).not.toBe(UnitStatus.DESTROYED);
  });

  it("AA su reduced attaccante: eliminato", () => {
    const s = makeState({ units: [att({ reduced: true }), def()] });
    const result = applyCombatResult(s, s.units.get("att")!, [], s.units.get("def")!, AttackType.ASSAULT, outcome(CombatResultCode.AA), false);
    expect(result.units.get("att")!.status).toBe(UnitStatus.DESTROYED);
  });
});
