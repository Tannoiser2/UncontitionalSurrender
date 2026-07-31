import { describe, expect, it } from "vitest";
import {
  createInitialGameState,
  evaluateVictory,
  coordKey,
  BARBAROSSA_SOVIET_WILL_THRESHOLD,
  AXIS_INVASION_FOOTHOLD
} from "../engine";
import { GamePhase, GameState, Side, UnitStatus, UnitType } from "../types";

// Playbook 21.3.1 / 21.4.1: "The Axis faction wins if on any turn, Belgium,
// France, and Netherlands are conquered." Non basta la sola Francia.
// Gli scenari Barbarossa/Russia sono fan-made: le condizioni sono quelle
// descritte nelle loro regole speciali in scenarios.ts.

const atVictoryCheck = (scenario: string): GameState => ({
  ...createInitialGameState({ scenario }),
  phase: GamePhase.VICTORY_CHECK
});

const withStatus = (state: GameState, statuses: Record<string, string>): GameState => ({
  ...state,
  factionCards: {
    ...state.factionCards,
    [Side.ALLIED]: {
      ...state.factionCards[Side.ALLIED],
      countryStatus: { ...state.factionCards[Side.ALLIED].countryStatus, ...statuses } as never
    }
  }
});

describe("Vittoria France 1940/1941 (Playbook 21.3.1)", () => {
  it("la sola Francia conquistata NON basta all'Asse", () => {
    const state = withStatus(atVictoryCheck("france1940"), { France: "conquered" });
    expect(evaluateVictory(state).victory).toBeUndefined();
  });

  it("Francia + Belgio, senza Paesi Bassi, non basta", () => {
    const state = withStatus(atVictoryCheck("france1940"), { France: "conquered", Belgium: "conquered" });
    expect(evaluateVictory(state).victory).toBeUndefined();
  });

  it("Belgio + Francia + Paesi Bassi conquistati: vince l'Asse", () => {
    const state = withStatus(atVictoryCheck("france1940"), {
      France: "conquered",
      Belgium: "conquered",
      Netherlands: "conquered"
    });
    const victory = evaluateVictory(state).victory;
    expect(victory?.winner).toBe(Side.AXIS);
  });

  it("vale anche per France 1941", () => {
    const state = withStatus(atVictoryCheck("france1941"), {
      France: "conquered",
      Belgium: "conquered",
      Netherlands: "conquered"
    });
    expect(evaluateVictory(state).victory?.winner).toBe(Side.AXIS);
  });
});

describe("Vittoria Barbarossa 1941 (scenario fan-made)", () => {
  it("all'inizio nessuno ha vinto", () => {
    expect(evaluateVictory(atVictoryCheck("barbarossa1941")).victory).toBeUndefined();
  });

  it("la National Will sovietica è tracciata (serve alla condizione di vittoria)", () => {
    const state = createInitialGameState({ scenario: "barbarossa1941" });
    expect(typeof state.factionCards[Side.ALLIED].nationalWill.USSR).toBe("number");
  });

  it("Will sovietica sotto la soglia: vince l'Asse", () => {
    const base = atVictoryCheck("barbarossa1941");
    const state: GameState = {
      ...base,
      factionCards: {
        ...base.factionCards,
        [Side.ALLIED]: {
          ...base.factionCards[Side.ALLIED],
          nationalWill: { USSR: BARBAROSSA_SOVIET_WILL_THRESHOLD - 1 }
        }
      }
    };
    expect(evaluateVictory(state).victory?.winner).toBe(Side.AXIS);
  });

  it("Will esattamente alla soglia: l'Asse non vince ancora", () => {
    const base = atVictoryCheck("barbarossa1941");
    const state: GameState = {
      ...base,
      factionCards: {
        ...base.factionCards,
        [Side.ALLIED]: {
          ...base.factionCards[Side.ALLIED],
          nationalWill: { USSR: BARBAROSSA_SOVIET_WILL_THRESHOLD }
        }
      }
    };
    expect(evaluateVictory(state).victory).toBeUndefined();
  });

  it("URSS collassata: vince l'Asse", () => {
    const state = withStatus(atVictoryCheck("barbarossa1941"), { USSR: "collapsed" });
    expect(evaluateVictory(state).victory?.winner).toBe(Side.AXIS);
  });

  it("fine scenario con Will alta: vince l'URSS", () => {
    const state = { ...atVictoryCheck("barbarossa1941"), turn: 7 };
    expect(evaluateVictory(state).victory?.winner).toBe(Side.ALLIED);
  });

  it("non ricade più sulla condizione 'Francia conquistata'", () => {
    const state = withStatus(atVictoryCheck("barbarossa1941"), { France: "conquered" });
    expect(evaluateVictory(state).victory).toBeUndefined();
  });
});

describe("Vittoria Russia 1941-1944 (scenario fan-made)", () => {
  // Porta esattamente `count` unità terrestri tedesche dentro hex URSS,
  // spostandovele o togliendo dalla mappa quelle in eccesso.
  const withGermansInUssr = (state: GameState, count: number): GameState => {
    const ussrHexes = Array.from(state.map.values())
      .filter((hex) => hex.features.country === "USSR")
      .map((hex) => hex.coord);
    const outside = { q: -999, r: -999 };
    const units = new Map(state.units);
    let placed = 0;
    Array.from(state.units.values()).forEach((unit) => {
      const isGermanGround =
        unit.side === Side.AXIS &&
        unit.country === "Germany" &&
        unit.type !== UnitType.AIR &&
        unit.type !== UnitType.FORT &&
        unit.status !== UnitStatus.DESTROYED;
      if (!isGermanGround) return;
      if (placed < count) {
        units.set(unit.id, { ...unit, position: ussrHexes[placed], mapPresence: "france" });
        placed += 1;
      } else {
        units.set(unit.id, { ...unit, position: outside });
      }
    });
    expect(placed, "unità tedesche disponibili nel setup").toBe(count);
    return { ...state, units };
  };

  it("a inizio scenario i sovietici NON vincono: i tedeschi sono ancora al confine", () => {
    // Al via una sola armata tedesca è dentro l'URSS: senza il presidio della
    // regola dell'invasione, i sovietici vincerebbero al turno 1.
    expect(evaluateVictory(atVictoryCheck("russia19411944")).victory).toBeUndefined();
  });

  it("con l'invasione in corso e ancora molti tedeschi nessuno vince", () => {
    const invaded = { ...atVictoryCheck("russia19411944"), axisInvadedUssr: true };
    const state = withGermansInUssr(invaded, AXIS_INVASION_FOOTHOLD + 2);
    expect(evaluateVictory(state).victory).toBeUndefined();
  });

  it("dopo l'invasione, meno di 4 unità tedesche in URSS: vincono i sovietici", () => {
    const invaded = { ...atVictoryCheck("russia19411944"), axisInvadedUssr: true };
    const state = withGermansInUssr(invaded, AXIS_INVASION_FOOTHOLD - 1);
    expect(evaluateVictory(state).victory?.winner).toBe(Side.ALLIED);
  });

  it("con esattamente 4 unità tedesche i sovietici non vincono", () => {
    const invaded = { ...atVictoryCheck("russia19411944"), axisInvadedUssr: true };
    const state = withGermansInUssr(invaded, AXIS_INVASION_FOOTHOLD);
    expect(evaluateVictory(state).victory).toBeUndefined();
  });

  it("fine scenario senza vittoria sovietica: vince l'Asse", () => {
    const state = { ...atVictoryCheck("russia19411944"), turn: 43, axisInvadedUssr: false };
    expect(evaluateVictory(state).victory?.winner).toBe(Side.AXIS);
  });
});
