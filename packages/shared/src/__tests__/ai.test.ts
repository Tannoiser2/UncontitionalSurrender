import { describe, expect, it } from "vitest";
import { runAiOperationStep } from "../ai";
import { createInitialGameState, hexDistance, neighborForSide } from "../engine";
import { GamePhase, GameSubPhase, Side, WeatherType } from "../types";

describe("runAiOperationStep", () => {
  it("sceglie una mossa durante le Operazioni del lato corrente", () => {
    const state = {
      ...createInitialGameState({ scenario: "france1940" }),
      phase: GamePhase.OPERATIONS,
      subPhase: GameSubPhase.ACTIONS,
      currentSide: Side.AXIS,
      weather: WeatherType.FAIR
    };

    const result = runAiOperationStep(state, Side.AXIS);

    expect(result.decision.side).toBe(Side.AXIS);
    expect(result.decision.kind).not.toBe("none");
    expect(result.state.history[0]?.note).toContain("IA:");
  });

  it("non muove fuori dalla sottofase Operazioni/Azioni", () => {
    const state = createInitialGameState({ scenario: "france1940" });
    const result = runAiOperationStep(state, Side.AXIS);

    expect(result.state).toBe(state);
    expect(result.decision.kind).toBe("none");
  });

  it("preferisce attaccare quando un nemico e adiacente", () => {
    const base = {
      ...createInitialGameState({ scenario: "france1940" }),
      phase: GamePhase.OPERATIONS,
      subPhase: GameSubPhase.ACTIONS,
      currentSide: Side.AXIS,
      weather: WeatherType.FAIR
    };
    const units = new Map(base.units);
    const attacker = units.get("germany_1_pz");
    const defender = units.get("netherlands_dutch");
    expect(attacker).toBeDefined();
    expect(defender).toBeDefined();
    const defenderPosition = neighborForSide(attacker!.position, "SE");
    units.set(defender!.id, { ...defender!, position: defenderPosition });

    const result = runAiOperationStep({ ...base, units }, Side.AXIS);

    expect(result.decision.kind).toBe("attack");
    expect(result.decision.note).toContain("attacca");
  });

  it("quando muove, sceglie solo un esagono adiacente", () => {
    const state = {
      ...createInitialGameState({ scenario: "france1940" }),
      phase: GamePhase.OPERATIONS,
      subPhase: GameSubPhase.ACTIONS,
      currentSide: Side.AXIS,
      weather: WeatherType.FAIR
    };

    const result = runAiOperationStep(state, Side.AXIS);
    const movedUnit = result.decision.unitId ? state.units.get(result.decision.unitId) : undefined;

    if (result.decision.kind === "move") {
      expect(movedUnit).toBeDefined();
      expect(result.decision.target).toBeDefined();
      expect(hexDistance(movedUnit!.position, result.decision.target!)).toBe(1);
    }
  });

  it("quando muove, non entra in esagoni occupati da unita nemiche", () => {
    const state = {
      ...createInitialGameState({ scenario: "france1940" }),
      phase: GamePhase.OPERATIONS,
      subPhase: GameSubPhase.ACTIONS,
      currentSide: Side.AXIS,
      weather: WeatherType.FAIR
    };

    const result = runAiOperationStep(state, Side.AXIS);

    if (result.decision.kind === "move") {
      const enemyOnTarget = Array.from(state.units.values()).some(
        (unit) =>
          unit.side !== Side.AXIS &&
          unit.status !== "destroyed" &&
          result.decision.target &&
          unit.position.q === result.decision.target.q &&
          unit.position.r === result.decision.target.r
      );
      expect(enemyOnTarget).toBe(false);
    }
  });
});
