import {
  ActionType,
  AttackType,
  CasualtiesResult,
  CombatResultCode,
  GameAction,
  GameMap,
  GamePhase,
  GameState,
  GameSubPhase,
  Hex,
  HexCoord,
  HexSide,
  EventTurnTrackEntry,
  PendingCommitState,
  Side,
  SupplyState,
  TerrainType,
  Unit,
  UnitStatus,
  UnitType,
  WeatherMapCategory,
  WeatherType
} from "./types";
import { GAME_CONFIG } from "./config";
import { GAME_RULES, lookupAirCrtResult, lookupGroundCrtResult } from "./rules";
import { DEFAULT_SCENARIO_ID, ScenarioDefinition, ScenarioId, ScenarioMapId, scenarioById } from "./scenarios";
import france1940Seed from "./france1940Seed.json";
import balkans1941Seed from "./balkans1941Seed.json";
import italy1943Seed from "./italy1943Seed.json";
import fna1942Seed from "./fna1942Seed.json";
import barbarossa1941Seed from "./barbarossa1941Seed.json";

export const coordKey = (coord: HexCoord): string => `${coord.q},${coord.r}`;

const HEX_NUMBERING: Record<ScenarioMapId | "default", { rowBase: number; evenColumnBase: number; oddColumnBase: number }> = {
  default: { rowBase: 25, evenColumnBase: 7, oddColumnBase: 6 },
  france: { rowBase: 25, evenColumnBase: 7, oddColumnBase: 6 },
  balkans: { rowBase: 32, evenColumnBase: 26, oddColumnBase: 25 },
  poland: { rowBase: 25, evenColumnBase: 7, oddColumnBase: 6 },
  scandinavia: { rowBase: 25, evenColumnBase: 7, oddColumnBase: 6 },
  west: { rowBase: 40, evenColumnBase: 2, oddColumnBase: 2 },
  italy: { rowBase: 34, evenColumnBase: 20, oddColumnBase: 20 },
  "france-italy": { rowBase: 25, evenColumnBase: 7, oddColumnBase: 6 },
  russia: { rowBase: 12, evenColumnBase: 35, oddColumnBase: 35 }
};

export const hexCodeForMap = (coord: HexCoord, mapId: ScenarioMapId = "france"): string => {
  const numbering = HEX_NUMBERING[mapId] || HEX_NUMBERING.default;
  const row = numbering.rowBase + coord.r;
  const column = (coord.r % 2 === 0 ? numbering.evenColumnBase : numbering.oddColumnBase) + coord.q;
  return `${row}${String(column).padStart(2, "0")}`;
};

export const hexCodeFor = (coord: HexCoord): string => hexCodeForMap(coord, "france");

export const coordFromHexCodeForMap = (code: string | number, mapId: ScenarioMapId = "france"): HexCoord => {
  const value = String(code);
  const row = Number(value.slice(0, 2));
  const column = Number(value.slice(2));
  const numbering = HEX_NUMBERING[mapId] || HEX_NUMBERING.default;
  const r = row - numbering.rowBase;
  const q = column - (r % 2 === 0 ? numbering.evenColumnBase : numbering.oddColumnBase);
  return { q, r };
};

const TURN_CODES = ["May-40", "Jun-40", "Jul-40", "Aug-40", "Sep-40", "Oct-40", "Nov-40", "Dec-40"];

const turnCodeFor = (turn: number): string => TURN_CODES[turn - 1] || `Turn ${turn}`;

const turnCodeForScenario = (turn: number, scenario: ScenarioDefinition | null): string =>
  scenario?.turnCodes?.[turn - 1] || turnCodeFor(turn);

const monthForTurnCode = (turnCode: string): string => turnCode.split("-")[0] || "May";

const isItaly1943Scenario = (scenario: string | undefined): boolean =>
  scenario === "italy1943" || scenario === "italy1943Include";

const isFna1942Scenario = (scenario: string | undefined): boolean =>
  scenario === "frenchNorthAfrica1942";

const isBarbarossa1941Scenario = (scenario: string | undefined): boolean =>
  scenario === "barbarossa1941" || scenario === "russia19411944";

const createInitialFactionCards = (scenario: ScenarioId | "procedural" = DEFAULT_SCENARIO_ID): GameState["factionCards"] => {
  if (scenario === "balkans1941") {
    return {
      [Side.AXIS]: {
        side: Side.AXIS,
        productionPoints: { Bulgaria: null, Germany: null, Hungary: null, Italy: null, Romania: null },
        nationalWill: { Bulgaria: null, Germany: null, Hungary: null, Italy: null, Romania: null },
        countryStatus: { Bulgaria: "active", Germany: "active", Hungary: "active", Italy: "active", Romania: "active" },
        countryInitialNationalWill: { Bulgaria: null, Germany: null, Hungary: null, Italy: null, Romania: null },
        eventsBox: ["Ground Support", "Ground Support #2", "Germany Airdrop"],
        eliminatedBox: [],
        mobilizationBox: []
      },
      [Side.ALLIED]: {
        side: Side.ALLIED,
        productionPoints: { Greece: 1, UK: null, Yugoslavia: 2 },
        nationalWill: { Greece: 4, UK: null, Yugoslavia: 6 },
        countryStatus: { Greece: "active", UK: "active", Yugoslavia: "active" },
        countryInitialNationalWill: { Greece: 4, UK: null, Yugoslavia: 6 },
        eventsBox: ["Ground Support", "Ground Support #2"],
        eliminatedBox: [],
        mobilizationBox: []
      }
    };
  }

  if (scenario === "france1944") {
    return {
      [Side.AXIS]: {
        side: Side.AXIS,
        productionPoints: { Germany: 12 },
        nationalWill: { Germany: null },
        countryStatus: { Germany: "active" },
        countryInitialNationalWill: { Germany: null },
        eventsBox: ["Strategic Move", "Germany Jets", "Germany Tanks"],
        eliminatedBox: [],
        mobilizationBox: ["germany_7_gar"]
      },
      [Side.ALLIED]: {
        side: Side.ALLIED,
        productionPoints: { UK: null, USA: null },
        nationalWill: { UK: null, USA: null },
        countryStatus: { UK: "active", USA: "active" },
        countryInitialNationalWill: { UK: null, USA: null },
        eventsBox: [
          "UK Naval Evacuation",
          "UK Surprise Attack",
          "UK/USA Airdrop",
          "USA Surprise Attack",
          "USA Surprise Attack #2",
          "Western Partisans",
          "Western Mulberry",
          "Strategic Move",
          "Western ULTRA",
          "Western SNAFU"
        ],
        eliminatedBox: [],
        mobilizationBox: ["usa_9"]
      }
    };
  }

  if (scenario === "frenchNorthAfrica1942") {
    return {
      [Side.AXIS]: {
        side: Side.AXIS,
        productionPoints: { Germany: null, "Fr.N.Africa": 2, Italy: null },
        nationalWill: { Germany: null, "Fr.N.Africa": 5, Italy: null },
        countryStatus: { Germany: "active", "Fr.N.Africa": "active", Italy: "active" },
        countryInitialNationalWill: { Germany: null, "Fr.N.Africa": 5, Italy: null },
        eventsBox: ["Strategic Move", "Germany Tanks", "Italy Tanks"],
        eliminatedBox: [],
        mobilizationBox: []
      },
      [Side.ALLIED]: {
        side: Side.ALLIED,
        productionPoints: { UK: null, USA: null },
        nationalWill: { UK: null, USA: null },
        countryStatus: { UK: "active", USA: "active" },
        countryInitialNationalWill: { UK: null, USA: null },
        eventsBox: ["UK Naval Evacuation", "UK Tanks", "USA Tanks", "Western Free Forces", "Strategic Move", "Western ULTRA"],
        eliminatedBox: [],
        mobilizationBox: []
      }
    };
  }

  if (scenario === "italy1943") {
    return {
      [Side.AXIS]: {
        side: Side.AXIS,
        productionPoints: { Germany: null, Italy: 0 },
        nationalWill: { Germany: null, Italy: 3 },
        countryStatus: { Germany: "active", Italy: "conquered" },
        countryInitialNationalWill: { Germany: null, Italy: 3 },
        eventsBox: ["Strategic Move", "Germany Tanks", "SNAFU"],
        eliminatedBox: [],
        mobilizationBox: ["germany_7_gar"]
      },
      [Side.ALLIED]: {
        side: Side.ALLIED,
        productionPoints: { UK: null, USA: null },
        nationalWill: { UK: null, USA: null },
        countryStatus: { UK: "active", USA: "active" },
        countryInitialNationalWill: { UK: null, USA: null },
        eventsBox: [
          "UK Naval Evacuation",
          "UK Surprise Attack",
          "UK Tanks",
          "UK Tanks #2",
          "USA Surprise Attack",
          "USA Surprise Attack #2",
          "Western Free Forces",
          "Western ULTRA",
          "Western SNAFU"
        ],
        eliminatedBox: [],
        mobilizationBox: []
      }
    };
  }

  if (scenario === "italy1943Include") {
    return {
      [Side.AXIS]: {
        side: Side.AXIS,
        productionPoints: { Germany: null, Italy: 2 },
        nationalWill: { Germany: null, Italy: 3 },
        countryStatus: { Germany: "active", Italy: "active" },
        countryInitialNationalWill: { Germany: null, Italy: 3 },
        eventsBox: ["Strategic Move", "Germany Tanks", "Italy Tanks", "SNAFU"],
        eliminatedBox: [],
        mobilizationBox: ["germany_liguria", "italy_9", "italy_11"]
      },
      [Side.ALLIED]: {
        side: Side.ALLIED,
        productionPoints: { UK: null, USA: null },
        nationalWill: { UK: null, USA: null },
        countryStatus: { UK: "active", USA: "active" },
        countryInitialNationalWill: { UK: null, USA: null },
        eventsBox: [
          "UK Naval Evacuation",
          "UK Surprise Attack",
          "UK Tanks",
          "UK Tanks #2",
          "UK/USA Airdrop",
          "USA Surprise Attack",
          "USA Surprise Attack #2",
          "Western Free Forces",
          "Strategic Move",
          "Western ULTRA",
          "Western SNAFU"
        ],
        eliminatedBox: [],
        mobilizationBox: []
      }
    };
  }

  if (scenario === "barbarossa1941") {
    return {
      [Side.AXIS]: {
        side: Side.AXIS,
        productionPoints: { Germany: 12, Romania: 2, Finland: 1, Hungary: 1 },
        nationalWill: { Germany: null, Romania: 4, Finland: 3, Hungary: 3 },
        countryStatus: { Germany: "active", Romania: "active", Finland: "active", Hungary: "active" },
        countryInitialNationalWill: { Germany: null, Romania: 4, Finland: 3, Hungary: 3 },
        eventsBox: ["Strategic Move", "Ground Support", "Ground Support #2", "Germany Airdrop", "Blitzkrieg", "SNAFU"],
        eliminatedBox: [],
        mobilizationBox: []
      },
      [Side.ALLIED]: {
        side: Side.ALLIED,
        productionPoints: { USSR: 15 },
        // La condizione di vittoria dello scenario ("l'Asse vince se la National
        // Will sovietica scende sotto 45") richiede che la Will sia tracciata.
        // Base 95 come in russia19411944: la soglia equivale a perderne oltre metà.
        nationalWill: { USSR: 95 },
        countryStatus: { USSR: "active" },
        countryInitialNationalWill: { USSR: 95 },
        // Soviet Emergency Mobilization (fine Operazioni Asse Jun-41): Air 3 + 5 armate (7,14,16,22,23)
        // disponibili già al turno 1 nella Mobilization Box
        eventsBox: ["Strategic Move", "Soviet Counterattack", "Rasputitsa", "Partisans"],
        eliminatedBox: [],
        mobilizationBox: ["ussr_air_3", "ussr_army_7", "ussr_army_14", "ussr_army_16", "ussr_army_22", "ussr_army_23"]
      }
    };
  }

  if (scenario === "russia19411944") {
    return {
      [Side.AXIS]: {
        side: Side.AXIS,
        // 1941: 13 PP/turno. Riduzione a 11 (1942) e 9 (1943-44) gestita da applyScenarioMobilizationSchedule
        productionPoints: { Germany: 13, Romania: 2, Finland: 1, Hungary: 1, Italy: 1 },
        nationalWill: { Germany: null, Romania: 6, Finland: 3, Hungary: 4, Italy: 4 },
        countryStatus: { Germany: "active", Romania: "active", Finland: "active", Hungary: "active", Italy: "active" },
        countryInitialNationalWill: { Germany: null, Romania: 6, Finland: 3, Hungary: 4, Italy: 4 },
        eventsBox: ["Strategic Move", "Ground Support", "Ground Support #2", "Germany Airdrop", "Blitzkrieg", "Surface Action", "Surprise Attack", "SNAFU"],
        eliminatedBox: [],
        mobilizationBox: []
      },
      [Side.ALLIED]: {
        side: Side.ALLIED,
        productionPoints: { USSR: 15 },
        nationalWill: { USSR: 95 },
        countryStatus: { USSR: "active" },
        countryInitialNationalWill: { USSR: 95 },
        // Emergency Mobilization Jun-41: Air 3 + 5 armate disponibili da subito
        eventsBox: ["Strategic Move", "Soviet Counterattack", "Rasputitsa", "Partisans", "Partisans #2", "Surface Action", "2x Tanks", "Lend Lease"],
        eliminatedBox: [],
        mobilizationBox: ["ussr_air_3", "ussr_army_7", "ussr_army_14", "ussr_army_16", "ussr_army_22", "ussr_army_23"]
      }
    };
  }

  if (scenario === "france1941") {
    return {
      [Side.AXIS]: {
        side: Side.AXIS,
        productionPoints: { Germany: 22, Italy: null },
        nationalWill: { Germany: null, Italy: null },
        countryStatus: { Germany: "active", Italy: "active" },
        countryInitialNationalWill: { Germany: null, Italy: null },
        eventsBox: ["Strategic Move", "Germany Airdrop", "Germany Tanks", "Italy Tanks"],
        eliminatedBox: [],
        mobilizationBox: []
      },
      [Side.ALLIED]: {
        side: Side.ALLIED,
        productionPoints: { Belgium: 1, France: 11, Netherlands: 1, UK: null },
        nationalWill: { Belgium: 2, France: 30, Netherlands: 2, UK: null },
        countryStatus: { Belgium: "active", France: "active", Netherlands: "active", UK: "active" },
        countryInitialNationalWill: { Belgium: 2, France: 30, Netherlands: 2, UK: null },
        eventsBox: ["France Tanks", "France Tanks #2", "UK Naval Evacuation", "UK Tanks", "Ground Support", "Ground Support #2", "Strategic Move"],
        eliminatedBox: [],
        mobilizationBox: []
      }
    };
  }

  return {
    [Side.AXIS]: {
      side: Side.AXIS,
      productionPoints: { Germany: null },
      nationalWill: { Germany: null },
      countryStatus: { Germany: "active" },
      countryInitialNationalWill: { Germany: null },
      eventsBox: ["Germany Tanks", "Jets", "Rockets", "Surprise Attack", "SNAFU"],
      eliminatedBox: [],
      mobilizationBox: []
    },
    [Side.ALLIED]: {
      side: Side.ALLIED,
      productionPoints: { France: 7, UK: null, Belgium: 1, Netherlands: 1 },
      nationalWill: { France: 20, UK: null, Belgium: 2, Netherlands: 2 },
      countryStatus: { France: "active", UK: "active", Belgium: "active", Netherlands: "active" },
      countryInitialNationalWill: { France: 20, UK: null, Belgium: 2, Netherlands: 2 },
      eventsBox: ["France Tanks", "UK ULTRA", "Free Forces", "Ground Support", "Naval Evacuation", "Partisans", "UK Surprise Attack"],
      eliminatedBox: [],
      mobilizationBox: []
    }
  };
};

export const edgeKey = (a: HexCoord, b: HexCoord): string => {
  const keys = [coordKey(a), coordKey(b)].sort();
  return `${keys[0]}|${keys[1]}`;
};

export const HEX_SIDES = ["N", "NE", "SE", "S", "SW", "NW"] as const;

export const OPPOSITE_HEX_SIDE: Record<(typeof HEX_SIDES)[number], (typeof HEX_SIDES)[number]> = {
  N: "S",
  NE: "SW",
  SE: "NW",
  S: "N",
  SW: "NE",
  NW: "SE"
};

export const neighborForSide = (coord: HexCoord, side: (typeof HEX_SIDES)[number]): HexCoord => {
  const isIndentedRow = coord.r % 2 === 0;
  const deltas: Record<(typeof HEX_SIDES)[number], HexCoord> = {
    N: { q: isIndentedRow ? 0 : -1, r: -1 },
    NE: { q: isIndentedRow ? 1 : 0, r: -1 },
    SE: { q: 1, r: 0 },
    S: { q: isIndentedRow ? 1 : 0, r: 1 },
    SW: { q: isIndentedRow ? 0 : -1, r: 1 },
    NW: { q: -1, r: 0 }
  };
  const delta = deltas[side];
  return { q: coord.q + delta.q, r: coord.r + delta.r };
};

export const sideBetween = (from: HexCoord, to: HexCoord): (typeof HEX_SIDES)[number] | null =>
  HEX_SIDES.find((side) => sameCoord(neighborForSide(from, side), to)) || null;

export const sameCoord = (a: HexCoord, b: HexCoord): boolean => a.q === b.q && a.r === b.r;

const isWesternMedUnit = (unit: Unit): boolean => unit.mapPresence === "west_med";
const isCentralMedUnit = (unit: Unit): boolean => unit.mapPresence === "central_med";
const isEastNaUnit = (unit: Unit): boolean => unit.mapPresence === "east_na";
const isNavalMapBoxUnit = (unit: Unit): boolean => isWesternMedUnit(unit) || isCentralMedUnit(unit) || isEastNaUnit(unit);

const FNA_INITIAL_INVASION_UNIT_IDS = ["uk_1_can", "usa_tsk_frc"];
const FNA_INITIAL_INVASION_PORT_CODES = ["5103", "4810", "4715"];
const FNA_AXIS_AIR_SUPPORT_HEX = coordFromHexCodeForMap(4526, "west");
const FNA_AXIS_AIR_SUPPORT_ID = "germany_fna_air_support";

const fnaInitialInvasionPortCode = (state: GameState, coord: HexCoord): string =>
  hexCodeForMap(coord, scenarioById(state.scenarioId).mapId);

const isFnaInitialInvasionUnit = (unit: Unit): boolean =>
  FNA_INITIAL_INVASION_UNIT_IDS.includes(unit.id);

const fnaInitialInvasionRecords = (state: GameState): GameAction[] =>
  state.history.filter((action) =>
    Boolean(
      action.unitId &&
      FNA_INITIAL_INVASION_UNIT_IDS.includes(action.unitId) &&
      action.toPos &&
      action.note?.toLowerCase().includes("fna initial amphibious invasion")
    )
  );

const fnaInitialInvasionCompletedCount = (state: GameState): number =>
  new Set(fnaInitialInvasionRecords(state).map((action) => action.unitId)).size;

const fnaInitialInvasionUsedPorts = (state: GameState): Set<string> =>
  new Set(
    fnaInitialInvasionRecords(state)
      .map((action) => action.toPos ? fnaInitialInvasionPortCode(state, action.toPos) : "")
      .filter(Boolean)
  );

const fnaInitialInvasionsPending = (state: GameState): boolean =>
  isFna1942Scenario(state.scenarioId) && fnaInitialInvasionCompletedCount(state) < 2;

const canPerformFnaInitialInvasion = (state: GameState, attacker: Unit, invadeHex: HexCoord): boolean => {
  if (!fnaInitialInvasionsPending(state)) return false;
  if (!isEastNaUnit(attacker) || !isFnaInitialInvasionUnit(attacker)) return false;
  const portCode = fnaInitialInvasionPortCode(state, invadeHex);
  if (!FNA_INITIAL_INVASION_PORT_CODES.includes(portCode)) return false;
  if (fnaInitialInvasionUsedPorts(state).has(portCode)) return false;
  return true;
};

const WESTERN_MED_AIR_SUPPORT_HEXES = new Set(["3519", "3617", "3620", "3717", "3815", "3817"]);

  const isWesternMedAirSupportHex = (coord: HexCoord): boolean => WESTERN_MED_AIR_SUPPORT_HEXES.has(hexCodeFor(coord));

const isMarseilleOrAdjacent = (coord: HexCoord): boolean => {
  const marseille = coordFromHexCode(3817);
  return sameCoord(coord, marseille) || neighborsOf(marseille).some((neighbor) => sameCoord(neighbor, coord));
};

export const hexDistance = (a: HexCoord, b: HexCoord): number => {
  if (sameCoord(a, b)) return 0;
  const frontier: Array<{ coord: HexCoord; distance: number }> = [{ coord: a, distance: 0 }];
  const visited = new Set<string>([coordKey(a)]);

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;

    for (const next of neighborsOf(current.coord)) {
      if (sameCoord(next, b)) return current.distance + 1;
      const key = coordKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        frontier.push({ coord: next, distance: current.distance + 1 });
      }
    }
  }

  return Infinity;
};

export const neighborsOf = (coord: HexCoord): HexCoord[] => HEX_SIDES.map((side) => neighborForSide(coord, side));

export const getUnitOnHex = (state: GameState, coord: HexCoord): Unit | undefined =>
  Array.from(state.units.values()).find(
    (unit) => unit.type !== UnitType.FORT && unit.status !== UnitStatus.DESTROYED && sameCoord(unit.position, coord)
  );

// Tutte le unità non-FORT non-DESTROYED sull'hex (per UI: ciclo selezione)
export const getUnitsOnHex = (state: GameState, coord: HexCoord): Unit[] =>
  Array.from(state.units.values()).filter(
    (unit) => unit.type !== UnitType.FORT && unit.status !== UnitStatus.DESTROYED && sameCoord(unit.position, coord)
  );

export const isInsideMap = (state: GameState, coord: HexCoord): boolean => state.map.has(coordKey(coord));

export const isEnemyZoc = (state: GameState, coord: HexCoord, side: Side): boolean =>
  zocExertingUnits(state, coord, side).length > 0;

export const zocExertingUnits = (state: GameState, coord: HexCoord, side: Side): Unit[] => {
  // 1.7 / 14.8: nessuna ZOC nemica è esercitata in un hex con marker No EZOC.
  if (state.map.get(coordKey(coord))?.noEzocMarker) return [];
  return Array.from(state.units.values()).filter((unit) => {
    if (
      unit.side === side ||
      unit.type === UnitType.AIR ||
      unit.type === UnitType.FORT ||
      unit.occupyingFort ||
      unit.status === UnitStatus.DESTROYED ||
      unit.strength < GAME_RULES.ZOC.ACTIVE_AT_STRENGTH
    ) {
      return false;
    }
    const zocSide = sideBetween(unit.position, coord);
    if (!zocSide) return false;
    return !isGroundMovementProhibited(state, coord) && !isGroundMovementProhibited(state, unit.position);
  });
};

export interface ReachableHex {
  coord: HexCoord;
  cost: number;
}

const isMobileUnit = (unit: Unit): boolean => unit.type === UnitType.ARMOR || unit.type === UnitType.CAVALRY;

export const movementAllowanceFor = (unit: Unit, state?: GameState): number => {
  if (unit.type === UnitType.FORT) return 0;
  // 7.1.1: Low/No Supply riduce MP (4 leg / 5 mobile)
  const supply = unit.supplyState ?? SupplyState.FULL;
  const isReducedSupply = supply === SupplyState.LOW || supply === SupplyState.NO;

  let base: number;
  if (unit.type === UnitType.AIR) {
    base = isReducedSupply ? GAME_RULES.MOVEMENT.MOBILE_REDUCED_SUPPLY_MP : GAME_RULES.MOVEMENT.MOBILE_FULL_SUPPLY_MP;
  } else if (isMobileUnit(unit)) {
    base = isReducedSupply ? GAME_RULES.MOVEMENT.MOBILE_REDUCED_SUPPLY_MP : GAME_RULES.MOVEMENT.MOBILE_FULL_SUPPLY_MP;
    // Blitzkrieg Jun-41: Panzer tedeschi raddoppiano i MP
    if (state?.blitzkriegActive && unit.country === "Germany") return base * 2;
  } else {
    base = isReducedSupply ? GAME_RULES.MOVEMENT.LEG_REDUCED_SUPPLY_MP : GAME_RULES.MOVEMENT.LEG_FULL_SUPPLY_MP;
  }

  // Inverno Russo (scenari Russia): meteo SEVERE o POOR dimezza il movimento di tutte le unità terrestri
  if (state && isBarbarossa1941Scenario(state.scenarioId) && unit.type !== UnitType.AIR) {
    if (state.weather === WeatherType.SEVERE || state.weather === WeatherType.POOR) {
      return Math.max(1, Math.floor(base / 2));
    }
  }

  return base;
};

export const movementSpentFor = (unit: Unit): number => unit.movementSpent || 0;

export const movementRemainingFor = (unit: Unit, state?: GameState): number => Math.max(0, movementAllowanceFor(unit, state) - movementSpentFor(unit));

// Sortie accumulate (1.5). Una air unit "nuova" ha 0; il valore cresce fino a MAX (=6 = inattivabile).
export const sortiesFor = (unit: Unit): number => unit.type === UnitType.AIR ? (unit.sorties ?? 0) : 0;

export const airStrikeRangeFor = (unit: Unit): number => unit.type === UnitType.AIR ? GAME_RULES.AIR.AIR_STRIKE_RANGE : 0;

export const airSupportRangeFor = (unit: Unit): number => unit.type === UnitType.AIR ? GAME_RULES.AIR.AIR_SUPPORT_RANGE : 0;

export const activationCostFor = (unit: Unit): number => {
  if (unit.type === UnitType.AIR || unit.type === UnitType.FORT) return 0;
  if (isMobileUnit(unit)) return 2;
  return 1;
};

export const productionCountryFor = (unit: Unit): string => unit.country || (unit.side === Side.AXIS ? "Germany" : "France");

const canEnterCountryForScenario = (state: GameState, unit: Unit, hex: Hex): boolean => {
  const country = hex.features.country;
  if (!country) return true;
  if (
    state.scenarioId === "balkans1941" &&
    unit.side === Side.ALLIED &&
    initialControllerForCountry(country, "balkans1941") === Side.AXIS
  ) {
    return false;
  }
  if (unit.country === "Belgium") return country === "Belgium" || country === "Germany";
  if (unit.country === "Netherlands") return country === "Netherlands" || country === "Germany";
  return true;
};

const isGroundMovementProhibited = (state: GameState, coord: HexCoord, unit?: Unit): boolean => {
  const hex = state.map.get(coordKey(coord));
  if (!hex) return true;
  const terrainTags = hex.terrainTags || [];
  if (hex.features.prohibited) return true;
  if (hex.features.fadedDot) return true;
  if (unit && !canEnterCountryForScenario(state, unit, hex)) return true;
  return hex.terrain === TerrainType.SEA || (terrainTags.includes("sea") && !terrainTags.includes("coast"));
};

const hasTransportLineThroughSide = (state: GameState, from: HexCoord, to: HexCoord): boolean => {
  const side = sideBetween(from, to);
  if (!side) return false;

  const fromHex = state.map.get(coordKey(from));
  const toHex = state.map.get(coordKey(to));
  if (!fromHex || !toHex) return false;

  return (fromHex.railEdges || []).includes(side) && (toHex.railEdges || []).includes(OPPOSITE_HEX_SIDE[side]);
};

const hasTransportLineToMapEdge = (state: GameState, coord: HexCoord): boolean => {
  const hex = state.map.get(coordKey(coord));
  if (!hex) return false;
  return (hex.railEdges || []).some((side) => !isInsideMap(state, neighborForSide(coord, side)));
};

// For Barbarossa: supply only from west edge (lower q column = toward Germany)
const hasTransportLineToWestEdge = (state: GameState, coord: HexCoord): boolean => {
  const hex = state.map.get(coordKey(coord));
  if (!hex) return false;
  return (hex.railEdges || []).some((side) => {
    const neighbor = neighborForSide(coord, side);
    if (isInsideMap(state, neighbor)) return false;
    // West edge: neighbor has smaller q (column) than current hex
    return neighbor.q < coord.q;
  });
};

const containsWesternUnit = (state: GameState, coord: HexCoord): boolean =>
  Array.from(state.units.values()).some((unit) =>
    unit.status !== UnitStatus.DESTROYED &&
    unit.side === Side.ALLIED &&
    sameCoord(unit.position, coord)
  );

const isGermanItalyUnlimitedSupplySourceHex = (state: GameState, hex: Hex): boolean => {
  if (!isItaly1943Scenario(state.scenarioId)) return false;
  if (hex.features.country !== "Italy" && hex.features.country !== "Yugoslavia") return false;
  if (hex.features.controller === Side.ALLIED) return false;
  if (containsWesternUnit(state, hex.coord)) return false;
  return hasTransportLineToMapEdge(state, hex.coord);
};

const isGermanItalyMobilizationHex = (state: GameState, coord: HexCoord): boolean => {
  const hex = state.map.get(coordKey(coord));
  if (!hex || !isGermanItalyUnlimitedSupplySourceHex(state, hex)) {
    return neighborsOf(coord).some((neighbor) => {
      const neighborHex = state.map.get(coordKey(neighbor));
      return Boolean(neighborHex && isGermanItalyUnlimitedSupplySourceHex(state, neighborHex));
    });
  }
  return true;
};

const isWesternItalyMobilizationHex = (state: GameState, unit: Unit, hex: Hex): boolean =>
  isItaly1943Scenario(state.scenarioId) &&
  unit.side === Side.ALLIED &&
  (unit.country === "UK" || unit.country === "USA") &&
  hex.features.country === "France" &&
  hex.features.controller === Side.ALLIED &&
  (hex.railEdges || []).length > 0;

// Barbarossa/Russia: German reinforcements may mobilize on any west-edge Transport Line hex
const isBarbarossaGermanMobilizationHex = (state: GameState, unit: Unit, coord: HexCoord): boolean => {
  if (!isBarbarossa1941Scenario(state.scenarioId)) return false;
  if (unit.country !== "Germany") return false;
  return hasTransportLineToWestEdge(state, coord);
};

const isRoughHex = (hex: Hex): boolean => {
  const terrainTags = hex.terrainTags || [];
  return (
    terrainTags.includes("forest") ||
    terrainTags.includes("swamp") ||
    terrainTags.includes("mountain") ||
    hex.terrain === TerrainType.FOREST ||
    hex.terrain === TerrainType.SWAMP ||
    hex.terrain === TerrainType.MOUNTAIN
  );
};

// 1.3.1: un hex è "città" se contiene capitale, città, centro produzione o porto.
const hexHasCity = (hex: Hex): boolean =>
  Boolean(hex.features.city || hex.features.capital || hex.features.port || hex.features.productionCenter);

const fortOnHex = (state: GameState, coord: HexCoord): Unit | undefined =>
  Array.from(state.units.values()).find(
    (u) => u.type === UnitType.FORT && u.status !== UnitStatus.DESTROYED && sameCoord(u.position, coord)
  );

// Città/forte è "nemico" per chi muove se il controllo (o la nazionalità del
// forte) appartiene all'altra fazione.
const hasEnemyCityOrFort = (state: GameState, hex: Hex, movingSide: Side): boolean => {
  if (hexHasCity(hex) && isEnemyControlledFeature(hex, movingSide)) return true;
  const fort = fortOnHex(state, hex.coord);
  return Boolean(fort && fort.side !== movingSide);
};

const isEnemyControlledFeature = (hex: Hex, movingSide: Side): boolean =>
  hex.features.controller !== undefined &&
  hex.features.controller !== movingSide &&
  (hex.features.controller as string) !== "neutral";

// Player Aid (Movement 4.2.3):
//   1 hex chiaro | 1 città/forte AMICO | 2 città/forte NEMICO | 2 hex rough senza città/forte
const baseGroundMovementCost = (state: GameState, hex: Hex, movingSide: Side): number => {
  const cityHere = hexHasCity(hex);
  const fortHere = Boolean(fortOnHex(state, hex.coord));
  if (cityHere || fortHere) return hasEnemyCityOrFort(state, hex, movingSide) ? 2 : 1;
  if (isRoughHex(hex)) return 2;
  return 1;
};

// Player Aid: +1 canale/montagna/fiume, +2 stretto. Come per il DRM di
// combattimento, il lato conta una volta sola: si applica il costo maggiore.
const hexsideCrossingCost = (state: GameState, crossing: string): number => {
  if (state.straitEdges?.has(crossing)) return 2;
  if (state.riverEdges.has(crossing) || state.mountainEdges.has(crossing)) return 1;
  return 0;
};

export const BARBAROSSA_AXIS_MINOR_COUNTRIES = ["Romania", "Finland", "Hungary", "Italy"];

// Scenario fan-made Barbarossa 1941: soglia di National Will sovietica sotto la
// quale vince l'Asse alla Victory Check finale (regole speciali dello scenario).
export const BARBAROSSA_SOVIET_WILL_THRESHOLD = 45;

// Scenario fan-made Russia 1941-1944: numero di unità terrestri tedesche in URSS
// che segna l'invasione in corso. Scendere sotto questa soglia DOPO averla
// raggiunta è la condizione di vittoria sovietica.
export const AXIS_INVASION_FOOTHOLD = 4;

export const activationProductionCountry = (scenarioId: string | undefined, unit: Unit): string => {
  if (
    isBarbarossa1941Scenario(scenarioId) &&
    unit.side === Side.AXIS &&
    BARBAROSSA_AXIS_MINOR_COUNTRIES.includes(unit.country || "")
  ) return "Germany";
  return productionCountryFor(unit);
};

const activationProductionCountryFromState = (state: GameState, unit: Unit): string =>
  activationProductionCountry(state.scenarioId, unit);

// Paese da cui scalano i PP per rimpiazzi (stesso criterio delle attivazioni per i minori asse)
export const replacementProductionCountry = (scenarioId: string | undefined, unit: Unit): string => {
  if (
    isBarbarossa1941Scenario(scenarioId) &&
    unit.side === Side.AXIS &&
    BARBAROSSA_AXIS_MINOR_COUNTRIES.includes(unit.country || "")
  ) return "Germany";
  return productionCountryFor(unit);
};

const spendProductionForActivation = (state: GameState, unit: Unit): GameState | null => {
  const cost = activationCostFor(unit);
  if (cost === 0 || unit.moved) return state;

  const card = state.factionCards[unit.side];
  const country = activationProductionCountryFromState(state, unit);
  const currentPoints = card.productionPoints[country];

  // 9.1.1: NA (null) = illimitato, non si traccia spesa
  if (currentPoints === null) return state;

  const available = currentPoints ?? 0;
  if (available < cost) return null;

  return {
    ...state,
    factionCards: {
      ...state.factionCards,
      [unit.side]: {
        ...card,
        productionPoints: {
          ...card.productionPoints,
          [country]: available - cost
        }
      }
    }
  };
};

const fnaItalyEntryHex = (state: GameState): HexCoord | null => {
  if (state.factionCards[Side.AXIS].countryStatus?.["Fr.N.Africa"] !== "conquered") return null;
  for (const code of ["5022", "4622"]) {
    const coord = coordFromHexCodeForMap(code, "west");
    const hex = state.map.get(coordKey(coord));
    if (!hex || hex.features.controller !== Side.AXIS) continue;
    if (getGroundUnitOnHex(state, coord)) continue;
    return coord;
  }
  return null;
};

const activateFnaItalyEntry = (state: GameState, unit: Unit): GameState | null => {
  if (!isFna1942Scenario(state.scenarioId) || unit.id !== "italy_1" || unit.mapPresence !== "off_map") return null;
  const entry = fnaItalyEntryHex(state);
  if (!entry) return null;
  const stateAfterPayment = spendProductionForActivation(state, unit);
  if (!stateAfterPayment) return null;
  const units = new Map(stateAfterPayment.units);
  units.set(unit.id, {
    ...unit,
    position: entry,
    mapPresence: "france",
    moved: true,
    activated: true,
    occupyingFort: false
  });
  const action: GameAction = {
    type: ActionType.MOVE,
    side: unit.side,
    unitId: unit.id,
    toPos: entry,
    note: `${unit.name} enters French North Africa at ${hexCodeForMap(entry, "west")}.`,
    timestamp: new Date()
  };
  return {
    ...stateAfterPayment,
    units,
    history: [action, ...stateAfterPayment.history],
    timestamp: new Date()
  };
};

export const activateUnitForAction = (state: GameState, unitId: string): GameState | null => {
  const unit = state.units.get(unitId);
  if (!unit || !canCommandUnit(state, unit) || unit.moved) return null;
  if (unit.type === UnitType.AIR && sortiesFor(unit) >= GAME_RULES.AIR.MAX_SORTIES) return null;

  const fnaItalyEntry = activateFnaItalyEntry(state, unit);
  if (fnaItalyEntry) return fnaItalyEntry;

  const stateAfterPayment = spendProductionForActivation(state, unit);
  if (!stateAfterPayment) return null;

  const units = new Map(stateAfterPayment.units);
  units.set(unitId, {
    ...unit,
    moved: true,
    movementSpent: unit.movementSpent || 0
  });

  const cost = activationCostFor(unit);
  const action: GameAction = {
    type: ActionType.HOLD,
    side: unit.side,
    unitId,
    note: cost > 0 ? `${unit.name} activated for ${cost} PP.` : `${unit.name} activated.`,
    timestamp: new Date()
  };

  return {
    ...stateAfterPayment,
    units,
    history: [action, ...stateAfterPayment.history],
    timestamp: new Date()
  };
};

// Unità di terra (escluso FORT che è marker, e AIR che non blocca movimento di terra
// ma viene displaced 4.2.3.7) che occupa l'hex
const getGroundUnitOnHex = (state: GameState, coord: HexCoord): Unit | undefined =>
  Array.from(state.units.values()).find(
    (unit) =>
      unit.type !== UnitType.FORT &&
      unit.type !== UnitType.AIR &&
      unit.status !== UnitStatus.DESTROYED &&
      sameCoord(unit.position, coord)
  );

const groundMoveCost = (state: GameState, from: HexCoord, to: HexCoord, unit: Unit): number => {
  const toHex = state.map.get(coordKey(to));
  const crossingEdge = edgeKey(from, to);
  if (!toHex || isGroundMovementProhibited(state, to, unit) || state.impassableEdges.has(crossingEdge)) return Infinity;

  // Solo unità di terra bloccano l'entry (4.2.3.7: AIR displaced quando una ground entra)
  const groundOnTarget = getGroundUnitOnHex(state, to);
  if (groundOnTarget) return Infinity;

  // 4.2.3.4: il beneficio della Transport Line (tutto trattato come chiaro, 1 MP)
  // NON si riceve entrando o attaccando in un hex con città, forte o unità nemica.
  if (hasTransportLineThroughSide(state, from, to) && !hasEnemyCityOrFort(state, toHex, unit.side)) return 1;

  const hexsideCost = hexsideCrossingCost(state, crossingEdge);
  const zocCost = isEnemyZoc(state, from, unit.side) ? GAME_RULES.MOVEMENT.ZOC_EXIT_COST : 0;
  return baseGroundMovementCost(state, toHex, unit.side) + hexsideCost + zocCost;
};

// 4.2.3.1, primo punto: "A unit cannot move directly between hexes which contain
// an EZOC exerted by the SAME enemy unit." Muoversi verso la ZOC di un'unità
// diversa è invece consentito (secondo punto della stessa regola).
export const movesBetweenSameEnemyZoc = (state: GameState, from: HexCoord, to: HexCoord, movingSide: Side): boolean => {
  const fromZoc = zocExertingUnits(state, from, movingSide).map((unit) => unit.id);
  if (fromZoc.length === 0) return false;
  const toZoc = zocExertingUnits(state, to, movingSide).map((unit) => unit.id);
  if (toZoc.length === 0) return false;
  const toZocSet = new Set(toZoc);
  return fromZoc.some((unitId) => toZocSet.has(unitId));
};


const terrainFor = (q: number, r: number): TerrainType => {
  if ((q === 2 && r > 2 && r < 8) || (q === 8 && r > 1 && r < 7)) return TerrainType.RIVER;
  if ((q + r) % 11 === 0) return TerrainType.CITY;
  if (r > 7 && q < 5) return TerrainType.FOREST;
  if (q > 8 && r < 5) return TerrainType.MOUNTAIN;
  if (q < 2 || r > 9) return TerrainType.COASTAL;
  return TerrainType.PLAIN;
};

const terrainTagsFor = (terrain: TerrainType) => {
  if (terrain === TerrainType.MOUNTAIN) return ["mountain" as const];
  if (terrain === TerrainType.FOREST) return ["forest" as const];
  if (terrain === TerrainType.SEA || terrain === TerrainType.RIVER) return ["sea" as const];
  if (terrain === TerrainType.COASTAL) return ["coast" as const];
  return ["plain" as const];
};

const makeUnit = (
  id: string,
  name: string,
  side: Side,
  country: string,
  type: UnitType,
  strength: number,
  position: HexCoord,
  leadership: number
): Unit => ({
  id,
  name,
  side,
  country,
  type,
  strength,
  maxStrength: strength,
  status: UnitStatus.READY,
  morale: 7,
  position,
  mapPresence: "france",
  moved: false,
  movementSpent: 0,
  // 1.5: Sorties tracciano l'usura accumulata. Una air unit nuova ha 0 sortie ed è "fully effective".
  sorties: type === UnitType.AIR ? 0 : undefined,
  combat: false,
  leadership
});

export const coordFromHexCode = (code: string | number): HexCoord => {
  return coordFromHexCodeForMap(code, "france");
};

interface SetupUnitOptions {
  reduced?: boolean;
  sorties?: number;
  bomber?: boolean;
  mapId?: ScenarioMapId;
}

const makeSetupUnit = (
  country: string,
  counterId: string,
  location: string | number,
  side: Side,
  type: UnitType = UnitType.INFANTRY,
  options: SetupUnitOptions = {}
) => {
  const isAir = type === UnitType.AIR;
  const isFort = type === UnitType.FORT;
  const strength = type === UnitType.ARMOR ? 8 : isAir ? 1 : isFort ? 0 : 7;
  const name = `${country} ${counterId}`;
  const baseId = `${country.toLowerCase().replace(/\s+/g, "_")}_${counterId.toLowerCase().replace(/\s+/g, "_")}`;
  const unit = makeUnit(
    type === UnitType.FORT ? `${baseId}_${String(location)}` : baseId,
    name,
    side,
    country,
    type,
    strength,
    coordFromHexCodeForMap(location, options.mapId || "france"),
    type === UnitType.ARMOR ? 3 : 2
  );
  return {
    ...unit,
    reduced: options.reduced,
    sorties: isAir ? options.sorties ?? unit.sorties : unit.sorties,
    bomber: options.bomber
  };
};

const makeOffMapSetupUnit = (
  country: string,
  counterId: string,
  side: Side,
  type: UnitType = UnitType.INFANTRY,
  options: SetupUnitOptions = {}
): Unit => ({
  ...makeSetupUnit(country, counterId, 2507, side, type, options),
  position: { q: -99, r: -99 },
  mapPresence: "off_map"
});

const makeWestMedSetupUnit = (
  country: string,
  counterId: string,
  side: Side,
  type: UnitType = UnitType.INFANTRY,
  options: SetupUnitOptions = {}
): Unit => ({
  ...makeSetupUnit(country, counterId, 2507, side, type, options),
  position: { q: -98, r: -98 },
  mapPresence: "west_med"
});

const makeCentralMedSetupUnit = (
  country: string,
  counterId: string,
  side: Side,
  type: UnitType = UnitType.INFANTRY,
  options: SetupUnitOptions = {}
): Unit => ({
  ...makeSetupUnit(country, counterId, 2507, side, type, { ...options, mapId: "italy" }),
  position: { q: -97, r: -97 },
  mapPresence: "central_med"
});

const makeEastNaSetupUnit = (
  country: string,
  counterId: string,
  side: Side,
  type: UnitType = UnitType.INFANTRY,
  options: SetupUnitOptions = {}
): Unit => ({
  ...makeSetupUnit(country, counterId, 4002, side, type, { ...options, mapId: "west" }),
  position: { q: -96, r: -96 },
  mapPresence: "east_na"
});

const makeFnaAxisAirSupportUnit = (): Unit => ({
  ...makeSetupUnit("Germany", "FNA Air Support", 4526, Side.AXIS, UnitType.AIR, { mapId: "west", sorties: 4 }),
  id: FNA_AXIS_AIR_SUPPORT_ID,
  name: "Germany FNA Air",
  bomber: false
});

const makeMobilizationSetupUnit = (
  country: string,
  counterId: string,
  side: Side,
  type: UnitType = UnitType.INFANTRY,
  options: SetupUnitOptions & { entryTurn?: number; freeMobilization?: boolean } = {}
): Unit => ({
  ...makeOffMapSetupUnit(country, counterId, side, type, options),
  status: UnitStatus.DESTROYED,
  ...(options.entryTurn !== undefined ? { entryTurn: options.entryTurn } : {}),
  ...(options.freeMobilization ? { freeMobilization: true } : {})
});

const makeBalkansSetupUnit = (
  country: string,
  counterId: string,
  location: string | number,
  side: Side,
  type: UnitType = UnitType.INFANTRY,
  options: SetupUnitOptions = {}
): Unit => makeSetupUnit(country, counterId, location, side, type, { ...options, mapId: "balkans" });

export const createFrance1940Units = (): Map<string, Unit> => {
  const units = new Map<string, Unit>();
  const setupUnits = [
    makeSetupUnit("Belgium", "1", 2717, Side.ALLIED),
    makeSetupUnit("France", "1", 2815, Side.ALLIED),
    makeSetupUnit("France", "2", 2917, Side.ALLIED),
    makeSetupUnit("France", "3", 3017, Side.ALLIED),
    makeSetupUnit("France", "4", 3018, Side.ALLIED),
    makeSetupUnit("France", "5", 3019, Side.ALLIED),
    makeSetupUnit("France", "6", 3117, Side.ALLIED),
    makeSetupUnit("France", "7", 2714, Side.ALLIED),
    makeSetupUnit("France", "8", 3120, Side.ALLIED),
    makeSetupUnit("France", "9", 2916, Side.ALLIED),
    makeSetupUnit("France", "10", 3014, Side.ALLIED),
    makeSetupUnit("France", "1 Air", 3116, Side.ALLIED, UnitType.AIR),
    makeSetupUnit("France", "Maginot Fort", 3017, Side.ALLIED, UnitType.FORT),
    makeSetupUnit("France", "Maginot Fort", 3018, Side.ALLIED, UnitType.FORT),
    makeSetupUnit("France", "Maginot Fort", 3019, Side.ALLIED, UnitType.FORT),
    makeSetupUnit("France", "Maginot Fort", 3120, Side.ALLIED, UnitType.FORT),
    makeSetupUnit("Netherlands", "Dutch", 2617, Side.ALLIED),
    makeSetupUnit("UK", "BEF", 2814, Side.ALLIED),
    makeSetupUnit("UK", "Ftr Cmd", 2611, Side.ALLIED, UnitType.AIR),
    makeSetupUnit("Germany", "1", 3020, Side.AXIS),
    makeSetupUnit("Germany", "2", 2921, Side.AXIS),
    makeSetupUnit("Germany", "4", 2819, Side.AXIS),
    makeSetupUnit("Germany", "6", 2719, Side.AXIS),
    makeSetupUnit("Germany", "7", 3121, Side.AXIS),
    makeSetupUnit("Germany", "8", 2720, Side.AXIS),
    makeSetupUnit("Germany", "9", 2820, Side.AXIS),
    makeSetupUnit("Germany", "10", 2920, Side.AXIS),
    makeSetupUnit("Germany", "1 Pz", 2818, Side.AXIS, UnitType.ARMOR),
    makeSetupUnit("Germany", "2 Pz", 2919, Side.AXIS, UnitType.ARMOR),
    makeSetupUnit("Germany", "1 Luf", 2719, Side.AXIS, UnitType.AIR),
    makeSetupUnit("Germany", "2 Luf", 2818, Side.AXIS, UnitType.AIR),
    makeSetupUnit("Germany", "3 Luf", 2619, Side.AXIS, UnitType.AIR)
  ];

  setupUnits.forEach((unit) => units.set(unit.id, unit));
  return units;
};

export const createFrance1941Units = (): Map<string, Unit> => {
  const units = new Map<string, Unit>();
  const setupUnits = [
    makeSetupUnit("Belgium", "1", 2717, Side.ALLIED),
    makeSetupUnit("France", "1 Tank", 2815, Side.ALLIED, UnitType.ARMOR),
    makeSetupUnit("France", "3", 3017, Side.ALLIED),
    makeSetupUnit("France", "4", 3018, Side.ALLIED),
    makeSetupUnit("France", "5", 3019, Side.ALLIED),
    makeSetupUnit("France", "6", 3117, Side.ALLIED),
    makeSetupUnit("France", "8", 3120, Side.ALLIED),
    makeSetupUnit("France", "10", 3014, Side.ALLIED),
    makeSetupUnit("France", "3 N.Afr", 3817, Side.ALLIED),
    makeSetupUnit("France", "1 Gd", 2916, Side.ALLIED),
    makeSetupUnit("France", "2 Gd", 2714, Side.ALLIED),
    makeSetupUnit("France", "3 Gd", 2917, Side.ALLIED),
    makeSetupUnit("France", "Alps", 3619, Side.ALLIED),
    makeSetupUnit("France", "1 Air", 3116, Side.ALLIED, UnitType.AIR),
    makeSetupUnit("France", "Maginot Fort", 3017, Side.ALLIED, UnitType.FORT),
    makeSetupUnit("France", "Maginot Fort", 3018, Side.ALLIED, UnitType.FORT),
    makeSetupUnit("France", "Maginot Fort", 3019, Side.ALLIED, UnitType.FORT),
    makeSetupUnit("France", "Maginot Fort", 3120, Side.ALLIED, UnitType.FORT),
    makeSetupUnit("Netherlands", "Dutch", 2617, Side.ALLIED),
    makeSetupUnit("UK", "BEF", 2814, Side.ALLIED),
    makeSetupUnit("UK", "Ftr Cmd", 2611, Side.ALLIED, UnitType.AIR),
    makeSetupUnit("Germany", "1", 3020, Side.AXIS),
    makeSetupUnit("Germany", "2", 2921, Side.AXIS),
    makeSetupUnit("Germany", "4", 2819, Side.AXIS),
    makeSetupUnit("Germany", "6", 3121, Side.AXIS),
    makeSetupUnit("Germany", "7", 2719, Side.AXIS),
    makeSetupUnit("Germany", "8", 2820, Side.AXIS),
    makeSetupUnit("Germany", "9", 2920, Side.AXIS),
    makeSetupUnit("Germany", "10", 2619, Side.AXIS),
    makeSetupUnit("Germany", "1 Pz", 2818, Side.AXIS, UnitType.ARMOR),
    makeSetupUnit("Germany", "2 Pz", 2919, Side.AXIS, UnitType.ARMOR),
    makeSetupUnit("Germany", "1 Luf", 2719, Side.AXIS, UnitType.AIR),
    makeSetupUnit("Germany", "2 Luf", 2818, Side.AXIS, UnitType.AIR),
    makeSetupUnit("Germany", "3 Luf", 2619, Side.AXIS, UnitType.AIR),
    makeSetupUnit("Italy", "1", 3520, Side.AXIS),
    makeSetupUnit("Italy", "2", 3620, Side.AXIS)
  ];

  setupUnits.forEach((unit) => units.set(unit.id, unit));
  return units;
};

export const createFrance1944Units = (): Map<string, Unit> => {
  const units = new Map<string, Unit>();
  const setupUnits = [
    makeSetupUnit("Germany", "1", 3610, Side.AXIS),
    makeSetupUnit("Germany", "6", 2716, Side.AXIS),
    makeSetupUnit("Germany", "7", 3209, Side.AXIS),
    makeSetupUnit("Germany", "9", 3817, Side.AXIS),
    makeSetupUnit("Germany", "Afrika", 2616, Side.AXIS),
    makeSetupUnit("Germany", "1 Para", 2719, Side.AXIS, UnitType.INFANTRY, { reduced: true }),
    makeSetupUnit("Germany", "5 Pz", 3014, Side.AXIS, UnitType.ARMOR),
    makeSetupUnit("Germany", "3 Luf", 3017, Side.AXIS, UnitType.AIR, { sorties: 4 }),
    makeSetupUnit("Germany", "2 Gar", 2813, Side.AXIS),
    makeSetupUnit("Germany", "3 Gar", 2912, Side.AXIS),
    makeSetupUnit("Germany", "4 Gar", 2910, Side.AXIS),
    makeSetupUnit("Germany", "5 Gar", 3107, Side.AXIS),
    makeMobilizationSetupUnit("Germany", "7 Gar", Side.AXIS),
    makeSetupUnit("UK", "1 Can", 2611, Side.ALLIED),
    makeSetupUnit("UK", "2", 2710, Side.ALLIED),
    makeSetupUnit("UK", "Ftr Cmd", 2611, Side.ALLIED, UnitType.AIR, { sorties: 2 }),
    makeSetupUnit("UK", "2 RAF", 2710, Side.ALLIED, UnitType.AIR),
    makeSetupUnit("UK", "Bmb Cmd", 2611, Side.ALLIED, UnitType.AIR, { sorties: 5, bomber: true }),
    makeWestMedSetupUnit("USA", "1 French", Side.ALLIED),
    makeSetupUnit("USA", "1", 2807, Side.ALLIED),
    makeSetupUnit("USA", "3", 2607, Side.ALLIED),
    makeWestMedSetupUnit("USA", "7", Side.ALLIED),
    makeMobilizationSetupUnit("USA", "9", Side.ALLIED),
    makeSetupUnit("USA", "8AAF", 2710, Side.ALLIED, UnitType.AIR, { sorties: 5, bomber: true }),
    makeSetupUnit("USA", "9AAF", 2807, Side.ALLIED, UnitType.AIR),
    makeWestMedSetupUnit("USA", "FTAF", Side.ALLIED, UnitType.AIR, { sorties: 2 })
  ];

  setupUnits.forEach((unit) => units.set(unit.id, unit));
  return units;
};

export const createBalkans1941Units = (): Map<string, Unit> => {
  const units = new Map<string, Unit>();
  const setupUnits = [
    makeBalkansSetupUnit("Bulgaria", "5", 3837, Side.AXIS),
    makeBalkansSetupUnit("Germany", "2", 3329, Side.AXIS),
    makeBalkansSetupUnit("Germany", "10", 4038, Side.AXIS),
    makeBalkansSetupUnit("Germany", "1 Pz", 4037, Side.AXIS, UnitType.ARMOR),
    makeBalkansSetupUnit("Germany", "2 Pz", 3536, Side.AXIS, UnitType.ARMOR),
    makeBalkansSetupUnit("Germany", "2 Luf", 3333, Side.AXIS, UnitType.AIR),
    makeBalkansSetupUnit("Hungary", "3", 3432, Side.AXIS),
    makeBalkansSetupUnit("Italy", "2", 3527, Side.AXIS),
    makeBalkansSetupUnit("Italy", "9", 4134, Side.AXIS),
    makeBalkansSetupUnit("Italy", "11", 4233, Side.AXIS),
    makeBalkansSetupUnit("Greece", "1", 4234, Side.ALLIED),
    makeBalkansSetupUnit("Greece", "2", 4138, Side.ALLIED),
    makeBalkansSetupUnit("UK", "BEF", 4236, Side.ALLIED),
    makeBalkansSetupUnit("Yugoslavia", "1", 3532, Side.ALLIED),
    makeBalkansSetupUnit("Yugoslavia", "2", 3629, Side.ALLIED),
    makeBalkansSetupUnit("Yugoslavia", "3", 3832, Side.ALLIED),
    makeBalkansSetupUnit("Yugoslavia", "4", 3429, Side.ALLIED),
    makeBalkansSetupUnit("Yugoslavia", "5", 3835, Side.ALLIED),
    makeBalkansSetupUnit("Yugoslavia", "6", 3634, Side.ALLIED)
  ];

  setupUnits.forEach((unit) => units.set(unit.id, unit));
  return units;
};

export const createFrenchNorthAfrica1942Units = (): Map<string, Unit> => {
  const units = new Map<string, Unit>();
  const setupUnits = [
    makeSetupUnit("Germany", "Afrika", 5123, Side.AXIS, UnitType.INFANTRY, { mapId: "west" }),
    makeSetupUnit("Germany", "5 Pz", 4622, Side.AXIS, UnitType.ARMOR, { mapId: "west" }),
    makeOffMapSetupUnit("Fr.N.Africa", "1", Side.AXIS),
    makeOffMapSetupUnit("Fr.N.Africa", "2", Side.AXIS),
    makeOffMapSetupUnit("Fr.N.Africa", "3", Side.AXIS),
    makeOffMapSetupUnit("Italy", "1", Side.AXIS),
    makeSetupUnit("UK", "1 RAF", 5224, Side.ALLIED, UnitType.AIR, { mapId: "west" }),
    makeEastNaSetupUnit("UK", "1 Can", Side.ALLIED),
    makeSetupUnit("UK", "8", 5223, Side.ALLIED, UnitType.INFANTRY, { mapId: "west" }),
    makeEastNaSetupUnit("UK", "9", Side.ALLIED),
    makeEastNaSetupUnit("USA", "Tsk Frc", Side.ALLIED),
    makeEastNaSetupUnit("USA", "9 AAF", Side.ALLIED, UnitType.AIR),
    makeFnaAxisAirSupportUnit()
  ];

  setupUnits.forEach((unit) => units.set(unit.id, unit));
  return units;
};

export const createItaly1943Units = (): Map<string, Unit> => {
  const units = new Map<string, Unit>();
  const setupUnits = [
    // Italy 1943-44, Exclude-Italy opening.
    makeMobilizationSetupUnit("Germany", "4", Side.AXIS),
    makeSetupUnit("Germany", "8", 4025, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Germany", "10", 4230, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Germany", "6 Gar", 3522, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeMobilizationSetupUnit("Germany", "7 Gar", Side.AXIS),
    makeSetupUnit("Germany", "8 Gar", 4028, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Germany", "Liguria", 3520, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Germany", "2 Luf", 4127, Side.AXIS, UnitType.AIR, { mapId: "italy", sorties: 4 }),
    makeCentralMedSetupUnit("UK", "8", Side.ALLIED),
    makeCentralMedSetupUnit("UK", "1 RAF", Side.ALLIED, UnitType.AIR, { sorties: 2 }),
    makeCentralMedSetupUnit("USA", "9", Side.ALLIED),
    makeCentralMedSetupUnit("USA", "10", Side.ALLIED),
    makeSetupUnit("USA", "5", 4622, Side.ALLIED, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("USA", "9 AAF", 4622, Side.ALLIED, UnitType.AIR, { mapId: "italy", sorties: 2 }),
    makeMobilizationSetupUnit("USA", "12 AAF", Side.ALLIED, UnitType.AIR),
    makeMobilizationSetupUnit("USA", "7", Side.ALLIED)
  ];

  setupUnits.forEach((unit) => units.set(unit.id, unit));
  return units;
};

export const createItaly1943IncludeUnits = (): Map<string, Unit> => {
  const units = new Map<string, Unit>();
  const setupUnits = [
    // Italy 1943-44, Include-Italy opening. Uses the same Italy map seed.
    makeMobilizationSetupUnit("Germany", "4", Side.AXIS),
    makeSetupUnit("Germany", "8", 4025, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Germany", "10", 4230, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Germany", "6 Gar", 3522, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Germany", "7 Gar", 4628, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Germany", "8 Gar", 3424, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeMobilizationSetupUnit("Germany", "Liguria", Side.AXIS),
    makeSetupUnit("Germany", "2 Luf", 4127, Side.AXIS, UnitType.AIR, { mapId: "italy", sorties: 4 }),
    makeSetupUnit("Italy", "1", 3624, Side.AXIS, UnitType.INFANTRY, { mapId: "italy", reduced: true }),
    makeSetupUnit("Italy", "2", 3527, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Italy", "4", 4231, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Italy", "5", 3426, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Italy", "6", 4526, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Italy", "7", 3525, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Italy", "8", 4127, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("Italy", "10", 3621, Side.AXIS, UnitType.INFANTRY, { mapId: "italy" }),
    makeMobilizationSetupUnit("Italy", "9", Side.AXIS),
    makeMobilizationSetupUnit("Italy", "11", Side.AXIS),
    makeSetupUnit("Italy", "1 Air", 4628, Side.AXIS, UnitType.AIR, { mapId: "italy", sorties: 4 }),
    makeCentralMedSetupUnit("UK", "8", Side.ALLIED),
    makeCentralMedSetupUnit("UK", "1 RAF", Side.ALLIED, UnitType.AIR, { sorties: 2 }),
    makeCentralMedSetupUnit("UK", "Malta", Side.ALLIED),
    makeCentralMedSetupUnit("USA", "9", Side.ALLIED),
    makeCentralMedSetupUnit("USA", "10", Side.ALLIED),
    makeSetupUnit("USA", "5", 4622, Side.ALLIED, UnitType.INFANTRY, { mapId: "italy" }),
    makeSetupUnit("USA", "9 AAF", 4622, Side.ALLIED, UnitType.AIR, { mapId: "italy", sorties: 2 }),
    makeMobilizationSetupUnit("USA", "12 AAF", Side.ALLIED, UnitType.AIR),
    makeMobilizationSetupUnit("USA", "7", Side.ALLIED)
  ];

  setupUnits.forEach((unit) => units.set(unit.id, unit));
  return units;
};

export const createBarbarossa1941Units = (): Map<string, Unit> => {
  const units = new Map<string, Unit>();

  const add = (country: string, counterId: string, location: number | string, side: Side, type: UnitType, opts: SetupUnitOptions = {}) => {
    const unit = makeSetupUnit(country, counterId, location, side, type, { ...opts, mapId: "russia" });
    units.set(unit.id, unit);
  };
  const addMob = (country: string, counterId: string, side: Side, type: UnitType = UnitType.INFANTRY, opts: { entryTurn?: number; freeMobilization?: boolean } = {}) => {
    const unit = makeMobilizationSetupUnit(country, counterId, side, type, opts);
    units.set(unit.id, unit);
  };

  // ===== AXIS FORCES =====

  // FINLAND
  add("Finland", "1 Inf", "1540", Side.AXIS, UnitType.INFANTRY);
  add("Finland", "2 Inf", "1442", Side.AXIS, UnitType.INFANTRY);
  add("Finland", "3 Inf", "1343", Side.AXIS, UnitType.INFANTRY);
  add("Finland", "4 Inf", "1344", Side.AXIS, UnitType.INFANTRY);
  add("Finland", "5 Inf", "1540", Side.AXIS, UnitType.INFANTRY);

  // GERMANY - Army Group North
  add("Germany", "Corps 18", "2235", Side.AXIS, UnitType.INFANTRY);
  add("Germany", "Pz Group 4", "2236", Side.AXIS, UnitType.ARMOR);
  add("Germany", "Luftflotte 1", "2236", Side.AXIS, UnitType.AIR, { sorties: 3 });

  // GERMANY - Army Group Center
  add("Germany", "Corps 16", "2337", Side.AXIS, UnitType.INFANTRY);
  add("Germany", "Pz Group 3", "2436", Side.AXIS, UnitType.ARMOR);
  add("Germany", "Corps 9", "2537", Side.AXIS, UnitType.INFANTRY);
  add("Germany", "Luftflotte 2", "2637", Side.AXIS, UnitType.AIR, { sorties: 3 });
  add("Germany", "Pz Group 2", "2637", Side.AXIS, UnitType.ARMOR);
  add("Germany", "Corps 2", "2634", Side.AXIS, UnitType.INFANTRY);
  add("Germany", "Corps 4", "2738", Side.AXIS, UnitType.INFANTRY);

  // GERMANY - Army Group South
  add("Germany", "Corps 17", "3037", Side.AXIS, UnitType.INFANTRY);
  add("Germany", "Luftflotte 4", "2937", Side.AXIS, UnitType.AIR, { sorties: 2 });
  add("Germany", "Corps 6", "2837", Side.AXIS, UnitType.INFANTRY);
  add("Germany", "Corps 11", "3442", Side.AXIS, UnitType.INFANTRY);
  add("Germany", "Pz Group 1", "2937", Side.AXIS, UnitType.ARMOR);

  // HUNGARY
  add("Hungary", "Corps", "3138", Side.AXIS, UnitType.INFANTRY);

  // ROMANIA
  add("Romania", "Army 3", "3240", Side.AXIS, UnitType.INFANTRY);
  add("Romania", "Army 1", "3241", Side.AXIS, UnitType.INFANTRY);
  add("Romania", "Army 4", "3544", Side.AXIS, UnitType.INFANTRY);

  // ===== SOVIET FORCES =====

  // Forts
  add("USSR", "Leningrad Fort", "1546", Side.ALLIED, UnitType.FORT);
  add("USSR", "Moscow Fort", "2154", Side.ALLIED, UnitType.FORT);
  add("USSR", "Sevastopol Fort", "3649", Side.ALLIED, UnitType.FORT);

  // Armies on map
  add("USSR", "Army 27", "1546", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 8",  "2136", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 11", "2237", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 3",  "2338", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 10", "2437", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 13", "2442", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 4",  "2638", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 5",  "2739", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 6",  "2838", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 26", "3038", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 12", "3139", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 21", "3141", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 38", "3343", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 9",  "3444", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Army 37", "3649", Side.ALLIED, UnitType.INFANTRY);
  add("USSR", "Air 1", "2439", Side.ALLIED, UnitType.AIR, { sorties: 4 });
  add("USSR", "Air 2", "2942", Side.ALLIED, UnitType.AIR, { sorties: 4 });

  // SOVIET Reserves (mobilization) — Emergency Jun-41: entrano al turno 1 gratuitamente
  addMob("USSR", "Air 3", Side.ALLIED, UnitType.AIR, { entryTurn: 1, freeMobilization: true });
  addMob("USSR", "Army 7",  Side.ALLIED, UnitType.INFANTRY, { entryTurn: 1, freeMobilization: true });
  addMob("USSR", "Army 14", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 1, freeMobilization: true });
  addMob("USSR", "Army 16", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 1, freeMobilization: true });
  addMob("USSR", "Army 22", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 1, freeMobilization: true });
  addMob("USSR", "Army 23", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 1, freeMobilization: true });
  // Riserve programmate — entrano via schedule turni 2-5
  addMob("USSR", "Army 30", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 2 });
  addMob("USSR", "Army 33", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 2 });
  addMob("USSR", "Army 50", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 3 });
  addMob("USSR", "Army 44", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 3 });
  addMob("USSR", "Army 45", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 4 });
  addMob("USSR", "Army 46", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 4 });
  addMob("USSR", "Army 51", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 5 });
  addMob("USSR", "Army 62", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 5 });

  return units;
};

// Russia 1941-1944: stesso setup Barbarossa + unità aggiuntive con Entry-H (mobilization)
export const createRussia19411944Units = (): Map<string, Unit> => {
  const units = createBarbarossa1941Units();

  const add = (country: string, counterId: string, location: number | string, side: Side, type: UnitType, opts: SetupUnitOptions = {}) => {
    const unit = makeSetupUnit(country, counterId, location, side, type, { ...opts, mapId: "russia" });
    units.set(unit.id, unit);
  };
  const addMob = (country: string, counterId: string, side: Side, type: UnitType = UnitType.INFANTRY, opts: { entryTurn?: number; freeMobilization?: boolean } = {}) => {
    const unit = makeMobilizationSetupUnit(country, counterId, side, type, opts);
    units.set(unit.id, unit);
  };

  // ===== ASSE — rinforzi con Entry-H (gestiti via mobilizzazione) =====

  // Luftflotte 6: Mobilization Dec-41 (t7)
  addMob("Germany", "Luftflotte 6", Side.AXIS, UnitType.AIR, { entryTurn: 7 });
  // Hungary Corps 2: Jan-42 (t8)
  addMob("Hungary", "Corps 2", Side.AXIS, UnitType.INFANTRY, { entryTurn: 8 });
  // Italy Army 8: Apr-42 (t11)
  addMob("Italy", "Army 8", Side.AXIS, UnitType.INFANTRY, { entryTurn: 11 });
  // Germany Corps 20: Jun-42 (t13)
  addMob("Germany", "Corps 20", Side.AXIS, UnitType.INFANTRY, { entryTurn: 13 });
  // Germany 8 Gar + Vlasov: Nov-43 (t30)
  addMob("Germany", "8 Gar", Side.AXIS, UnitType.INFANTRY, { entryTurn: 30 });
  addMob("Germany", "Vlasov", Side.AXIS, UnitType.INFANTRY, { entryTurn: 30 });
  // Germany Corps 12: Jan-44 (t32)
  addMob("Germany", "Corps 12", Side.AXIS, UnitType.INFANTRY, { entryTurn: 32 });

  // ===== SOVIETICI — Shock Armies (disponibili Sep-41 = t4) =====
  addMob("USSR", "Shock 1", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 4 });
  addMob("USSR", "Shock 2", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 4 });
  addMob("USSR", "Shock 3", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 5 });
  addMob("USSR", "Shock 4", Side.ALLIED, UnitType.INFANTRY, { entryTurn: 5 });

  // ===== SOVIETICI — Tank Armies (Jun-42+ = t13+) =====
  addMob("USSR", "Tank 1", Side.ALLIED, UnitType.ARMOR, { entryTurn: 13 });
  addMob("USSR", "Tank 2", Side.ALLIED, UnitType.ARMOR, { entryTurn: 13 });
  addMob("USSR", "Tank 3", Side.ALLIED, UnitType.ARMOR, { entryTurn: 13 });
  addMob("USSR", "Tank 4", Side.ALLIED, UnitType.ARMOR, { entryTurn: 14 });
  addMob("USSR", "Tank 5", Side.ALLIED, UnitType.ARMOR, { entryTurn: 18 });
  addMob("USSR", "Tank 6", Side.ALLIED, UnitType.ARMOR, { entryTurn: 19 });

  // ===== SOVIETICI — Air aggiuntiva (Jan-43 = t20) =====
  addMob("USSR", "Air 4", Side.ALLIED, UnitType.AIR, { entryTurn: 20 });
  addMob("USSR", "Air 5", Side.ALLIED, UnitType.AIR, { entryTurn: 20 });

  // ===== SOVIETICI — Convoy (1 Convoy in 3649) =====
  add("USSR", "1 Convoy", "3649", Side.ALLIED, UnitType.INFANTRY);

  return units;
};

export const createScenarioUnits = (scenario: ScenarioId | "procedural" = DEFAULT_SCENARIO_ID): Map<string, Unit> => {
  if (scenario === "france1944") return createFrance1944Units();
  if (scenario === "france1941") return createFrance1941Units();
  if (scenario === "balkans1941") return createBalkans1941Units();
  if (scenario === "frenchNorthAfrica1942") return createFrenchNorthAfrica1942Units();
  if (scenario === "italy1943Include") return createItaly1943IncludeUnits();
  if (scenario === "italy1943") return createItaly1943Units();
  if (scenario === "russia19411944") return createRussia19411944Units();
  if (scenario === "barbarossa1941") return createBarbarossa1941Units();
  if (scenario === "procedural") return new Map<string, Unit>();
  return createFrance1940Units();
};

const createFrance2AirReinforcement = (position: HexCoord): Unit =>
  makeUnit("france_2_air", "France 2 Air", Side.ALLIED, "France", UnitType.AIR, 1, position, 2);

const hasUnitStackingRoom = (state: GameState, coord: HexCoord): boolean =>
  !Array.from(state.units.values()).some(
    (unit) => unit.type !== UnitType.FORT && unit.status !== UnitStatus.DESTROYED && sameCoord(unit.position, coord)
  );

const findFrance2AirPlacement = (state: GameState): HexCoord | null => {
  const friendlyFrenchCities = Array.from(state.map.values()).filter((hex) => {
    const isFrench = hex.features.country === "France";
    const isFriendly = !hex.features.controller || hex.features.controller === Side.ALLIED;
    const isCity = hex.features.city || hex.features.capital || hex.features.productionCenter;
    return isFrench && isFriendly && isCity && hasUnitStackingRoom(state, hex.coord);
  });

  const preferred = friendlyFrenchCities.find((hex) => hex.features.capital || hex.features.name === "Paris");
  return (preferred || friendlyFrenchCities[0])?.coord || null;
};

const applyFranceAirReinforcementEvent = (state: GameState): { units: Map<string, Unit>; note: string | null } => {
  const isFrance1940Event = state.scenarioId === "france1940" && state.turnCode === "May-40";
  const isFrance1941Event = state.scenarioId === "france1941" && state.turnCode === "May-41";
  if ((!isFrance1940Event && !isFrance1941Event) || state.currentSide !== Side.AXIS) return { units: state.units, note: null };
  if (state.units.has("france_2_air")) return { units: state.units, note: null };

  const placement = findFrance2AirPlacement(state);
  if (!placement) {
    return {
      units: state.units,
      note: "France 2 Air could not be placed: no friendly French city with stacking room was found."
    };
  }

  const availableSorties = 4;
  const units = new Map(state.units);
  units.set("france_2_air", {
    ...createFrance2AirReinforcement(placement),
    sorties: GAME_RULES.AIR.MAX_SORTIES - availableSorties,
    movementSpent: 0,
    moved: false
  });
  return {
    units,
    note: `France 2 Air placed at ${hexCodeFor(placement)} with ${availableSorties} sorties available.`
  };
};

const applyScenarioMobilizationSchedule = (state: GameState): { state: GameState; notes: string[] } => {
  if (!isItaly1943Scenario(state.scenarioId) && !isBarbarossa1941Scenario(state.scenarioId)) return { state, notes: [] };

  let schedule: Record<number, string[]> = {};

  if (state.scenarioId === "russia19411944") {
    // Turni 1=Jun-41 … 43=Dec-44
    // Asse: cambi PP annuali; rinforzi tedeschi, ungheresi, italiani
    // URSS: Shock armies, armate di riserva, tank armies, rinforzi vari
    schedule = {
      // Jul-41 (t2): Armate sovietiche di riserva
      2:  ["ussr_army_30", "ussr_army_33"],
      // Aug-41 (t3)
      3:  ["ussr_army_50", "ussr_army_44"],
      // Sep-41 (t4): Shock 1-4 disponibili per mobilizzazione (entry Oct/Nov, disponibili Sep)
      4:  ["ussr_army_45", "ussr_army_46", "ussr_shock_1", "ussr_shock_2"],
      // Oct-41 (t5): Shock 3-4
      5:  ["ussr_army_51", "ussr_army_62", "ussr_shock_3", "ussr_shock_4"],
      // Nov-41 (t6)
      6:  [],
      // Dec-41 (t7): Luft 6 Mob; Partisans #2 già in eventsBox
      7:  ["germany_luftflotte_6"],
      // Jan-42 (t8): cambia PP Germania a 11; Hungary 2 Mob
      8:  ["hungary_corps_2"],
      // Feb-42 (t9)
      9:  [],
      // Mar-42 (t10)
      10: [],
      // Apr-42 (t11): Italy 8 → 2933
      11: ["italy_army_8"],
      // May-42 (t12)
      12: [],
      // Jun-42 (t13): Corps 20 → 2235; Tank 1-3 Mob
      13: ["germany_corps_20", "ussr_tank_1", "ussr_tank_2", "ussr_tank_3"],
      // Jul-42 (t14): Tank 4
      14: ["ussr_tank_4"],
      // Aug-42 (t15)
      15: [],
      // Sep-42 (t16)
      16: [],
      // Oct-42 (t17)
      17: [],
      // Nov-42 (t18): Tank 5
      18: ["ussr_tank_5"],
      // Dec-42 (t19): Tank 6
      19: ["ussr_tank_6"],
      // Jan-43 (t20): cambia PP Germania a 9; Air 4-5 Mob
      20: ["ussr_air_4", "ussr_air_5"],
      // Feb-43 (t21) → Nov-43 (t30): nessun rinforzo programmato
      // Nov-43 (t30): 8 Gar + Vlasov → 2235
      30: ["germany_8_gar", "germany_vlasov"],
      // Jan-44 (t32): Corps 12 → 2235
      32: ["germany_corps_12"]
    };
  } else if (isBarbarossa1941Scenario(state.scenarioId)) {
    // Turni Jul-41 → Dec-41 (turni 2-7) — solo scenario Barbarossa breve
    schedule = {
      2: ["ussr_army_30", "ussr_army_33"],
      3: ["ussr_army_50", "ussr_army_44"],
      4: ["ussr_army_45", "ussr_army_46"],
      5: ["ussr_army_51", "ussr_army_62"],
      6: [],
      7: []
    };
  } else if (state.scenarioId === "italy1943Include") {
    schedule = {
      4: ["germany_4"],
      6: ["usa_12_aaf"],
      11: ["usa_7"]
    };
  } else {
    schedule = {
      3: ["germany_4"],
      5: ["usa_12_aaf"],
      10: ["usa_7"]
    };
  }

  const unitIds = schedule[state.turn] || [];

  const factionCards = {
    [Side.AXIS]: {
      ...state.factionCards[Side.AXIS],
      mobilizationBox: [...state.factionCards[Side.AXIS].mobilizationBox]
    },
    [Side.ALLIED]: {
      ...state.factionCards[Side.ALLIED],
      mobilizationBox: [...state.factionCards[Side.ALLIED].mobilizationBox]
    }
  };
  const notes: string[] = [];

  // Russia 1941-1944: aggiorna PP Germania all'inizio del nuovo anno
  if (state.scenarioId === "russia19411944") {
    const turnCode = state.turnCode;
    if (turnCode === "Jan-42") {
      factionCards[Side.AXIS].productionPoints = { ...factionCards[Side.AXIS].productionPoints, Germany: 11 };
      notes.push("Germania: produzione ridotta a 11 PP/turno (1942).");
    } else if (turnCode === "Jan-43") {
      factionCards[Side.AXIS].productionPoints = { ...factionCards[Side.AXIS].productionPoints, Germany: 9 };
      notes.push("Germania: produzione ridotta a 9 PP/turno (1943-44).");
    }
  }

  unitIds.forEach((unitId) => {
    const unit = state.units.get(unitId);
    if (!unit) return;
    const card = factionCards[unit.side];
    if (card.mobilizationBox.includes(unitId)) return;
    card.mobilizationBox.push(unitId);
    notes.push(`${unit.name} disponibile in Mobilitazione`);
  });

  // Urals Factories: Jul-41 (t2 in entrambi gli scenari) — 2 unità sovietiche entrano in mobilizationBox
  // Modellate come Army 30 + Army 33 già nello schedule; non serve aggiunta separata.
  // (Le regole dicono "2 unità entrano nel Turn Track a Jul-41" — già gestito dallo schedule t2.)

  let units = state.units;

  // Rimozione Luftflotte Dec-41 (t7 russia19411944 / t7 barbarossa1941):
  // L'Asse deve rimuovere un Luftflotte dal fronte Est. Lo gestiamo automaticamente
  // rimuovendo il Luftflotte con più sortie usate (il più sfruttato).
  if (isBarbarossa1941Scenario(state.scenarioId) && state.turn === 7) {
    const luftflottes = Array.from(state.units.values()).filter(
      (u) =>
        u.country === "Germany" &&
        u.type === UnitType.AIR &&
        u.status !== UnitStatus.DESTROYED &&
        u.name.toLowerCase().includes("luftflotte") &&
        !u.name.toLowerCase().includes("6") // Luft 6 arriva proprio in Dec-41, non va rimossa
    );
    if (luftflottes.length > 0) {
      // Rimuove quella con meno sortie disponibili (la più sfruttata)
      const toRemove = luftflottes.reduce((a, b) => (a.sorties ?? 0) <= (b.sorties ?? 0) ? a : b);
      units = new Map(units);
      units.set(toRemove.id, { ...toRemove, status: UnitStatus.DESTROYED, mapPresence: "off_map" });
      notes.push(`${toRemove.name} ritirata dal fronte Est (regola Dec-41).`);
    }
  }

  // Rimozione Italia Jul-43 (t25 russia19411944): l'unità italiana viene rimossa dallo scenario
  if (state.scenarioId === "russia19411944" && state.turn === 25) {
    const italyUnit = Array.from(state.units.values()).find(
      (u) => u.country === "Italy" && u.side === Side.AXIS && u.status !== UnitStatus.DESTROYED
    );
    if (italyUnit) {
      units = new Map(units);
      units.set(italyUnit.id, { ...italyUnit, status: UnitStatus.DESTROYED, mapPresence: "off_map", entryTurn: 999 });
      // Rimuove dalla mobilizationBox e eliminatedBox per non farla rientrare
      factionCards[Side.AXIS].mobilizationBox = factionCards[Side.AXIS].mobilizationBox.filter((id) => id !== italyUnit.id);
      factionCards[Side.AXIS].eliminatedBox = factionCards[Side.AXIS].eliminatedBox.filter((id) => id !== italyUnit.id);
      notes.push(`${italyUnit.name} rimossa dallo scenario (regola Jul-43).`);
    }
  }

  if (notes.length === 0) return { state, notes };
  return { state: { ...state, factionCards, units }, notes };
};

export interface InitialGameOptions {
  width?: number;
  height?: number;
  shortRowWidth?: number;
  shortRowsStart?: "even" | "odd";
  scenario?: ScenarioId | "procedural"; // default: scenario attivo del registro scenari
}

// Mappatura nazione → side per il controllo iniziale di città/territorio.
const initialControllerForCountry = (country: string | undefined, scenario: ScenarioId | "procedural" = DEFAULT_SCENARIO_ID): Side | "neutral" | undefined => {
  if (!country) return undefined;
  if (scenario === "balkans1941") {
    if (["Germany", "Italy", "Hungary", "Romania", "Bulgaria", "Albania"].includes(country)) return Side.AXIS;
    if (["Greece", "Yugoslavia", "UK"].includes(country)) return Side.ALLIED;
  }
  if (scenario === "france1944") {
    if (country === "Germany") return Side.AXIS;
    if (country === "UK" || country === "USA") return Side.ALLIED;
    if (["France", "Belgium", "Netherlands"].includes(country)) return Side.AXIS;
    if (country === "Italy") return "neutral";
  }
  if (isItaly1943Scenario(scenario)) {
    if (["Germany", "Italy", "Yugoslavia"].includes(country)) return Side.AXIS;
    if (["UK", "USA", "France"].includes(country)) return Side.ALLIED;
  }
  if (scenario === "frenchNorthAfrica1942") {
    if (["Germany", "Italy", "Fr.N.Africa"].includes(country)) return Side.AXIS;
    if (["UK", "USA"].includes(country)) return Side.ALLIED;
  }
  if (isBarbarossa1941Scenario(scenario)) {
    if (["Germany", "Romania", "Finland", "Hungary", "Estonia", "Latvia", "Lithuania", "Poland"].includes(country)) return Side.AXIS;
    if (country === "USSR") return Side.ALLIED;
    return "neutral";
  }
  if (country === "Germany") return Side.AXIS;
  if (country === "Italy") return "neutral";
  if (["France", "Belgium", "Netherlands", "UK", "USA"].includes(country)) return Side.ALLIED;
  return undefined;
};

const BALKANS_CITY_FEATURES: Record<string, Partial<Hex["features"]>> = {
  "3232": { name: "Budapest", country: "Hungary", city: true, capital: true, productionCenter: true },
  "3234": { name: "Szolnok", country: "Hungary", city: true },
  "3429": { name: "Zagreb", country: "Yugoslavia", city: true, productionCenter: true },
  "3526": { name: "Trieste", country: "Italy", city: true, port: true, productionCenter: true },
  "3634": { name: "Belgrade", country: "Yugoslavia", city: true, capital: true, productionCenter: true },
  "3640": { name: "Bucharest", country: "Romania", city: true, capital: true, productionCenter: true },
  "3732": { name: "Sarajevo", country: "Yugoslavia", city: true },
  "3830": { name: "Split", country: "Yugoslavia", city: true, port: true },
  "3835": { name: "Nis", country: "Yugoslavia", city: true },
  "4038": { name: "Sofia", country: "Bulgaria", city: true, capital: true, productionCenter: true },
  "4127": { name: "Naples", country: "Italy", city: true, port: true, productionCenter: true },
  "4233": { name: "Durazzo", country: "Albania", city: true, port: true, productionCenter: true },
  "4237": { name: "Salonika", country: "Greece", city: true, port: true },
  "4330": { name: "Taranto", country: "Italy", city: true, port: true },
  "4331": { name: "Brindisi", country: "Italy", city: true, port: true },
  "4538": { name: "Athens", country: "Greece", city: true, capital: true, port: true, productionCenter: true }
};

const BALKANS_SEA_HEXES = new Set([
  "3526", "3626", "3627", "3726", "3727", "3728", "3826", "3827", "3828", "3829",
  "3928", "3929", "3930", "3931", "4028", "4029", "4030", "4031", "4032",
  "4126", "4127", "4131", "4132", "4133", "4226", "4227", "4232", "4233",
  "4237", "4238", "4239", "4240", "4327", "4328", "4330", "4331", "4332",
  "4333", "4334", "4335", "4336", "4337", "4338", "4339", "4340", "4428",
  "4430", "4431", "4432", "4433", "4434", "4435", "4437", "4438", "4439",
  "4440", "4531", "4532", "4533", "4534", "4535", "4536", "4537", "4538",
  "4539", "4540"
]);

const BALKANS_COAST_HEXES = new Set([
  "3426", "3527", "3628", "3729", "3830", "3932", "4033", "4128", "4129",
  "4130", "4134", "4135", "4228", "4229", "4230", "4231", "4234", "4235",
  "4236", "4329", "4436", "4538"
]);

const BALKANS_MOUNTAIN_HEXES = new Set([
  "3226", "3227", "3228", "3237", "3238", "3239", "3240", "3326", "3327",
  "3328", "3338", "3339", "3340", "3426", "3427", "3437", "3438", "3439",
  "3528", "3537", "3538", "3628", "3629", "3630", "3637", "3638", "3729",
  "3730", "3731", "3732", "3830", "3831", "3832", "3833", "3834", "3835",
  "3932", "3933", "3934", "3935", "3936", "4033", "4034", "4035", "4036",
  "4134", "4135", "4136", "4137", "4234", "4235", "4236", "4335", "4336",
  "4435", "4436", "4536", "4537"
]);

const BALKANS_TRANSPORT_PATHS = [
  ["3526", "3527", "3528", "3429", "3330", "3230"],
  ["3230", "3231", "3232", "3233", "3234", "3235", "3236", "3237", "3238", "3239", "3240"],
  ["3429", "3430", "3431", "3432", "3433", "3434", "3435", "3436", "3437", "3438", "3439", "3440"],
  ["3527", "3528", "3529", "3530", "3531", "3532", "3533", "3534", "3535", "3536", "3537", "3538", "3539", "3540"],
  ["3429", "3530", "3631", "3632", "3633", "3634"],
  ["3232", "3333", "3433", "3534", "3634"],
  ["3229", "3230", "3231", "3232", "3233", "3234", "3334", "3435", "3535", "3536", "3537", "3538", "3539", "3540", "3640"],
  ["3634", "3734", "3733", "3732", "3831", "3830"],
  ["3634", "3735", "3835", "3936", "4037", "4038"],
  ["4038", "3937", "3836", "3835", "3735", "3634"],
  ["4233", "4134", "4035", "3935", "3835"],
  ["4237", "4137", "4038"],
  ["4038", "4138", "4237", "4337", "4437", "4538"],
  ["4538", "4437", "4337", "4237"],
  ["3640", "3739", "3838", "3937", "4038"],
  ["3640", "3740", "3839", "3939", "4038"],
  ["4127", "4228", "4329", "4330", "4331"],
  ["4127", "4228", "4329", "4330", "4331", "4332"]
];

const BALKANS_RIVER_PATHS = [
  ["3228", "3328", "3428", "3429", "3430"],
  ["3232", "3333", "3433", "3534", "3634", "3735", "3836", "3937", "4038"],
  ["3235", "3335", "3434", "3534"],
  ["3428", "3528", "3629", "3630", "3631", "3632", "3633", "3634"],
  ["3429", "3430", "3431", "3432"],
  ["3735", "3835", "3936", "4037", "4138"],
  ["3737", "3838", "3939", "4040"]
];

const BALKANS_MOUNTAIN_EDGE_PATHS = [
  ["3226", "3326", "3426", "3526"],
  ["3227", "3327", "3427", "3528"],
  ["3228", "3328", "3428", "3528"],
  ["3326", "3426", "3527", "3628", "3729", "3830"],
  ["3426", "3527", "3628", "3729", "3830", "3931", "4032", "4133", "4234"],
  ["3528", "3629", "3730", "3831", "3932", "4033", "4134", "4235", "4336"],
  ["3629", "3730", "3831", "3932", "4033", "4134", "4235", "4336", "4437"],
  ["3628", "3730", "3832", "3934", "4035", "4136", "4237", "4338", "4439"],
  ["3630", "3731", "3832", "3933", "4034"],
  ["3632", "3733", "3834", "3935", "4036"],
  ["3833", "3934", "4035", "4136", "4237", "4338", "4438", "4538"],
  ["3237", "3337", "3437", "3537", "3637", "3737"],
  ["3237", "3338", "3438", "3539", "3640"],
  ["3238", "3339", "3440"],
  ["3337", "3438", "3538", "3639"],
  ["4033", "4133", "4233", "4334", "4435"],
  ["4033", "4134", "4235", "4336", "4437", "4538"],
  ["4034", "4135", "4236", "4337", "4438"],
  ["4133", "4234", "4335", "4436", "4537"],
  ["4233", "4334", "4435", "4536"],
  ["4037", "4137", "4238", "4339", "4440"],
  ["4038", "4139", "4240"]
];

const countryForBalkansHex = (code: string): string | undefined => {
  const row = Number(code.slice(0, 2));
  const col = Number(code.slice(2));
  if (row <= 33 && col <= 28) return "Germany";
  if ((row <= 36 && col <= 28) || (row >= 41 && row <= 44 && col <= 32)) return "Italy";
  if (row <= 35 && col >= 29 && col <= 35) return "Hungary";
  if (row <= 36 && col >= 37) return "Romania";
  if (row >= 39 && col >= 36 && row <= 41) return "Bulgaria";
  if (row >= 42 && col >= 37) return "Greece";
  if (row >= 39 && row <= 43 && col >= 33 && col <= 36) return "Albania";
  if (row >= 34 && row <= 39 && col >= 29 && col <= 37) return "Yugoslavia";
  return undefined;
};

const loadBalkansSeed = (state: GameState): GameState => {
  const map = new Map(state.map);
  const seed = balkans1941Seed as {
    hexes: Array<{
      coord: HexCoord;
      terrain: string;
      terrainTags: string[];
      features: Partial<Hex["features"]>;
      railEdges: HexSide[];
    }>;
    riverEdges: string[];
    mountainEdges: string[];
    straitEdges?: string[];
    impassableEdges: string[];
  };

  if (seed.hexes.length > 0) {
    seed.hexes.forEach((h) => {
      map.set(coordKey(h.coord), {
        coord: h.coord,
        terrain: h.terrain as TerrainType,
        terrainTags: (h.terrainTags || []) as Hex["terrainTags"],
        features: {
          country: h.features.country,
          controller: h.features.controller,
          disputedArea: h.features.disputedArea,
          name: h.features.name,
          city: Boolean(h.features.city),
          port: Boolean(h.features.port),
          productionCenter: Boolean(h.features.productionCenter),
          capital: Boolean(h.features.capital),
          prohibited: Boolean(h.features.prohibited),
          fadedDot: Boolean(h.features.fadedDot)
        },
        railEdges: (h.railEdges || []) as Hex["railEdges"],
        zoc: new Set<string>(),
        units: [],
        supply: 10
      });
    });

    return {
      ...state,
      map,
      riverEdges: new Set(seed.riverEdges || []),
      mountainEdges: new Set(seed.mountainEdges || []),
      straitEdges: new Set(seed.straitEdges || []),
      impassableEdges: new Set(seed.impassableEdges || [])
    };
  }

  const coordForBalkansCode = (code: string): HexCoord => coordFromHexCodeForMap(code, "balkans");
  const addRail = (fromCode: string, toCode: string) => {
    const from = coordForBalkansCode(fromCode);
    const to = coordForBalkansCode(toCode);
    const fromHex = map.get(coordKey(from));
    const toHex = map.get(coordKey(to));
    if (!fromHex || !toHex) return;
    const side = sideBetween(from, to);
    if (!side) return;
    if (!fromHex.railEdges.includes(side)) fromHex.railEdges.push(side);
    const opposite = OPPOSITE_HEX_SIDE[side];
    if (!toHex.railEdges.includes(opposite)) toHex.railEdges.push(opposite);
  };
  const edgeSetFromPaths = (paths: string[][]): Set<string> => {
    const edges = new Set<string>();
    paths.forEach((path) => {
      for (let index = 0; index < path.length - 1; index += 1) {
        const from = coordForBalkansCode(path[index]);
        const to = coordForBalkansCode(path[index + 1]);
        if (sideBetween(from, to)) edges.add(edgeKey(from, to));
      }
    });
    return edges;
  };

  map.forEach((hex, key) => {
    const code = hexCodeForMap(hex.coord, "balkans");
    const featuresFromSeed = BALKANS_CITY_FEATURES[code] || {};
    const country = featuresFromSeed.country || countryForBalkansHex(code);
    const controller = country ? initialControllerForCountry(country, "balkans1941") : undefined;
    const isSea = BALKANS_SEA_HEXES.has(code) && !featuresFromSeed.city;
    const isCoast = BALKANS_COAST_HEXES.has(code) || Boolean(featuresFromSeed.port);
    const isMountain = BALKANS_MOUNTAIN_HEXES.has(code);
    const terrainTags: Hex["terrainTags"] = isSea
      ? ["sea"]
      : isCoast
        ? ["coast", isMountain ? "mountain" : "plain"]
        : isMountain
          ? ["mountain"]
          : ["plain"];
    map.set(key, {
      ...hex,
      terrain: isSea ? TerrainType.SEA : isCoast ? TerrainType.COASTAL : isMountain ? TerrainType.MOUNTAIN : TerrainType.PLAIN,
      terrainTags,
      features: {
        country,
        controller,
        disputedArea: country === "Albania" ? "Albania (IT)" : undefined,
        name: featuresFromSeed.name,
        city: Boolean(featuresFromSeed.city),
        port: Boolean(featuresFromSeed.port),
        productionCenter: Boolean(featuresFromSeed.productionCenter),
        capital: Boolean(featuresFromSeed.capital),
        prohibited: false,
        fadedDot: false
      },
      railEdges: []
    });
  });

  BALKANS_TRANSPORT_PATHS.forEach((path) => {
    for (let index = 0; index < path.length - 1; index += 1) {
      addRail(path[index], path[index + 1]);
    }
  });

  const mountainEdges = edgeSetFromPaths(BALKANS_MOUNTAIN_EDGE_PATHS);
  map.forEach((hex) => {
    const code = hexCodeForMap(hex.coord, "balkans");
    if (!BALKANS_MOUNTAIN_HEXES.has(code)) return;
    neighborsOf(hex.coord).forEach((neighbor) => {
      const neighborHex = map.get(coordKey(neighbor));
      if (!neighborHex) return;
      const neighborCode = hexCodeForMap(neighbor, "balkans");
      const neighborTags = neighborHex.terrainTags || [];
      const isOpenSea = neighborTags.includes("sea") && !neighborTags.includes("coast");
      if (!BALKANS_MOUNTAIN_HEXES.has(neighborCode) && !isOpenSea) {
        mountainEdges.add(edgeKey(hex.coord, neighbor));
      }
    });
  });

  return {
    ...state,
    map,
    riverEdges: edgeSetFromPaths(BALKANS_RIVER_PATHS),
    mountainEdges,
    straitEdges: new Set<string>(),
    impassableEdges: new Set<string>()
  };
};

// Carica il seed France 1940 nel state: hex con country/city/capital/port/factory/rail + river/mountain/impassable edges.
// Il controller iniziale è derivato da initialControllerForCountry().
const loadFrance1940Seed = (state: GameState, scenario: ScenarioId | "procedural" = DEFAULT_SCENARIO_ID): GameState => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const seed = france1940Seed as {
    hexes: Array<{
      q: number;
      r: number;
      terrain: string;
      terrainTags: string[];
      features: Partial<{ name: string; country: string; capital: boolean; city: boolean; port: boolean; productionCenter: boolean; prohibited: boolean; fadedDot: boolean; disputedArea: string }>;
      railEdges: string[];
    }>;
    riverEdges: string[];
    mountainEdges: string[];
    straitEdges?: string[];
    impassableEdges: string[];
  };

  const map = new Map(state.map);
  seed.hexes.forEach((h) => {
    const key = `${h.q},${h.r}`;
    const existing = map.get(key);
    if (!existing) return; // hex fuori dalla mappa procedurale → skip
    const featuresFromSeed = h.features || {};
    const country = featuresFromSeed.country;
    const controller = featuresFromSeed.country ? initialControllerForCountry(country, scenario) : undefined;
    map.set(key, {
      ...existing,
      terrain: (h.terrain as TerrainType) || existing.terrain,
      terrainTags: (h.terrainTags as Hex["terrainTags"]) || existing.terrainTags,
      features: {
        country: featuresFromSeed.country,
        controller,
        disputedArea: featuresFromSeed.disputedArea,
        name: featuresFromSeed.name,
        city: Boolean(featuresFromSeed.city),
        port: Boolean(featuresFromSeed.port),
        productionCenter: Boolean(featuresFromSeed.productionCenter),
        capital: Boolean(featuresFromSeed.capital),
        prohibited: Boolean(featuresFromSeed.prohibited),
        fadedDot: Boolean(featuresFromSeed.fadedDot)
      },
      railEdges: (h.railEdges as Hex["railEdges"]) || []
    });
  });

  return {
    ...state,
    map,
    riverEdges: new Set(seed.riverEdges),
    mountainEdges: new Set(seed.mountainEdges),
    straitEdges: new Set(seed.straitEdges || []),
    impassableEdges: new Set(seed.impassableEdges)
  };
};

const loadItalySeed = (state: GameState): GameState => {
  const seed = italy1943Seed as {
    hexes: Array<{
      coord?: HexCoord;
      q?: number;
      r?: number;
      terrain: string;
      terrainTags: string[];
      features: Partial<Hex["features"]>;
      railEdges: HexSide[];
    }>;
    riverEdges: string[];
    mountainEdges: string[];
    straitEdges?: string[];
    impassableEdges: string[];
  };
  if (!seed.hexes || seed.hexes.length === 0) return state;

  const map = new Map(state.map);
  seed.hexes.forEach((h) => {
    const coord = h.coord || { q: h.q ?? 0, r: h.r ?? 0 };
    map.set(coordKey(coord), {
      coord,
      terrain: h.terrain as TerrainType,
      terrainTags: (h.terrainTags || []) as Hex["terrainTags"],
      features: {
        country: h.features.country,
        controller: h.features.controller ?? initialControllerForCountry(h.features.country, "italy1943"),
        disputedArea: h.features.disputedArea,
        name: h.features.name,
        city: Boolean(h.features.city),
        port: Boolean(h.features.port),
        productionCenter: Boolean(h.features.productionCenter),
        capital: Boolean(h.features.capital),
        prohibited: Boolean(h.features.prohibited),
        fadedDot: Boolean(h.features.fadedDot)
      },
      railEdges: (h.railEdges || []) as Hex["railEdges"],
      zoc: new Set<string>(),
      units: [],
      supply: 10
    });
  });

  return {
    ...state,
    map,
    riverEdges: new Set(seed.riverEdges || []),
    mountainEdges: new Set(seed.mountainEdges || []),
    straitEdges: new Set(seed.straitEdges || []),
    impassableEdges: new Set(seed.impassableEdges || [])
  };
};

const loadFnaSeed = (state: GameState): GameState => {
  const seed = fna1942Seed as {
    hexes: Array<{
      coord?: HexCoord;
      q?: number;
      r?: number;
      terrain: string;
      terrainTags: string[];
      features: Partial<Hex["features"]>;
      railEdges: HexSide[];
    }>;
    riverEdges: string[];
    mountainEdges: string[];
    straitEdges?: string[];
    impassableEdges: string[];
  };
  if (!seed.hexes || seed.hexes.length === 0) return state;

  const map = new Map(state.map);
  seed.hexes.forEach((h) => {
    const coord = h.coord || { q: h.q ?? 0, r: h.r ?? 0 };
    map.set(coordKey(coord), {
      coord,
      terrain: h.terrain as TerrainType,
      terrainTags: (h.terrainTags || []) as Hex["terrainTags"],
      features: {
        country: h.features.country,
        controller: h.features.controller ?? initialControllerForCountry(h.features.country, "frenchNorthAfrica1942"),
        disputedArea: h.features.disputedArea,
        name: h.features.name,
        city: Boolean(h.features.city),
        port: Boolean(h.features.port),
        productionCenter: Boolean(h.features.productionCenter),
        capital: Boolean(h.features.capital),
        prohibited: Boolean(h.features.prohibited),
        fadedDot: Boolean(h.features.fadedDot)
      },
      railEdges: (h.railEdges || []) as Hex["railEdges"],
      zoc: new Set<string>(),
      units: [],
      supply: 10
    });
  });

  return {
    ...state,
    map,
    riverEdges: new Set(seed.riverEdges || []),
    mountainEdges: new Set(seed.mountainEdges || []),
    straitEdges: new Set(seed.straitEdges || []),
    impassableEdges: new Set(seed.impassableEdges || [])
  };
};

const loadBarbarossaSeed = (state: GameState): GameState => {
  const seed = barbarossa1941Seed as unknown as {
    hexes: Array<{
      coord: HexCoord;
      terrain: string;
      terrainTags: string[];
      features: Partial<Hex["features"]>;
      railEdges: HexSide[];
    }>;
    riverEdges: string[];
    mountainEdges: string[];
    straitEdges?: string[];
    impassableEdges: string[];
  };
  if (!seed.hexes || seed.hexes.length === 0) return state;

  const map = new Map<string, Hex>();
  seed.hexes.forEach((h) => {
    const coord = h.coord;
    map.set(coordKey(coord), {
      coord,
      terrain: h.terrain as TerrainType,
      terrainTags: (h.terrainTags || []) as Hex["terrainTags"],
      features: {
        country: h.features.country,
        controller: h.features.controller ?? initialControllerForCountry(h.features.country, "barbarossa1941"),
        disputedArea: h.features.disputedArea,
        name: h.features.name,
        city: Boolean(h.features.city),
        port: Boolean(h.features.port),
        productionCenter: Boolean(h.features.productionCenter),
        capital: Boolean(h.features.capital),
        prohibited: Boolean(h.features.prohibited),
        fadedDot: Boolean(h.features.fadedDot)
      },
      railEdges: (h.railEdges || []) as Hex["railEdges"],
      zoc: new Set<string>(),
      units: [],
      supply: 10
    });
  });

  return {
    ...state,
    map,
    riverEdges: new Set(seed.riverEdges || []),
    mountainEdges: new Set(seed.mountainEdges || []),
    straitEdges: new Set(seed.straitEdges || []),
    impassableEdges: new Set(seed.impassableEdges || [])
  };
};

const applyFnaAfricanSetup = (state: GameState): GameState => {
  if (!isFna1942Scenario(state.scenarioId)) return state;
  const roll = rollD6();
  const map = new Map(state.map);
  map.forEach((hex, key) => {
    if (hex.features.country === "Fr.N.Africa" && (hex.features.city || hex.features.capital || hex.features.productionCenter)) {
      map.set(key, { ...hex, features: { ...hex.features, controller: Side.AXIS } });
    }
  });
  state = { ...state, map };
  const units = new Map(state.units);
  const factionCards = { ...state.factionCards };

  if (roll <= 2) {
    const placementHexes = Array.from(state.map.values())
      .filter((hex) =>
        hex.features.country === "Fr.N.Africa" &&
        (hex.features.city || hex.features.capital || hex.features.productionCenter) &&
        hex.features.controller === Side.AXIS &&
        hexCodeForMap(hex.coord, "west") !== "4622" &&
        !getGroundUnitOnHex({ ...state, units }, hex.coord)
      )
      .sort((a, b) => hexCodeForMap(a.coord, "west").localeCompare(hexCodeForMap(b.coord, "west")));
    ["fr.n.africa_1", "fr.n.africa_2", "fr.n.africa_3"].forEach((id, index) => {
      const unit = units.get(id);
      const hex = placementHexes[index];
      if (!unit || !hex) return;
      units.set(id, {
        ...unit,
        position: hex.coord,
        mapPresence: "france",
        supplyState: SupplyState.FULL,
        moved: false,
        activated: false
      });
    });
    return {
      ...state,
      units,
      history: [
        { type: ActionType.HOLD, side: Side.AXIS, note: `French North Africa setup roll ${roll}: FNA is active; African units placed in Axis cities.`, timestamp: new Date() },
        ...state.history
      ]
    };
  }

  const axisCard = factionCards[Side.AXIS];
  factionCards[Side.AXIS] = {
    ...axisCard,
    productionPoints: { ...axisCard.productionPoints, "Fr.N.Africa": 0 },
    nationalWill: { ...axisCard.nationalWill, "Fr.N.Africa": 0 },
    countryStatus: { ...axisCard.countryStatus, "Fr.N.Africa": "conquered" }
  };
  return {
    ...state,
    factionCards,
    history: [
      { type: ActionType.HOLD, side: Side.AXIS, note: `French North Africa setup roll ${roll}: FNA counters are not used; French North Africa is treated as Western-conquered while its cities start Axis-controlled.`, timestamp: new Date() },
      ...state.history
    ]
  };
};

// Rete ferroviaria di default per il setup France 1940.
// Connette una spina dorsale orizzontale (riga centrale) sufficiente per testare 4.1 Strategic Movement.
const applyDefaultRailNetwork = (map: GameMap): void => {
  const addRail = (from: HexCoord, to: HexCoord) => {
    const fromHex = map.get(coordKey(from));
    const toHex = map.get(coordKey(to));
    if (!fromHex || !toHex) return;
    const side = sideBetween(from, to);
    if (!side) return;
    if (!fromHex.railEdges.includes(side)) fromHex.railEdges.push(side);
    const opposite = OPPOSITE_HEX_SIDE[side];
    if (!toHex.railEdges.includes(opposite)) toHex.railEdges.push(opposite);
  };

  // Spina dorsale orizzontale lungo r=3 (le unità del setup sono fra r=2..r=5)
  // collega le hex consecutive lungo SE/NW
  for (let r = 2; r <= 5; r += 1) {
    for (let q = 3; q <= 13; q += 1) {
      const here = { q, r };
      const seNeighbor = neighborForSide(here, "SE");
      addRail(here, seNeighbor);
    }
  }
  // Connessioni verticali tra le righe centrali
  for (let q = 4; q <= 12; q += 1) {
    for (let r = 2; r <= 4; r += 1) {
      addRail({ q, r }, neighborForSide({ q, r }, "S"));
    }
  }
};

export const createInitialGameState = (options: InitialGameOptions = {}): GameState => {
  const scenario = options.scenario ?? DEFAULT_SCENARIO_ID;
  const scenarioDefinition = scenario === "procedural" ? null : scenarioById(scenario);
  const usesFranceMap = scenarioDefinition?.mapId === "france";
  const usesBalkansMap = scenarioDefinition?.mapId === "balkans";
  const usesItalyMap = scenarioDefinition?.mapId === "italy";
  const usesWestMap = scenarioDefinition?.mapId === "west";
  const usesRussiaMap = scenarioDefinition?.mapId === "russia";
  const map = new Map<string, Hex>();
  // Le mappe scenario correnti sono 15x14; per scenario "procedural" l'utente sceglie.
  const width = options.width ?? (usesWestMap ? 31 : usesRussiaMap ? 30 : usesFranceMap || usesBalkansMap || usesItalyMap ? 15 : GAME_CONFIG.MVP.MAP_WIDTH);
  const height = options.height ?? (usesFranceMap || usesBalkansMap || usesItalyMap || usesWestMap ? 14 : usesRussiaMap ? 29 : 10);
  const shortRowWidth = options.shortRowWidth ?? width;
  const shortRowsStart = options.shortRowsStart ?? "odd";

  for (let r = 0; r < height; r += 1) {
    const isShortRow = shortRowsStart === "even" ? r % 2 === 0 : r % 2 === 1;
    const rowWidth = Math.max(1, isShortRow ? shortRowWidth : width);

    for (let q = 0; q < rowWidth; q += 1) {
      const coord = { q, r };
      map.set(coordKey(coord), {
        coord,
        terrain: terrainFor(q, r),
        terrainTags: terrainTagsFor(terrainFor(q, r)),
        features: {
          country: undefined,
          controller: undefined,
          disputedArea: undefined,
          city: terrainFor(q, r) === TerrainType.CITY,
          port: false,
          productionCenter: false,
          capital: false,
          prohibited: false,
          fadedDot: false
        },
        railEdges: [],
        zoc: new Set<string>(),
        units: [],
        supply: terrainFor(q, r) === TerrainType.CITY ? 10 : 6
      });
    }
  }

  const units = createScenarioUnits(scenario);
  // Per scenari non-france1940 manteniamo la rete procedurale come fallback
  if (scenario === "procedural") {
    applyDefaultRailNetwork(map);
  }

  let initial: GameState = {
    id: `local_${Date.now()}`,
    scenarioId: scenarioDefinition?.id ?? scenario,
    turn: 1,
    turnCode: turnCodeForScenario(1, scenarioDefinition),
    phase: GamePhase.WEATHER,
    subPhase: GameSubPhase.WEATHER_ROLL,
    currentSide: Side.AXIS,
    weather: WeatherType.FAIR,
    previousWeather: scenario === "balkans1941" ? WeatherType.SEVERE : scenario === "frenchNorthAfrica1942" ? WeatherType.POOR : undefined,
    weatherRoll: undefined,
    weatherMap: scenario === "barbarossa1941" ? WeatherMapCategory.OTHER_MAPS : scenario === "balkans1941" || isItaly1943Scenario(scenario) || isFna1942Scenario(scenario) ? WeatherMapCategory.BALKANS_FNA_ITALY : WeatherMapCategory.OTHER_MAPS,
    scenarioEndsTurn: scenarioDefinition?.endTurn ?? 8,
    factionCards: createInitialFactionCards(scenario),
    fnaAxisAirSortiesUsed: 0,
    units,
    map,
    riverEdges: new Set<string>(),
    mountainEdges: new Set<string>(),
    straitEdges: new Set<string>(),
    impassableEdges: new Set<string>(),
    history: [
      {
        type: ActionType.HOLD,
        side: Side.AXIS,
        note: scenarioDefinition ? `${scenarioDefinition.title} scenario loaded.` : undefined,
        timestamp: new Date()
      }
    ],
    timestamp: new Date()
  };

  if (usesFranceMap) {
    initial = loadFrance1940Seed(initial, scenario);
  } else if (usesBalkansMap) {
    initial = loadBalkansSeed(initial);
  } else if (usesItalyMap) {
    initial = loadItalySeed(initial);
  } else if (usesWestMap) {
    initial = loadFnaSeed(initial);
    initial = applyFnaAfricanSetup(initial);
  } else if (usesRussiaMap) {
    initial = loadBarbarossaSeed(initial);
  }

  return initial;
};

export const calculateReachableHexes = (state: GameState, unit: Unit): ReachableHex[] => {
  if (!canCommandUnit(state, unit)) return [];
  if (isWesternMedUnit(unit)) return [];
  if (unit.type === UnitType.AIR) return [];
  if (movementRemainingFor(unit, state) <= 0) return [];
  if (movementSpentFor(unit) > 0 && isEnemyZoc(state, unit.position, unit.side)) return [];

  const frontier: ReachableHex[] = [{ coord: unit.position, cost: 0 }];
  const bestCost = new Map<string, number>([[coordKey(unit.position), 0]]);
  const reachable: ReachableHex[] = [];
  const movementAllowance = movementRemainingFor(unit, state);

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;

    const isStartHex = sameCoord(current.coord, unit.position);
    if (!isStartHex && isEnemyZoc(state, current.coord, unit.side)) continue;

    neighborsOf(current.coord).forEach((next) => {
      if (!isInsideMap(state, next) || movesBetweenSameEnemyZoc(state, current.coord, next, unit.side)) return;

      const hex = state.map.get(coordKey(next));
      if (!hex) return;

      const moveCost = groundMoveCost(state, current.coord, next, unit);
      const nextCost = current.cost + moveCost;
      const existing = bestCost.get(coordKey(next));

      if (nextCost <= movementAllowance && (existing === undefined || nextCost < existing)) {
        const item = { coord: next, cost: nextCost };
        bestCost.set(coordKey(next), nextCost);
        frontier.push(item);
        reachable.push(item);
      }
    });
  }

  return reachable;
};

// 12.1 / 1.3.1: cambia il controller di una hex se contiene città, forte o centro produzione
// e l'unità entrante è di lato opposto a quello corrente. Ritorna anche una nota descrittiva.
const applyHexControlChange = (
  state: GameState,
  hexCoord: HexCoord,
  enteringSide: Side
): { state: GameState; note: string; nationalWillDelta: { side: Side; country: string; delta: number } | null } => {
  const hex = state.map.get(coordKey(hexCoord));
  if (!hex) return { state, note: "", nationalWillDelta: null };
  const claimable = hex.features.city || hex.features.capital || hex.features.productionCenter || hex.features.port;
  if (!claimable) return { state, note: "", nationalWillDelta: null };
  const currentController = hex.features.controller;
  if (currentController === enteringSide) return { state, note: "", nationalWillDelta: null };

  const map = new Map(state.map);
  map.set(coordKey(hexCoord), {
    ...hex,
    features: { ...hex.features, controller: enteringSide }
  });
  const label = hex.features.name ? hex.features.name : `${hex.coord.q},${hex.coord.r}`;
  let note = `${label} now under ${enteringSide} control.`;

  // National Will Effects: -2/-4 quando una città/capitale è persa; +2/+4 quando viene riconquistata.
  let nwDelta: { side: Side; country: string; delta: number } | null = null;
  if (hex.features.country && currentController && currentController !== "neutral" && currentController !== enteringSide) {
    const ownerSide = initialControllerForCountry(hex.features.country, (state.scenarioId as ScenarioId | undefined) || DEFAULT_SCENARIO_ID);
    const deltaMagnitude = hex.features.capital ? 4 : 2;
    const affectedSide = enteringSide === ownerSide ? enteringSide : currentController as Side;
    const delta = enteringSide === ownerSide ? deltaMagnitude : -deltaMagnitude;
    const card = state.factionCards[affectedSide];
    if (card) {
      const will = card.nationalWill[hex.features.country];
      if (typeof will === "number") {
        nwDelta = { side: affectedSide, country: hex.features.country, delta };
        note += ` ${hex.features.country} National Will ${delta > 0 ? "+" : ""}${delta}.`;
      }
    }
  }

  return { state: { ...state, map }, note, nationalWillDelta: nwDelta };
};

const applyNationalWillDelta = (state: GameState, change: { side: Side; country: string; delta: number } | null): GameState => {
  if (!change) return state;
  const card = state.factionCards[change.side];
  const current = card.nationalWill[change.country];
  if (typeof current !== "number") return state;
  const initial = card.countryInitialNationalWill?.[change.country];
  const upper = typeof initial === "number" ? initial : Infinity;
  const next = Math.min(upper, Math.max(0, current + change.delta));
  return {
    ...state,
    factionCards: {
      ...state.factionCards,
      [change.side]: {
        ...card,
        nationalWill: { ...card.nationalWill, [change.country]: next }
      }
    }
  };
};

const calculateAirDisplacementTargets = (state: GameState, air: Unit, from: HexCoord): HexCoord[] => {
  if (air.type !== UnitType.AIR) return [];
  const allowance = movementAllowanceFor(air, state);
  const distances = new Map<string, number>([[coordKey(from), 0]]);
  const frontier: HexCoord[] = [from];
  const result: HexCoord[] = [];
  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;
    const distance = distances.get(coordKey(current)) || 0;
    if (distance >= allowance) continue;
    HEX_SIDES.forEach((side) => {
      const next = neighborForSide(current, side);
      const key = coordKey(next);
      if (distances.has(key)) return;
      if (!isInsideMap(state, next)) return;
      if (!isAirMoveTransitLegal(state, next)) return;
      distances.set(key, distance + 1);
      frontier.push(next);
      if (isLegalAirEndHex(state, next, air)) {
        result.push(next);
      }
    });
  }
  return result;
};

// 4.2.3.7 Air Displacement: quando una ground entra in hex con air nemiche, le air sono
// spostate seguendo il movimento aereo. La displacement avviene anche con 6 sorties,
// non attiva l'unità e non può usare Naval Transport.
const displaceEnemyAirFrom = (state: GameState, coord: HexCoord, attackerSide: Side): GameState => {
  const enemyAirIds: string[] = [];
  state.units.forEach((u, id) => {
    if (
      u.type === UnitType.AIR &&
      u.status !== UnitStatus.DESTROYED &&
      u.side !== attackerSide &&
      sameCoord(u.position, coord)
    ) {
      enemyAirIds.push(id);
    }
  });
  if (enemyAirIds.length === 0) return state;

  const units = new Map(state.units);
  const factionCards = { ...state.factionCards };
  const notes: string[] = [];

  enemyAirIds.forEach((id) => {
    const air = units.get(id);
    if (!air) return;
    const target = calculateAirDisplacementTargets({ ...state, units }, air, coord)[0] || null;

    if (target) {
      const sorties = sortiesFor(air);
      units.set(id, {
        ...air,
        position: target,
        mapPresence: "france",
        sorties: sorties < GAME_RULES.AIR.MAX_SORTIES ? sorties + 1 : sorties
      });
      notes.push(`${air.name} air displaced to ${hexCodeFor(target)}${sorties < GAME_RULES.AIR.MAX_SORTIES ? " (+1 sortie)" : ""}`);
    } else {
      // Nessuna hex valida: rimuove sorties e va nell'Eliminated box.
      units.set(id, { ...air, status: UnitStatus.DESTROYED, sorties: 0 });
      const card = factionCards[air.side];
      if (!card.eliminatedBox.includes(id)) {
        factionCards[air.side] = { ...card, eliminatedBox: [...card.eliminatedBox, id] };
      }
      notes.push(`${air.name} air destroyed (no displacement target)`);
    }
  });

  if (notes.length === 0) return state;
  return {
    ...state,
    units,
    factionCards,
    history: [
      { type: ActionType.MOVE, side: attackerSide, note: `Air Displacement: ${notes.join("; ")}.`, timestamp: new Date() },
      ...state.history
    ]
  };
};

const friendlyFortAt = (state: GameState, coord: HexCoord, unit: Unit): Unit | undefined =>
  Array.from(state.units.values()).find((candidate) =>
    candidate.type === UnitType.FORT &&
    candidate.status !== UnitStatus.DESTROYED &&
    candidate.side === unit.side &&
    (!candidate.country || !unit.country || candidate.country === unit.country) &&
    sameCoord(candidate.position, coord)
  );

const occupyFriendlyFortIfEligible = (state: GameState, unitId: string): GameState => {
  const unit = state.units.get(unitId);
  if (!unit || unit.status === UnitStatus.DESTROYED || unit.type === UnitType.AIR || unit.type === UnitType.FORT) return state;
  if (!friendlyFortAt(state, unit.position, unit)) {
    if (!unit.occupyingFort) return state;
    const units = new Map(state.units);
    units.set(unitId, { ...unit, occupyingFort: false });
    return { ...state, units };
  }
  if (unit.occupyingFort) return state;
  const units = new Map(state.units);
  units.set(unitId, { ...unit, occupyingFort: true });
  return {
    ...state,
    units,
    history: [
      { type: ActionType.HOLD, side: unit.side, unitId, note: `${unit.name} occupies fort at ${hexCodeForMap(unit.position, scenarioById(state.scenarioId).mapId)}.`, timestamp: new Date() },
      ...state.history
    ],
    timestamp: new Date()
  };
};

export const moveUnit = (state: GameState, unitId: string, to: HexCoord): GameState => {
  const unit = state.units.get(unitId);
  if (!unit) return state;

  const reachable = calculateReachableHexes(state, unit);
  const move = reachable.find((item) => sameCoord(item.coord, to));
  if (!move) return state;

  const units = new Map(state.units);
  const movementSpent = movementSpentFor(unit) + move.cost;
  const enteredEzoc = isEnemyZoc({ ...state }, to, unit.side);
  const exhausted = movementSpent >= movementAllowanceFor(unit, state) || enteredEzoc;
  units.set(unitId, {
    ...unit,
    position: to,
    movementSpent,
    moved: exhausted,
    occupyingFort: false
  });

  // 4.2.3.7 Air Displacement: se entrante è ground, sposta eventuali air nemiche nell'hex
  let stateWithMove: GameState = { ...state, units };
  if (unit.type !== UnitType.AIR) {
    stateWithMove = displaceEnemyAirFrom(stateWithMove, to, unit.side);
  }
  // 12.1 / 1.3.1: claim del controllo se l'unità entra in città/forte/centro produzione nemica
  const { state: stateAfterClaim, note: claimNote, nationalWillDelta } =
    unit.type !== UnitType.AIR ? applyHexControlChange(stateWithMove, to, unit.side) : { state: stateWithMove, note: "", nationalWillDelta: null };
  const stateAfterNw = applyNationalWillDelta(stateAfterClaim, nationalWillDelta);

  const action: GameAction = {
    type: ActionType.MOVE,
    side: unit.side,
    unitId,
    fromPos: unit.position,
    toPos: to,
    note: claimNote || undefined,
    timestamp: new Date()
  };

  let result: GameState = {
    ...stateAfterNw,
    history: [action, ...stateAfterNw.history],
    timestamp: new Date()
  };
  // 12.1: la cattura città (in moveUnit) o il NW delta possono triggerare collapse
  result = checkCountryCollapses(result);
  return result;
};

// ============ 5.x COMBAT (CRT-based) ============

// Terrain "rough" per il DRM "Attacking into a hex containing a city and/or any amount of Rough terrain"
const isRoughOrCity = (hex: Hex): boolean => isRoughHex(hex) || hex.features.city || hex.features.capital;

// 5.3.4 / 7.1.1 / 5.3.5 — DRM list completo per ground combat
export interface CombatDrmBreakdown {
  germanyUnit: number;
  westernUnit: number;
  elite: number;
  reduced: number;
  lowSupply: number;
  noSupplyHalving: boolean;
  tankFair: number;
  tankPoor: number;
  airSupportFair: number;
  airSupportPoor: number;
  navalSupportFair: number;
  navalSupportPoor: number;
  isolated: number;
  attackerVsPoorWeather: number; // -1
  attackerVsCityRough: number; // -1
  attackerCrossingRiverOrMountain: number; // -1
  attackerCrossingStrait: number; // -2
  attackerVsFort: number; // halving (assault only, vs fort)
  severeWeatherHalving: boolean;
  primaryAttackerFortAttack: boolean;
  additionalAttackerCount: number;
  additionalTankAttackerFairOrPoor: number;
  amphibiousAttacker: number; // -1
  eventTanks: number;
  eventUltra: number;
  eventFreeForces: number;
  eventGroundSupport: number;
  eventRockets: number;
  eventSnafu: number;
  russianWinter: number; // -1 per unità tedesche in SEVERE/POOR su fronte est
  total: number;
}

const emptyDrm = (): CombatDrmBreakdown => ({
  germanyUnit: 0,
  westernUnit: 0,
  elite: 0,
  reduced: 0,
  lowSupply: 0,
  noSupplyHalving: false,
  tankFair: 0,
  tankPoor: 0,
  airSupportFair: 0,
  airSupportPoor: 0,
  navalSupportFair: 0,
  navalSupportPoor: 0,
  isolated: 0,
  attackerVsPoorWeather: 0,
  attackerVsCityRough: 0,
  attackerCrossingRiverOrMountain: 0,
  attackerCrossingStrait: 0,
  attackerVsFort: false as unknown as number, // placeholder (boolean usato altrove)
  severeWeatherHalving: false,
  primaryAttackerFortAttack: false,
  additionalAttackerCount: 0,
  additionalTankAttackerFairOrPoor: 0,
  amphibiousAttacker: 0,
  eventTanks: 0,
  eventUltra: 0,
  eventFreeForces: 0,
  eventGroundSupport: 0,
  eventRockets: 0,
  eventSnafu: 0,
  russianWinter: 0,
  total: 0
});

const sumDrm = (d: CombatDrmBreakdown): number =>
  d.germanyUnit + d.westernUnit + d.elite + d.reduced + d.lowSupply +
  d.tankFair + d.tankPoor +
  d.airSupportFair + d.airSupportPoor + d.navalSupportFair + d.navalSupportPoor + d.isolated +
  d.attackerVsPoorWeather + d.attackerVsCityRough + d.attackerCrossingRiverOrMountain + d.attackerCrossingStrait +
  d.additionalTankAttackerFairOrPoor + d.amphibiousAttacker +
  d.eventTanks + d.eventUltra + d.eventFreeForces + d.eventGroundSupport + d.eventRockets + d.eventSnafu +
  d.russianWinter +
  (d.additionalAttackerCount > 0 ? d.additionalAttackerCount : 0);

const formatDrmBreakdown = (drm: CombatDrmBreakdown): string => {
  const labels: Array<[keyof CombatDrmBreakdown, string]> = [
    ["germanyUnit", "Germany"],
    ["westernUnit", "Western"],
    ["elite", "Elite"],
    ["reduced", "Reduced"],
    ["lowSupply", "Low Supply"],
    ["tankFair", "Tank"],
    ["tankPoor", "Tank Poor"],
    ["airSupportFair", "Air Support"],
    ["airSupportPoor", "Air Support Poor"],
    ["navalSupportFair", "Naval Support"],
    ["navalSupportPoor", "Naval Support Poor"],
    ["isolated", "Isolated"],
    ["attackerVsPoorWeather", "Attacking Poor Weather"],
    ["attackerVsCityRough", "City/Rough"],
    ["attackerCrossingRiverOrMountain", "River/Mountain"],
    ["attackerCrossingStrait", "Strait"],
    ["additionalTankAttackerFairOrPoor", "Additional Tank"],
    ["eventTanks", "Event Tanks"],
    ["eventUltra", "ULTRA"],
    ["eventFreeForces", "Free Forces"],
    ["eventGroundSupport", "Ground Support"],
    ["eventRockets", "Rockets"],
    ["eventSnafu", "SNAFU"],
    ["amphibiousAttacker", "Amphibious"],
    ["additionalAttackerCount", "Additional Attackers"],
    ["russianWinter", "Russian Winter"]
  ];
  const parts = labels.flatMap(([key, label]) => {
    const value = drm[key];
    return typeof value === "number" && value !== 0 ? [`${label} ${value > 0 ? "+" : ""}${value}`] : [];
  });
  if (drm.noSupplyHalving) parts.push("No Supply halved");
  if (drm.severeWeatherHalving) parts.push("Severe Weather halved");
  if (drm.primaryAttackerFortAttack) parts.push("Fort attack halved");
  return parts.length > 0 ? parts.join(", ") : "none";
};

// 5.3.5: defender Isolated = nessuna retreat hex eligible E non adiacente a friendly city/fort/ground unit
const isDefenderIsolated = (state: GameState, defender: Unit, attackers: Unit[]): boolean => {
  const adj = neighborsOf(defender.position);
  const hasFriendlyAdjacent = adj.some((coord) => {
    const hex = state.map.get(coordKey(coord));
    if (!hex) return false;
    const hasFriendlyCityOrFort = (hex.features.city || hex.features.capital) && hex.features.controller === defender.side;
    if (hasFriendlyCityOrFort) return true;
    if (isFortHex(state, coord)) {
      // un fort è "amico" solo se di stessa nazionalità — semplificazione: country dell'hex
      return hex.features.country === defender.country;
    }
    const occ = getUnitOnHex(state, coord);
    return Boolean(occ && occ.side === defender.side);
  });
  if (hasFriendlyAdjacent) return false;
  const retreatHexes = computeLegalRetreatHexes(state, defender, attackers);
  return retreatHexes.length === 0;
};

const hasEnemyNonFortUnit = (state: GameState, coord: HexCoord, side: Side): boolean =>
  Array.from(state.units.values()).some(
    (unit) =>
      unit.type !== UnitType.FORT &&
      unit.status !== UnitStatus.DESTROYED &&
      unit.side !== side &&
      sameCoord(unit.position, coord)
  );

// 5.3.5.1 retreat prohibitions
// Esportata per i test: 5.3.5 / 5.3.5.1 (prohibizioni di ritirata).
export const computeLegalRetreatHexes = (state: GameState, defender: Unit, attackers: Unit[]): HexCoord[] => {
  return neighborsOf(defender.position).filter((coord) => {
    const hex = state.map.get(coordKey(coord));
    if (!hex) return false;
    if (isGroundMovementProhibited(state, coord, defender)) return false;
    // no enemy city/fort
    const enemyCity = (hex.features.city || hex.features.capital) &&
      hex.features.controller !== undefined && hex.features.controller !== defender.side && hex.features.controller !== "neutral";
    if (enemyCity) return false;
    // 5.3.5.1: vietata la ritirata in un forte NEMICO. In un hex con forte amico
    // ci si può ritirare: semplicemente non lo si occupa (5.3.5).
    const fortHere = fortOnHex(state, coord);
    if (fortHere && fortHere.side !== defender.side) return false;
    if (hasEnemyNonFortUnit(state, coord, defender.side)) return false;
    // 5.3.5.1: in un hex con EZOC solo se contiene città o forte amico.
    const friendlyCityOrFort =
      Boolean(fortHere && fortHere.side === defender.side) ||
      Boolean((hex.features.city || hex.features.capital) && hex.features.controller === defender.side);
    const ezocHere = isEnemyZoc(state, coord, defender.side);
    if (ezocHere && !friendlyCityOrFort) return false;
    // stacking: a ground defender cannot retreat into any hex already occupied by
    // another ground unit, even friendly. Air units do not block ground entry.
    const groundOcc = getGroundUnitOnHex(state, coord);
    if (groundOcc && groundOcc.id !== defender.id) return false;
    // hex deve essere a un esagono dall'attaccante con gap (semplificazione: non può stare adiacente all'attaccante a meno di city/fort exception)
    const adjacentToAttacker = attackers.some((att) => sameCoord(att.position, coord) || hexDistance(att.position, coord) === 1);
    if (adjacentToAttacker) {
      const friendlyCityOrFort = (hex.features.city || hex.features.capital) && hex.features.controller === defender.side;
      if (!friendlyCityOrFort) return false;
    }
    return true;
  });
};

export const computeAttackerDrm = (
  state: GameState,
  primaryAttacker: Unit,
  additionalAttackers: Unit[],
  defender: Unit,
  attackType: AttackType,
  isAmphibious = false
): CombatDrmBreakdown => {
  const drm = emptyDrm();
  const defenderHex = state.map.get(coordKey(defender.position));
  if (!defenderHex) return drm;

  const weather = state.weather;

  // Primary Attacker DRM
  if (primaryAttacker.country === "Germany") drm.germanyUnit = 2;
  if (["France", "UK", "USA"].includes(primaryAttacker.country || "")) drm.westernUnit = 1;
  if (primaryAttacker.elite) drm.elite = 1;
  if (primaryAttacker.reduced) drm.reduced = -2;
  // 7.1.1: Low Supply DRM = -2
  if (supplyStateOf(primaryAttacker) === SupplyState.LOW) drm.lowSupply = -2;
  // Tank Fair (+2) o Tank Poor (+1)
  if (primaryAttacker.type === UnitType.ARMOR) {
    if (weather === WeatherType.FAIR) drm.tankFair = 2;
    else if (weather === WeatherType.POOR) drm.tankPoor = 1;
  }
  // Attacker DRM specifici
  if (weather === WeatherType.POOR) drm.attackerVsPoorWeather = -1;
  if (isRoughOrCity(defenderHex)) drm.attackerVsCityRough = -1;
  if (isAmphibious) drm.amphibiousAttacker = -1;
  if (isAmphibious && isCoastalHex(defenderHex)) {
    if (weather === WeatherType.POOR) drm.navalSupportPoor = 1;
    else drm.navalSupportFair = 2;
  }
  // hexside crossing: -1 per river/mountain/canal (canal non modellato)
  const crossing = edgeKey(primaryAttacker.position, defender.position);
  if (!isAmphibious && (state.riverEdges.has(crossing) || state.mountainEdges.has(crossing))) drm.attackerCrossingRiverOrMountain = -1;
  if (!isAmphibious && state.straitEdges.has(crossing)) drm.attackerCrossingStrait = -2;
  if (attackType === AttackType.ASSAULT && isFortHex(state, defender.position)) drm.primaryAttackerFortAttack = true;
  // Isolated
  const allAttackers = [primaryAttacker, ...additionalAttackers];
  if (isDefenderIsolated(state, defender, allAttackers)) drm.isolated = 2;
  // Additional attackers (assault only)
  if (attackType === AttackType.ASSAULT) {
    drm.additionalAttackerCount = additionalAttackers.length; // +1 per ognuno
    const tankAdd = additionalAttackers.filter((u) => u.type === UnitType.ARMOR).length;
    if (weather === WeatherType.FAIR || weather === WeatherType.POOR) {
      drm.additionalTankAttackerFairOrPoor = tankAdd;
    }
  }
  // Severe weather halving (applies to attacker too)
  if (weather === WeatherType.SEVERE) drm.severeWeatherHalving = true;
  // 7.1.1: No Supply → modified die divided by 2 (round up)
  if (allAttackers.some((u) => supplyStateOf(u) === SupplyState.NO)) drm.noSupplyHalving = true;
  // Inverno Russo: -1 alle unità tedesche che attaccano in SEVERE o POOR
  if (
    isBarbarossa1941Scenario(state.scenarioId) &&
    primaryAttacker.country === "Germany" &&
    (weather === WeatherType.SEVERE || weather === WeatherType.POOR)
  ) drm.russianWinter = -1;

  drm.total = sumDrm(drm);
  return drm;
};

const computeDefenderDrm = (state: GameState, defender: Unit): CombatDrmBreakdown => {
  const drm = emptyDrm();
  if (defender.country === "Germany") drm.germanyUnit = 2;
  if (["France", "UK", "USA"].includes(defender.country || "")) drm.westernUnit = 1;
  if (defender.elite) drm.elite = 1;
  if (defender.reduced) drm.reduced = -2;
  if (supplyStateOf(defender) === SupplyState.LOW) drm.lowSupply = -2;
  if (defender.type === UnitType.ARMOR) {
    if (state.weather === WeatherType.FAIR) drm.tankFair = 2;
    else if (state.weather === WeatherType.POOR) drm.tankPoor = 1;
  }
  if (state.weather === WeatherType.SEVERE) drm.severeWeatherHalving = true;
  if (supplyStateOf(defender) === SupplyState.NO) drm.noSupplyHalving = true;
  // Inverno Russo: -1 alle unità tedesche che difendono in SEVERE o POOR
  if (
    isBarbarossa1941Scenario(state.scenarioId) &&
    defender.country === "Germany" &&
    (state.weather === WeatherType.SEVERE || state.weather === WeatherType.POOR)
  ) drm.russianWinter = -1;
  drm.total = sumDrm(drm);
  return drm;
};

// 5.1 step 5 — applica halving al modified die result
const applyHalving = (modified: number, drm: CombatDrmBreakdown): number => {
  let value = modified;
  if (drm.noSupplyHalving) value = Math.ceil(value / 2);
  if (drm.severeWeatherHalving) value = Math.ceil(value / 2);
  if (drm.primaryAttackerFortAttack) value = Math.ceil(value / 2);
  return Math.max(1, value);
};

const rollD6 = (): number => Math.floor(Math.random() * 6) + 1;

const combatResultLongText = (code: CombatResultCode): string => {
  switch (code) {
    case CombatResultCode.NO_EFFECT:
      return "nessun effetto";
    case CombatResultCode.DR:
      return "difensore in ritirata";
    case CombatResultCode.DD:
      return "difensore ridotto o eliminato se gia ridotto";
    case CombatResultCode.DE:
      return "difensore eliminato";
    case CombatResultCode.AS:
      return "attaccante fermato";
    case CombatResultCode.AA:
      return "attaccante ridotto o eliminato se gia ridotto";
  }
};

const eventOwnerSide = (state: GameState, markerId: string): Side | null => {
  if (state.factionCards[Side.AXIS].eventsBox.includes(markerId)) return Side.AXIS;
  if (state.factionCards[Side.ALLIED].eventsBox.includes(markerId)) return Side.ALLIED;
  return null;
};

const eventReturnEntry = (state: GameState, side: Side, markerId: string, delay: number): EventTurnTrackEntry => ({
  side,
  markerId,
  returnTurn: state.turn + delay
});

// 13.4 (Jets) e 13.10 (Tanks): "put this marker on the next turn on the Turn
// Track", cioè ritorno garantito al turno successivo. Tutti gli altri marker
// giocati in combattimento tornano dopo un tiro di d6 (13.2, 13.3, 13.7, 13.8, 13.11).
const combatEventReturnDelay = (markerId: string): number => {
  const name = markerId.toLowerCase();
  if (name.includes("tanks") || name.includes("jets")) return 1;
  return rollD6();
};

const addEventReturnEntries = (state: GameState, entries: EventTurnTrackEntry[]): GameState => {
  if (entries.length === 0) return state;
  return {
    ...state,
    eventTurnTrack: [...(state.eventTurnTrack || []), ...entries]
  };
};

const processEventReturns = (state: GameState): { state: GameState; returned: string[] } => {
  const track = state.eventTurnTrack || [];
  const due = track.filter((entry) => entry.returnTurn <= state.turn);
  if (due.length === 0) return { state, returned: [] };

  const factionCards = {
    [Side.AXIS]: { ...state.factionCards[Side.AXIS], eventsBox: [...state.factionCards[Side.AXIS].eventsBox] },
    [Side.ALLIED]: { ...state.factionCards[Side.ALLIED], eventsBox: [...state.factionCards[Side.ALLIED].eventsBox] }
  };
  due.forEach((entry) => {
    if (!factionCards[entry.side].eventsBox.includes(entry.markerId)) {
      factionCards[entry.side].eventsBox.push(entry.markerId);
    }
  });

  return {
    state: {
      ...state,
      factionCards,
      eventTurnTrack: track.filter((entry) => entry.returnTurn > state.turn)
    },
    returned: due.map((entry) => entry.markerId)
  };
};

export interface CombatPreview {
  attackerBaseRoll: number;
  defenderBaseRoll: number;
  attackerModifier: number;
  defenderModifier: number;
  attackerDrmText: string;
  defenderDrmText: string;
  attackType: AttackType;
  isAmphibious: boolean;
  expectedAttackerFinal: number;
  expectedDefenderFinal: number;
  likelyResult: CombatResultCode;
  airSupportContested: boolean;
  airSupportNote?: string;
}

export const getCombatPreview = (
  state: GameState,
  attacker: Unit,
  defender: Unit,
  options?: ResolveCombatOptions
): CombatPreview => {
  const attackType = options?.attackType ?? AttackType.MOBILE;
  const additionalAttackers: Unit[] = (options?.additionalAttackerIds || [])
    .map((id) => state.units.get(id))
    .filter((u): u is Unit => Boolean(u && u.side === attacker.side && u.status !== UnitStatus.DESTROYED && hexDistance(u.position, defender.position) === 1))
    .slice(0, 2);
  const drmA = computeAttackerDrm(state, attacker, additionalAttackers, defender, attackType, options?.isAmphibious);
  const drmD = computeDefenderDrm(state, defender);
  applyCombatEventDrm(state, options?.eventMarkerIds || [], attacker, additionalAttackers, defender, drmA, drmD);
  const defenderKey = coordKey(defender.position);
  const partisansAffectDefender = Object.values(state.partisansMarkers || {}).some((keys) => keys?.includes(defenderKey));
  if (partisansAffectDefender) {
    drmD.eventSnafu -= 2;
    drmD.total = sumDrm(drmD);
  }
  const surpriseMarkers = state.surpriseAttackMarkers?.[attacker.side] || [];
  const surpriseAffectsAttack = surpriseMarkers.some((key) => {
    const [q, r] = key.split(",").map(Number);
    return hexDistance({ q, r }, defender.position) <= 2;
  });
  if (surpriseAffectsAttack && !(options?.eventMarkerIds || []).some((id) => id.toLowerCase().includes("surprise"))) {
    drmA.eventUltra += 1;
    drmA.total = sumDrm(drmA);
  }
  // 13.1: se un'unità nemica NELL'HEX del marker Airdrop viene attaccata, è il
  // DIFENSORE ad applicare un -2. Non è un bonus all'attaccante e non si estende
  // agli hex adiacenti.
  const airdropAffectsAttack = (state.airdropMarkers?.[attacker.side] || []).includes(defenderKey);
  if (airdropAffectsAttack) {
    drmD.eventSnafu -= 2;
    drmD.total = sumDrm(drmD);
  }
  const attackerNationalities = [attacker, ...additionalAttackers].map((u) => u.country || "");
  const airAtt = options?.airSupportAttackerId ? state.units.get(options.airSupportAttackerId) : undefined;
  const airDef = options?.airSupportDefenderId ? state.units.get(options.airSupportDefenderId) : undefined;
  const airAttValid = Boolean(airAtt && airAtt.side === attacker.side && isLegalAirSupporter(state, airAtt, defender, attackerNationalities));
  const airDefValid = Boolean(airDef && airDef.side === defender.side && isLegalAirSupporter(state, airDef, defender, attackerNationalities));
  const airSupportContested = airAttValid && airDefValid;
  if (airAttValid && !airSupportContested) {
    if (state.weather === WeatherType.FAIR) drmA.airSupportFair = 2;
    else if (state.weather === WeatherType.POOR) drmA.airSupportPoor = 1;
    drmA.total = sumDrm(drmA);
  }
  if (airDefValid && !airSupportContested) {
    if (state.weather === WeatherType.FAIR) drmD.airSupportFair = 2;
    else if (state.weather === WeatherType.POOR) drmD.airSupportPoor = 1;
    drmD.total = sumDrm(drmD);
  }
  const attackerBaseRoll = 4;
  const defenderBaseRoll = 4;
  const expectedAttackerFinal = applyHalving(Math.max(1, attackerBaseRoll + Math.max(-10, Math.min(10, drmA.total))), drmA);
  const expectedDefenderFinal = applyHalving(Math.max(1, defenderBaseRoll + Math.max(-10, Math.min(10, drmD.total))), drmD);
  const previewNotes: string[] = [];
  if (airdropAffectsAttack) previewNotes.push("Airdrop sull'hex del difensore: -2 DRM difensore.");
  if (surpriseAffectsAttack) previewNotes.push("Surprise Attack attivo entro 2 esagoni.");
  if (partisansAffectDefender) previewNotes.push("Partisans attivi sul difensore.");
  if (airSupportContested) previewNotes.push("Air Support conteso: il DRM finale dipende dall'air combat.");
  return {
    attackerBaseRoll,
    defenderBaseRoll,
    attackerModifier: drmA.total,
    defenderModifier: drmD.total,
    attackerDrmText: formatDrmBreakdown(drmA),
    defenderDrmText: formatDrmBreakdown(drmD),
    attackType,
    isAmphibious: Boolean(options?.isAmphibious),
    expectedAttackerFinal,
    expectedDefenderFinal,
    likelyResult: lookupGroundCrtResult(expectedAttackerFinal, expectedDefenderFinal).code as CombatResultCode,
    airSupportContested,
    airSupportNote: previewNotes.length > 0 ? previewNotes.join(" ") : undefined
  };
};

export interface CombatOutcome {
  attackerFinal: number;
  defenderFinal: number;
  attackerRoll: number;
  defenderRoll: number;
  attackerDrm: CombatDrmBreakdown;
  defenderDrm: CombatDrmBreakdown;
  resultCode: CombatResultCode;
}

// Applica un risultato CRT + retreat + advance + AS/AA
// Cambio stato unità in input e ritorna lo state aggiornato.
export const applyCombatResult = (
  state: GameState,
  primaryAttacker: Unit,
  additionalAttackers: Unit[],
  defender: Unit,
  attackType: AttackType,
  outcome: CombatOutcome,
  forceAdvance = false
): GameState => {
  const units = new Map(state.units);
  const allAttackers = [primaryAttacker, ...additionalAttackers];
  let next = state;

  const reduceOrEliminate = (unit: Unit): { eliminated: boolean; updated: Unit } => {
    if (unit.reduced) {
      return { eliminated: true, updated: { ...unit, status: UnitStatus.DESTROYED, strength: 0 } };
    }
    return { eliminated: false, updated: { ...unit, reduced: true, strength: Math.ceil(unit.maxStrength / 2) } };
  };

  const placeNoEzocMarker = (coord: HexCoord): GameState => {
    if (attackType !== AttackType.MOBILE) return next;
    const map = new Map(next.map);
    const hex = map.get(coordKey(coord));
    if (hex) map.set(coordKey(coord), { ...hex, noEzocMarker: true });
    return { ...next, map };
  };

  const endActivation = (unit: Unit) => {
    const u = units.get(unit.id);
    if (u) units.set(u.id, { ...u, activated: true, moved: true, combat: true });
  };

  switch (outcome.resultCode) {
    case CombatResultCode.NO_EFFECT:
      // Per Mobile: combat over, attaccante può continuare; per Assault: combat over.
      endActivation(primaryAttacker);
      additionalAttackers.forEach(endActivation);
      break;

    case CombatResultCode.DR: {
      const retreatHexes = computeLegalRetreatHexes(state, defender, allAttackers);
      if (retreatHexes.length === 0) {
        // Cannot retreat (5.3.5.2): full→reduce, reduced→eliminate
        const { eliminated, updated } = reduceOrEliminate(defender);
        units.set(defender.id, updated);
        if (eliminated && attackType === AttackType.MOBILE) {
          next = placeNoEzocMarker(defender.position);
        }
        if (eliminated) {
          // advance prompt
          next = withPendingAdvance(next, primaryAttacker.id, defender.id, attackType, defender.position, outcome.resultCode, allAttackers.map((u) => u.id), forceAdvance);
        }
      } else if (retreatHexes.length === 1 && !defender.occupyingFort) {
        // unica scelta: applica direttamente
        units.set(defender.id, { ...defender, position: retreatHexes[0] });
        next = withPendingAdvance(next, primaryAttacker.id, defender.id, attackType, defender.position, outcome.resultCode, allAttackers.map((u) => u.id), forceAdvance);
      } else {
        // Più opzioni: prompt giocatore
        next = {
          ...next,
          pendingCombat: {
            kind: "retreat",
            attackerId: primaryAttacker.id,
            defenderId: defender.id,
            attackType,
            options: retreatHexes,
            defenderHex: defender.position,
            resultCode: outcome.resultCode,
            followUpAdvance: true,
            advanceAttackerIds: allAttackers.map((u) => u.id),
            forceAdvance,
            allowDefenderCannotRetreat: Boolean(defender.occupyingFort)
          }
        };
      }
      if (attackType === AttackType.ASSAULT) {
        endActivation(primaryAttacker);
        additionalAttackers.forEach(endActivation);
      }
      break;
    }

    case CombatResultCode.DD: {
      if (defender.reduced) {
        units.set(defender.id, { ...defender, status: UnitStatus.DESTROYED, strength: 0 });
        if (attackType === AttackType.MOBILE) next = placeNoEzocMarker(defender.position);
        next = withPendingAdvance(next, primaryAttacker.id, defender.id, attackType, defender.position, outcome.resultCode, allAttackers.map((u) => u.id), forceAdvance);
      } else {
        const reduced = { ...defender, reduced: true, strength: Math.ceil(defender.maxStrength / 2) };
        const retreatHexes = computeLegalRetreatHexes(state, reduced, allAttackers);
        if (retreatHexes.length === 0) {
          units.set(defender.id, { ...reduced, status: UnitStatus.DESTROYED, strength: 0 });
          if (attackType === AttackType.MOBILE) next = placeNoEzocMarker(defender.position);
          next = withPendingAdvance(next, primaryAttacker.id, defender.id, attackType, defender.position, outcome.resultCode, allAttackers.map((u) => u.id), forceAdvance);
        } else if (retreatHexes.length === 1) {
          units.set(defender.id, { ...reduced, position: retreatHexes[0] });
          next = withPendingAdvance(next, primaryAttacker.id, defender.id, attackType, defender.position, outcome.resultCode, allAttackers.map((u) => u.id), forceAdvance);
        } else {
          units.set(defender.id, reduced);
          next = {
            ...next,
            pendingCombat: {
              kind: "retreat",
              attackerId: primaryAttacker.id,
              defenderId: defender.id,
              attackType,
              options: retreatHexes,
              defenderHex: defender.position,
              resultCode: outcome.resultCode,
              followUpAdvance: true,
              advanceAttackerIds: allAttackers.map((u) => u.id),
              forceAdvance
            }
          };
        }
      }
      if (attackType === AttackType.ASSAULT) {
        endActivation(primaryAttacker);
        additionalAttackers.forEach(endActivation);
      }
      break;
    }

    case CombatResultCode.DE: {
      units.set(defender.id, { ...defender, status: UnitStatus.DESTROYED, strength: 0 });
      if (attackType === AttackType.MOBILE) next = placeNoEzocMarker(defender.position);
      next = withPendingAdvance(next, primaryAttacker.id, defender.id, attackType, defender.position, outcome.resultCode, allAttackers.map((u) => u.id), forceAdvance);
      if (attackType === AttackType.ASSAULT) {
        endActivation(primaryAttacker);
        additionalAttackers.forEach(endActivation);
      }
      break;
    }

    case CombatResultCode.AS: {
      endActivation(primaryAttacker);
      additionalAttackers.forEach(endActivation);
      break;
    }

    case CombatResultCode.AA: {
      const result = reduceOrEliminate(primaryAttacker);
      units.set(primaryAttacker.id, { ...result.updated, activated: true, moved: true, combat: true });
      additionalAttackers.forEach(endActivation);
      break;
    }
  }

  return { ...next, units };
};

const applyDefenderCannotRetreatResult = (
  state: GameState,
  defender: Unit,
  attackType: AttackType,
  attackerId: string,
  advanceAttackerIds: string[],
  defenderHex: HexCoord,
  resultCode: CombatResultCode,
  forceAdvance = false
): GameState => {
  const units = new Map(state.units);

  if (defender.reduced) {
    units.set(defender.id, { ...defender, status: UnitStatus.DESTROYED, strength: 0 });
    let next: GameState = { ...state, units, pendingCombat: undefined };
    if (attackType === AttackType.MOBILE) {
      const map = new Map(next.map);
      const hex = map.get(coordKey(defender.position));
      if (hex) map.set(coordKey(defender.position), { ...hex, noEzocMarker: true });
      next = { ...next, map };
    }
    return withPendingAdvance(next, attackerId, defender.id, attackType, defenderHex, resultCode, advanceAttackerIds, forceAdvance);
  }

  units.set(defender.id, { ...defender, reduced: true, strength: Math.ceil(defender.maxStrength / 2) });
  return { ...state, units, pendingCombat: undefined };
};

// Helper: aggiunge pendingCombat di tipo "advance" se l'attaccante può ancora avanzare
const withPendingAdvance = (
  state: GameState,
  attackerId: string,
  defenderId: string,
  attackType: AttackType,
  defenderHex: HexCoord,
  resultCode: CombatResultCode,
  advanceAttackerIds: string[] = [attackerId],
  forceAdvance = false
): GameState => {
  const attacker = state.units.get(attackerId);
  if (!attacker || attacker.status === UnitStatus.DESTROYED) return state;
  if (attacker.type === UnitType.AIR) return state;
  const eligibleAdvanceAttackers = advanceAttackerIds.filter((id) => {
    const unit = state.units.get(id);
    return Boolean(unit && unit.status !== UnitStatus.DESTROYED && unit.type !== UnitType.AIR && unit.type !== UnitType.FORT);
  });
  return {
    ...state,
    pendingCombat: {
      kind: "advance",
      attackerId,
      advanceAttackerIds: eligibleAdvanceAttackers.length > 0 ? eligibleAdvanceAttackers : [attackerId],
      defenderId,
      attackType,
      options: [defenderHex],
      defenderHex,
      resultCode,
      forceAdvance
    }
  };
};

// 5.3.5: applica scelta retreat del difensore
export const resolveRetreatChoice = (state: GameState, target: HexCoord): GameState | null => {
  const pending = state.pendingCombat;
  if (!pending || pending.kind !== "retreat") return null;

  const defender = state.units.get(pending.defenderId);
  if (!defender) return null;
  const attackers = [pending.attackerId, ...(pending.advanceAttackerIds || [])]
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .map((id) => state.units.get(id))
    .filter((unit): unit is Unit => Boolean(unit && unit.status !== UnitStatus.DESTROYED));
  const legalOptions = computeLegalRetreatHexes(state, defender, attackers);
  if (!legalOptions.some((c) => sameCoord(c, target))) return null;

  const units = new Map(state.units);
  units.set(defender.id, { ...defender, position: target, occupyingFort: false });

  let next: GameState = { ...state, units, pendingCombat: undefined };
  // Follow-up: prompt advance per attaccante
  if (pending.followUpAdvance) {
    next = withPendingAdvance(
      next,
      pending.attackerId,
      pending.defenderId,
      pending.attackType,
      pending.defenderHex,
      pending.resultCode,
      pending.advanceAttackerIds,
      pending.forceAdvance
    );
  }
  return next;
};

export const resolveDefenderCannotRetreatChoice = (state: GameState): GameState | null => {
  const pending = state.pendingCombat;
  if (!pending || pending.kind !== "retreat" || !pending.allowDefenderCannotRetreat) return null;
  const defender = state.units.get(pending.defenderId);
  if (!defender) return null;
  return applyDefenderCannotRetreatResult(
    state,
    defender,
    pending.attackType,
    pending.attackerId,
    pending.advanceAttackerIds || [pending.attackerId],
    pending.defenderHex,
    pending.resultCode,
    pending.forceAdvance
  );
};

// 5.3.7: applica scelta advance dell'attaccante
export const resolveAdvanceChoice = (state: GameState, advance: boolean, attackerId?: string): GameState | null => {
  const pending = state.pendingCombat;
  if (!pending || pending.kind !== "advance") return null;
  const chosenAttackerId = attackerId || pending.attackerId;
  const willAdvance = advance || Boolean(pending.forceAdvance);
  if (willAdvance && pending.advanceAttackerIds && !pending.advanceAttackerIds.includes(chosenAttackerId)) return null;
  const attacker = state.units.get(chosenAttackerId);
  if (!attacker) return null;

  const units = new Map(state.units);
  if (willAdvance && attacker.status !== UnitStatus.DESTROYED) {
    units.set(attacker.id, { ...attacker, position: pending.defenderHex, mapPresence: "france", occupyingFort: false });
  }
  let nextState: GameState = { ...state, units, pendingCombat: undefined };
  if (willAdvance && attacker.status !== UnitStatus.DESTROYED && attacker.type !== UnitType.AIR) {
    // 4.2.3.7: displace air nemiche dall'hex in cui l'attaccante entra
    nextState = displaceEnemyAirFrom(nextState, pending.defenderHex, attacker.side);
    const claim = applyHexControlChange(nextState, pending.defenderHex, attacker.side);
    nextState = applyNationalWillDelta(claim.state, claim.nationalWillDelta);
    if (claim.note) {
      nextState = {
        ...nextState,
        history: [
          { type: ActionType.MOVE, side: attacker.side, unitId: attacker.id, toPos: pending.defenderHex, note: claim.note, timestamp: new Date() },
          ...nextState.history
        ]
      };
    }
  }
  if (willAdvance && attacker.status !== UnitStatus.DESTROYED) {
    nextState = occupyFriendlyFortIfEligible(nextState, attacker.id);
  }
  // 5.3.6: dopo che l'attivazione effettiva termina (Assault end/AS/AA), pulisci No EZOC markers.
  // Per Mobile l'unità potrebbe ancora muoversi, ma se è stata advance-ata e non ha più MP,
  // l'attivazione è di fatto finita; per semplicità puliamo qui.
  if (pending.attackType === AttackType.ASSAULT) {
    nextState = clearNoEzocMarkers(nextState);
  }
  // 12.1: collapse detection dopo eventuale cattura città
  nextState = checkCountryCollapses(nextState);
  return nextState;
};

export interface ResolveCombatOptions {
  attackType?: AttackType;
  isAmphibious?: boolean;
  additionalAttackerIds?: string[];
  airSupportAttackerId?: string; // 6.2.3: air unit committed dall'attaccante
  airSupportDefenderId?: string;
  eventMarkerIds?: string[];
}

type CombatEventKind = "tanks" | "ultra" | "freeForces" | "groundSupport" | "jets" | "rockets" | "snafu";

export interface CombatEventMarker {
  id: string;
  kind: CombatEventKind;
  side: Side;
  country?: string;
}

const parseCombatEventMarker = (id: string, ownerSide: Side): CombatEventMarker | null => {
  const normalized = id.toLowerCase();
  if (normalized.includes("tanks")) {
    const country = id.replace(/\s*Tanks.*$/i, "").replace(/^\d+x\s*/i, "").trim();
    return { id, kind: "tanks", side: ownerSide, country: country || undefined };
  }
  if (normalized.includes("ultra")) return { id, kind: "ultra", side: ownerSide };
  if (normalized.includes("free forces")) return { id, kind: "freeForces", side: ownerSide };
  if (normalized.includes("ground support")) return { id, kind: "groundSupport", side: ownerSide };
  if (normalized.includes("jets")) return { id, kind: "jets", side: ownerSide };
  if (normalized.includes("rockets")) return { id, kind: "rockets", side: ownerSide };
  if (normalized.includes("snafu")) return { id, kind: "snafu", side: ownerSide };
  return null;
};

const combatUnitsForSide = (attacker: Unit, additionalAttackers: Unit[], defender: Unit, side: Side): Unit[] =>
  side === attacker.side ? [attacker, ...additionalAttackers] : [defender];

const eligibleCombatEventsForSide = (
  state: GameState,
  attacker: Unit,
  additionalAttackers: Unit[],
  defender: Unit,
  side: Side,
  alreadyCommitted: string[] = []
): CombatEventMarker[] => {
  const card = state.factionCards[side];
  const units = combatUnitsForSide(attacker, additionalAttackers, defender, side);
  return card.eventsBox
    .filter((id) => !alreadyCommitted.includes(id))
    .map((id) => parseCombatEventMarker(id, side))
    .filter((marker): marker is CombatEventMarker => {
      if (!marker) return false;
      if (marker.kind === "ultra") return side === Side.ALLIED && (attacker.side === Side.ALLIED || defender.side === Side.ALLIED);
      if (marker.kind === "freeForces") return side === Side.ALLIED && units.some((u) => u.type !== UnitType.AIR && u.type !== UnitType.FORT);
      if (marker.kind === "groundSupport") {
        return units.some((u) =>
          u.type !== UnitType.AIR &&
          u.type !== UnitType.FORT &&
          !["France", "Germany", "Italy", "UK", "USA"].includes(u.country || "")
        );
      }
      if (marker.kind === "rockets") return side === Side.AXIS && units.some((u) => u.country === "Germany");
      if (marker.kind === "jets") return side === Side.AXIS;
      if (marker.kind === "snafu") return units.some((u) => u.type !== UnitType.FORT);
      if (marker.kind === "tanks") {
        return units.some((u) =>
          u.type !== UnitType.AIR &&
          u.type !== UnitType.FORT &&
          u.type !== UnitType.ARMOR &&
          (!marker.country || u.country === marker.country)
        );
      }
      return false;
    });
};

export const getEligibleCombatEventMarkers = (
  state: GameState,
  attackerId: string,
  defenderId: string,
  additionalAttackerIds: string[],
  committingSide: Side,
  alreadyCommitted: string[] = []
): CombatEventMarker[] => {
  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);
  if (!attacker || !defender) return [];
  const additionalAttackers = additionalAttackerIds
    .map((id) => state.units.get(id))
    .filter((u): u is Unit => Boolean(u));
  return eligibleCombatEventsForSide(state, attacker, additionalAttackers, defender, committingSide, alreadyCommitted);
};

// 6.2.3: una air unit può supportare se entro 5 hex dal difensore E stessa nazionalità di un attaccante o difensore
// 6.2.3: "The air unit must be in a hex and of the same nationality as the
// defending unit or one of the attacking ground units." Chi difende può quindi
// impegnare solo aerei della nazionalità del difensore, chi attacca solo aerei
// della nazionalità di una delle unità attaccanti.
const matchesAirSupportNationality = (air: Unit, defender: Unit, attackerNationalities: string[]): boolean => {
  const allowed = (air.side === defender.side ? [defender.country || ""] : attackerNationalities).filter(Boolean);
  // Dati incompleti (unità senza nazionalità): non restringiamo.
  if (allowed.length === 0 || !air.country) return true;
  return allowed.includes(air.country);
};

const isLegalAirSupporter = (_state: GameState, air: Unit, defender: Unit, _attackerNationalities: string[]): boolean => {
  if (air.type !== UnitType.AIR) return false;
  if (air.status === UnitStatus.DESTROYED) return false;
  if (sortiesFor(air) >= GAME_RULES.AIR.MAX_SORTIES) return false;
  if (!matchesAirSupportNationality(air, defender, _attackerNationalities)) return false;
  if (isFna1942Scenario(_state.scenarioId) && air.id === FNA_AXIS_AIR_SUPPORT_ID) {
    return air.side === Side.AXIS &&
      (_state.fnaAxisAirSortiesUsed || 0) < 2 &&
      hexDistance(FNA_AXIS_AIR_SUPPORT_HEX, defender.position) <= GAME_RULES.AIR.AIR_SUPPORT_RANGE;
  }
  if (isWesternMedUnit(air)) {
    return air.side === Side.ALLIED && isWesternMedAirSupportHex(defender.position);
  }
  if (hexDistance(air.position, defender.position) > GAME_RULES.AIR.AIR_SUPPORT_RANGE) return false;
  return true;
};

// 6.2.3: lista di air units di `committingSide` che possono supportare il combat dato.
export const getEligibleAirSupporters = (
  state: GameState,
  attackerId: string,
  defenderId: string,
  additionalAttackerIds: string[],
  committingSide: Side
): Unit[] => {
  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);
  if (!attacker || !defender) return [];
  const additional = additionalAttackerIds
    .map((id) => state.units.get(id))
    .filter((u): u is Unit => Boolean(u));
  const attackerNationalities = [attacker, ...additional].map((u) => u.country || "");
  return Array.from(state.units.values()).filter(
    (u) => u.side === committingSide && isLegalAirSupporter(state, u, defender, attackerNationalities)
  );
};

const hasCommitOptions = (
  state: GameState,
  attackerId: string,
  defenderId: string,
  additionalAttackerIds: string[],
  side: Side,
  committedEvents: string[] = []
): boolean =>
  getEligibleAirSupporters(state, attackerId, defenderId, additionalAttackerIds, side).length > 0 ||
  getEligibleCombatEventMarkers(state, attackerId, defenderId, additionalAttackerIds, side, committedEvents).length > 0;

// 6.2.3 / 5.1 step 2: prepara il prompt Will Commit prima di lanciare il combat.
// Lo storage di pendingCombat={kind:'commit'} blocca l'avanzamento finché entrambe le fazioni
// hanno scelto se committare un'air unit.
export const prepareCombat = (
  state: GameState,
  attackerId: string,
  defenderId: string,
  options?: ResolveCombatOptions
): GameState | null => {
  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);
  if (!attacker || !defender) return null;
  if (attacker.side === defender.side) return null;
  const attackType = options?.attackType ?? AttackType.MOBILE;
  const additionalAttackerIds = options?.additionalAttackerIds || [];
  return {
    ...state,
    pendingCombat: {
      kind: "commit",
      attackerId,
      defenderId,
      attackType,
      isAmphibious: options?.isAmphibious,
      additionalAttackerIds,
      eventMarkerAttackerIds: [],
      eventMarkerDefenderIds: [],
      stage: "attacker"
    }
  };
};

// 6.2.3: la fazione corrente del prompt sceglie se committare un'air unit (id) o passare (null).
// Quando entrambe hanno scelto, esegue il combat con i parametri salvati.
export const confirmAirCommit = (state: GameState, airUnitId: string | null): GameState | null => {
  const pending = state.pendingCombat;
  if (!pending || pending.kind !== "commit") return null;

  const attacker = state.units.get(pending.attackerId);
  const defender = state.units.get(pending.defenderId);
  if (!attacker || !defender) return null;
  const additional = pending.additionalAttackerIds
    .map((id) => state.units.get(id))
    .filter((u): u is Unit => Boolean(u));
  const attackerNationalities = [attacker, ...additional].map((u) => u.country || "");

  const committingSide = pending.stage === "attacker" ? attacker.side : defender.side;
  let nextPending: PendingCommitState = { ...pending };

  if (airUnitId) {
    const air = state.units.get(airUnitId);
    if (!air || air.side !== committingSide) return null;
    if (!isLegalAirSupporter(state, air, defender, attackerNationalities)) return null;
    if (pending.stage === "attacker" && pending.airSupportAttackerId) return null;
    if (pending.stage === "defender" && pending.airSupportDefenderId) return null;
    if (pending.stage === "attacker") nextPending.airSupportAttackerId = airUnitId;
    else nextPending.airSupportDefenderId = airUnitId;
    return { ...state, pendingCombat: nextPending };
  }

  // Il passaggio esplicito chiude il commit del lato corrente.
  if (pending.stage === "attacker") {
    const defenderHasEligible = hasCommitOptions(
      state,
      pending.attackerId,
      pending.defenderId,
      pending.additionalAttackerIds,
      defender.side,
      pending.eventMarkerDefenderIds || []
    );
    if (defenderHasEligible) {
      nextPending = { ...nextPending, stage: "defender" };
      return { ...state, pendingCombat: nextPending };
    }
  }

  // Entrambe le fazioni hanno scelto: lancia il combat con gli ID committed.
  const stateBeforeResolve: GameState = { ...state, pendingCombat: undefined };
  return resolveCombat(stateBeforeResolve, pending.attackerId, pending.defenderId, {
    attackType: pending.attackType,
    isAmphibious: pending.isAmphibious,
    additionalAttackerIds: pending.additionalAttackerIds,
    airSupportAttackerId: nextPending.airSupportAttackerId,
    airSupportDefenderId: nextPending.airSupportDefenderId,
    eventMarkerIds: [...(nextPending.eventMarkerAttackerIds || []), ...(nextPending.eventMarkerDefenderIds || [])]
  });
};

export const commitCombatEventMarker = (state: GameState, markerId: string): GameState | null => {
  const pending = state.pendingCombat;
  if (!pending || pending.kind !== "commit") return null;
  const attacker = state.units.get(pending.attackerId);
  const defender = state.units.get(pending.defenderId);
  if (!attacker || !defender) return null;
  const committingSide = pending.stage === "attacker" ? attacker.side : defender.side;
  const alreadyCommitted = committingSide === attacker.side
    ? pending.eventMarkerAttackerIds || []
    : pending.eventMarkerDefenderIds || [];
  const eligible = getEligibleCombatEventMarkers(
    state,
    pending.attackerId,
    pending.defenderId,
    pending.additionalAttackerIds,
    committingSide,
    alreadyCommitted
  );
  if (!eligible.some((marker) => marker.id === markerId)) return null;

  const nextPending: PendingCommitState = committingSide === attacker.side
    ? { ...pending, eventMarkerAttackerIds: [...alreadyCommitted, markerId] }
    : { ...pending, eventMarkerDefenderIds: [...alreadyCommitted, markerId] };
  return { ...state, pendingCombat: nextPending };
};

export const passCombatCommit = (state: GameState): GameState | null => confirmAirCommit(state, null);

const applyCombatEventDrm = (
  state: GameState,
  eventIds: string[],
  attacker: Unit,
  additionalAttackers: Unit[],
  defender: Unit,
  attackerDrm: CombatDrmBreakdown,
  defenderDrm: CombatDrmBreakdown
): string[] => {
  const committed: string[] = [];
  const markers = eventIds.flatMap((id) => {
    const ownerSide = eventOwnerSide(state, id);
    const marker = ownerSide ? parseCombatEventMarker(id, ownerSide) : null;
    return marker ? [marker] : [];
  });

  markers.forEach((marker) => {
    const ownDrm = marker.side === attacker.side ? attackerDrm : defenderDrm;
    const enemyDrm = marker.side === attacker.side ? defenderDrm : attackerDrm;
    const ownUnits = combatUnitsForSide(attacker, additionalAttackers, defender, marker.side);

    if (marker.kind === "tanks") {
      const canApply = ownUnits.some((u) =>
        u.type !== UnitType.AIR &&
        u.type !== UnitType.FORT &&
        u.type !== UnitType.ARMOR &&
        (!marker.country || u.country === marker.country)
      );
      if (!canApply) return;
      ownDrm.eventTanks += state.weather === WeatherType.POOR ? 1 : 2;
      committed.push(marker.id);
      return;
    }
    if (marker.kind === "ultra") {
      ownDrm.eventUltra += 1;
      committed.push(marker.id);
      return;
    }
    if (marker.kind === "freeForces") {
      ownDrm.eventFreeForces += 1;
      committed.push(marker.id);
      return;
    }
    if (marker.kind === "groundSupport") {
      ownDrm.eventGroundSupport += 1;
      committed.push(marker.id);
      return;
    }
    if (marker.kind === "rockets") {
      enemyDrm.eventRockets -= 2;
      committed.push(marker.id);
      return;
    }
    if (marker.kind === "jets") {
      committed.push(marker.id);
      return;
    }
    if (marker.kind === "snafu") {
      enemyDrm.eventSnafu -= 1;
      committed.push(marker.id);
    }
  });

  attackerDrm.total = sumDrm(attackerDrm);
  defenderDrm.total = sumDrm(defenderDrm);
  return committed;
};

const removeCommittedEvents = (cards: GameState["factionCards"], committed: string[]): GameState["factionCards"] => {
  if (committed.length === 0) return cards;
  const committedSet = new Set(committed);
  return {
    [Side.AXIS]: {
      ...cards[Side.AXIS],
      eventsBox: cards[Side.AXIS].eventsBox.filter((id) => !committedSet.has(id))
    },
    [Side.ALLIED]: {
      ...cards[Side.ALLIED],
      eventsBox: cards[Side.ALLIED].eventsBox.filter((id) => !committedSet.has(id))
    }
  };
};

export const executeNavalEvacuation = (state: GameState, unitId: string): GameState | null => {
  const unit = state.units.get(unitId);
  if (!unit || unit.country !== "UK" || unit.type === UnitType.AIR || unit.type === UnitType.FORT) return null;
  if (unit.status === UnitStatus.DESTROYED) return null;
  const card = state.factionCards[unit.side];
  const marker = card.eventsBox.find((id) => id.toLowerCase().includes("naval evacuation"));
  if (!marker) return null;
  const currentHex = state.map.get(coordKey(unit.position));
  if (!currentHex || !isCoastalHex(currentHex)) return null;
  const target = Array.from(state.map.values()).find((hex) => {
    if (!hex.features.port || hex.features.controller !== unit.side) return false;
    if (sameCoord(hex.coord, unit.position)) return false;
    const occupant = getGroundUnitOnHex(state, hex.coord);
    return !occupant || occupant.side === unit.side;
  });
  if (!target) return null;
  const units = new Map(state.units);
  units.set(unit.id, {
    ...unit,
    position: target.coord,
    reduced: true,
    strength: Math.min(unit.strength, Math.ceil(unit.maxStrength / 2)),
    activated: true,
    moved: true
  });
  const returnEntry = eventReturnEntry(state, unit.side, marker, rollD6());
  return addEventReturnEntries({
    ...state,
    units,
    factionCards: {
      ...state.factionCards,
      [unit.side]: { ...card, eventsBox: card.eventsBox.filter((id) => id !== marker) }
    },
    history: [
      { type: ActionType.MOVE, side: unit.side, unitId, fromPos: unit.position, toPos: target.coord, note: `${unit.name} naval evacuation to ${hexCodeFor(target.coord)}. ${marker} returns on turn ${returnEntry.returnTurn}.`, timestamp: new Date() },
      ...state.history
    ],
    timestamp: new Date()
  }, [returnEntry]);
};

export const calculateNavalEvacuationTargets = (state: GameState, unit: Unit): HexCoord[] => {
  if (unit.country !== "UK" || unit.type === UnitType.AIR || unit.type === UnitType.FORT) return [];
  if (unit.status === UnitStatus.DESTROYED) return [];
  const card = state.factionCards[unit.side];
  if (!card.eventsBox.some((id) => id.toLowerCase().includes("naval evacuation"))) return [];
  const currentHex = state.map.get(coordKey(unit.position));
  if (!currentHex || !isCoastalHex(currentHex)) return [];
  return Array.from(state.map.values())
    .filter((hex) => {
      if (!hex.features.port || hex.features.controller !== unit.side) return false;
      if (sameCoord(hex.coord, unit.position)) return false;
      const occupant = getGroundUnitOnHex(state, hex.coord);
      return !occupant || occupant.side === unit.side;
    })
    .map((hex) => hex.coord);
};

export const executeNavalEvacuationTo = (state: GameState, unitId: string, targetCoord: HexCoord): GameState | null => {
  const unit = state.units.get(unitId);
  if (!unit) return null;
  const validTargets = calculateNavalEvacuationTargets(state, unit);
  if (!validTargets.some((coord) => sameCoord(coord, targetCoord))) return null;
  const card = state.factionCards[unit.side];
  const marker = card.eventsBox.find((id) => id.toLowerCase().includes("naval evacuation"));
  if (!marker) return null;

  const units = new Map(state.units);
  units.set(unit.id, {
    ...unit,
    position: targetCoord,
    reduced: true,
    strength: Math.min(unit.strength, Math.ceil(unit.maxStrength / 2)),
    activated: true,
    moved: true
  });
  const returnEntry = eventReturnEntry(state, unit.side, marker, rollD6());
  return addEventReturnEntries({
    ...state,
    units,
    factionCards: {
      ...state.factionCards,
      [unit.side]: { ...card, eventsBox: card.eventsBox.filter((id) => id !== marker) }
    },
    history: [
      {
        type: ActionType.MOVE,
        side: unit.side,
        unitId,
        fromPos: unit.position,
        toPos: targetCoord,
        note: `${unit.name} naval evacuation to ${hexCodeFor(targetCoord)}. ${marker} returns on turn ${returnEntry.returnTurn}.`,
        timestamp: new Date()
      },
      ...state.history
    ],
    timestamp: new Date()
  }, [returnEntry]);
};

export const resolveCombat = (
  state: GameState,
  attackerId: string,
  defenderId: string,
  options?: ResolveCombatOptions
): GameState => {
  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);
  if (!attacker || !defender || attacker.side === defender.side) return state;
  if (attacker.status === UnitStatus.DESTROYED || defender.status === UnitStatus.DESTROYED) return state;
  if (!options?.isAmphibious && hexDistance(attacker.position, defender.position) !== 1) return state;

  const attackType = options?.attackType ?? AttackType.MOBILE;
  // 5.3.1: Mobile non possibile vs fort, e vs hex Poor/Severe
  if (attackType === AttackType.MOBILE) {
    if (isFortHex(state, defender.position)) return state;
    if (state.weather === WeatherType.POOR || state.weather === WeatherType.SEVERE) return state;
  }
  // un solo Mobile o Assault per fase per unità (gestito a livello di hasMobileAttacked / activated)

  const additionalAttackers: Unit[] = (options?.additionalAttackerIds || [])
    .map((id) => state.units.get(id))
    .filter((u): u is Unit => Boolean(u && u.side === attacker.side && u.status !== UnitStatus.DESTROYED && hexDistance(u.position, defender.position) === 1))
    .slice(0, 2); // 5.3.3: max 2 Additional

  // 6.2.3 / 5.1 step 3: air support resolution
  let airSupportAttackerGets = false;
  let airSupportDefenderGets = false;
  let airCombatNote = "";
  let airUnitsToUpdate: Map<string, Unit> = new Map();
  const attackerNationalities = [attacker, ...additionalAttackers].map((u) => u.country || "");
  const airAtt = options?.airSupportAttackerId ? state.units.get(options.airSupportAttackerId) : undefined;
  const airDef = options?.airSupportDefenderId ? state.units.get(options.airSupportDefenderId) : undefined;
  const airAttValid = airAtt && isLegalAirSupporter(state, airAtt, defender, attackerNationalities) && airAtt.side === attacker.side;
  const airDefValid = airDef && isLegalAirSupporter(state, airDef, defender, attackerNationalities) && airDef.side === defender.side;
  const eventMarkerIds = options?.eventMarkerIds || [];
  const jetsCommitted = eventMarkerIds.some((id) => parseCombatEventMarker(id, Side.AXIS)?.kind === "jets");

  if (airAttValid && airDefValid && airAtt && airDef) {
    // Air combat → determina chi prende air support
    const aR = rollD6(), dR = rollD6();
    const jetsAtt = jetsCommitted && airAtt.side === Side.AXIS && airAtt.country === "Germany" ? 2 : 0;
    const jetsDef = jetsCommitted && airDef.side === Side.AXIS && airDef.country === "Germany" ? 2 : 0;
    const airPreview = getAirCombatPreview(state, airAtt, airDef, {
      attackerRoll: aR,
      defenderRoll: dR,
      attackerJets: jetsAtt > 0,
      defenderJets: jetsDef > 0
    });
    const aF = airPreview.attackerFinal;
    const dF = airPreview.defenderFinal;
    const airCrt = lookupAirCrtResult(aF, dF);
    const updated = applyAirCombatResult(airAtt, airDef, airCrt.code as CombatResultCode, airCrt.bonus);
    airUnitsToUpdate.set(airAtt.id, { ...updated.attacker, activated: true });
    airUnitsToUpdate.set(airDef.id, updated.defender);
    // Air Support determinazione (Player Aid Sheet, Air Combat Results, Step 2)
    switch (airCrt.code) {
      case CombatResultCode.NO_EFFECT:
      case CombatResultCode.DR:
      case CombatResultCode.AS:
        airSupportAttackerGets = true; airSupportDefenderGets = true; break;
      case CombatResultCode.DD:
      case CombatResultCode.DE:
        airSupportAttackerGets = true; airSupportDefenderGets = false; break;
      case CombatResultCode.AA:
        airSupportAttackerGets = false; airSupportDefenderGets = true; break;
    }
    airCombatNote = ` Air combat: Att. (${aR} ${airPreview.attackerModifier >= 0 ? "+" : "-"} ${Math.abs(airPreview.attackerModifier)}) vs Dif. (${dR} ${airPreview.defenderModifier >= 0 ? "+" : "-"} ${Math.abs(airPreview.defenderModifier)}) = ${aF} vs ${dF} → ${airCrt.code}+${airCrt.bonus}; ${airPreview.sortieEffect}; ${airPreview.supportEffect}.`;
  } else if (airAttValid && airAtt) {
    airSupportAttackerGets = true;
    airUnitsToUpdate.set(airAtt.id, {
      ...airAtt,
      sorties: Math.min(GAME_RULES.AIR.MAX_SORTIES, (airAtt.sorties || 0) + 1),
      activated: airAtt.id === FNA_AXIS_AIR_SUPPORT_ID ? false : true
    });
  } else if (airDefValid && airDef) {
    airSupportDefenderGets = true;
    airUnitsToUpdate.set(airDef.id, { ...airDef, sorties: Math.min(GAME_RULES.AIR.MAX_SORTIES, (airDef.sorties || 0) + 1) });
  }

  const drmA = computeAttackerDrm(state, attacker, additionalAttackers, defender, attackType, options?.isAmphibious);
  const drmD = computeDefenderDrm(state, defender);
  const committedEventIds = applyCombatEventDrm(
    state,
    eventMarkerIds,
    attacker,
    additionalAttackers,
    defender,
    drmA,
    drmD
  );
  const defenderKey = coordKey(defender.position);
  const partisansAffectDefender = Object.values(state.partisansMarkers || {}).some((keys) => keys?.includes(defenderKey));
  if (partisansAffectDefender) {
    drmD.eventSnafu -= 2;
    drmD.total = sumDrm(drmD);
  }
  const surpriseMarkers = state.surpriseAttackMarkers?.[attacker.side] || [];
  const surpriseAffectsAttack = surpriseMarkers.some((key) => {
    const [q, r] = key.split(",").map(Number);
    return hexDistance({ q, r }, defender.position) <= 2;
  });
  if (surpriseAffectsAttack && !committedEventIds.some((id) => id.toLowerCase().includes("surprise"))) {
    drmA.eventUltra += 1;
    drmA.total = sumDrm(drmA);
  }
  // 13.1: se un'unità nemica NELL'HEX del marker Airdrop viene attaccata, è il
  // DIFENSORE ad applicare un -2. Non è un bonus all'attaccante e non si estende
  // agli hex adiacenti.
  const airdropAffectsAttack = (state.airdropMarkers?.[attacker.side] || []).includes(defenderKey);
  if (airdropAffectsAttack) {
    drmD.eventSnafu -= 2;
    drmD.total = sumDrm(drmD);
  }

  // Applica DRM Air Support
  if (airSupportAttackerGets) {
    if (state.weather === WeatherType.FAIR) drmA.airSupportFair = 2;
    else if (state.weather === WeatherType.POOR) drmA.airSupportPoor = 1;
    drmA.total = sumDrm(drmA);
  }
  if (airSupportDefenderGets) {
    if (state.weather === WeatherType.FAIR) drmD.airSupportFair = 2;
    else if (state.weather === WeatherType.POOR) drmD.airSupportPoor = 1;
    drmD.total = sumDrm(drmD);
  }

  const attackerRoll = rollD6();
  const defenderRoll = rollD6();
  const attackerModified = Math.max(1, attackerRoll + Math.max(-10, Math.min(10, drmA.total)));
  const defenderModified = Math.max(1, defenderRoll + Math.max(-10, Math.min(10, drmD.total)));
  const attackerFinal = applyHalving(attackerModified, drmA);
  const defenderFinal = applyHalving(defenderModified, drmD);

  const crt = lookupGroundCrtResult(attackerFinal, defenderFinal);
  const outcome: CombatOutcome = {
    attackerFinal,
    defenderFinal,
    attackerRoll,
    defenderRoll,
    attackerDrm: drmA,
    defenderDrm: drmD,
    resultCode: crt.code as CombatResultCode
  };

  const next = applyCombatResult(state, attacker, additionalAttackers, defender, attackType, outcome, Boolean(options?.isAmphibious));

  // Mark Mobile attack flag (4.2.3.1: dopo Mobile attack, EZOC restrictions cambiano)
  const units = new Map(next.units);
  const updatedAttacker = units.get(attacker.id);
  if (updatedAttacker && attackType === AttackType.MOBILE && updatedAttacker.status !== UnitStatus.DESTROYED) {
    units.set(attacker.id, { ...updatedAttacker, hasMobileAttacked: true });
  }
  // Applica aggiornamenti unità aeree committed
  airUnitsToUpdate.forEach((u, id) => units.set(id, u));
  const fnaAxisAirCommitted = options?.airSupportAttackerId === FNA_AXIS_AIR_SUPPORT_ID || options?.airSupportDefenderId === FNA_AXIS_AIR_SUPPORT_ID;

  // Rimuovi marker Assault degli attaccanti coinvolti (5.3.3)
  if (attackType === AttackType.ASSAULT) {
    [attacker, ...additionalAttackers].forEach((u) => {
      const cur = units.get(u.id);
      if (cur) units.set(u.id, { ...cur, assaultTarget: undefined });
    });
  }

  const result: CasualtiesResult = {
    attackerLosses: outcome.resultCode === CombatResultCode.AA ? 1 : 0,
    defenderLosses: [CombatResultCode.DD, CombatResultCode.DE].includes(outcome.resultCode) ? 1 : 0,
    winner: [CombatResultCode.DR, CombatResultCode.DD, CombatResultCode.DE].includes(outcome.resultCode)
      ? attacker.side
      : [CombatResultCode.AS, CombatResultCode.AA].includes(outcome.resultCode)
        ? defender.side
        : "draw",
    moraleDamage: 0
  };

  // 5.3.6 + Player Aid "National Will Effects": -1 al country del difensore
  // ogni volta che una sua unità terrestre viene eliminata mentre difende.
  let factionCards = removeCommittedEvents(next.factionCards, committedEventIds);
  let nwNote = "";
  const finalDefender = units.get(defender.id);
  const defenderEliminatedNow = finalDefender?.status === UnitStatus.DESTROYED;
  const isGroundUnit = defender.type !== UnitType.AIR && defender.type !== UnitType.FORT;
  if (defenderEliminatedNow && isGroundUnit && defender.country) {
    const card = factionCards[defender.side];
    const currentWill = card.nationalWill[defender.country];
    if (typeof currentWill === "number") {
      const nextWill = Math.max(0, currentWill - 1);
      factionCards = {
        ...factionCards,
        [defender.side]: {
          ...card,
          nationalWill: { ...card.nationalWill, [defender.country]: nextWill }
        }
      };
      nwNote = ` ${defender.country} National Will -1 (now ${nextWill}).`;
    }
  }

  const committedEventReturns = committedEventIds.flatMap((id) => {
    const side = eventOwnerSide(state, id);
    return side ? [eventReturnEntry(state, side, id, combatEventReturnDelay(id))] : [];
  });
  const committedReturnNote = committedEventReturns.length
    ? ` Returns: ${committedEventReturns.map((entry) => `${entry.markerId} T${entry.returnTurn}`).join(", ")}.`
    : "";
  const isFnaInitialInvasionCombat = Boolean(options?.isAmphibious && canPerformFnaInitialInvasion(state, attacker, defender.position));

  const action: GameAction = {
    type: ActionType.ATTACK,
    side: attacker.side,
    unitId: attacker.id,
    targetUnitId: defender.id,
    fromPos: attacker.position,
    toPos: defender.position,
    note: `${isFnaInitialInvasionCombat ? "FNA initial amphibious invasion: " : ""}${attackType === AttackType.MOBILE ? "Mobile" : "Assault"} attack: Att. (${attackerRoll} ${drmA.total >= 0 ? "+" : "-"} ${Math.abs(drmA.total)}) vs Dif. (${defenderRoll} ${drmD.total >= 0 ? "+" : "-"} ${Math.abs(drmD.total)}) = ${attackerFinal} vs ${defenderFinal} → ${crt.code} - ${combatResultLongText(crt.code as CombatResultCode)}.${committedEventIds.length ? ` Events: ${committedEventIds.join(", ")}.` : ""}${committedReturnNote}${airCombatNote}${nwNote}`,
    result,
    timestamp: new Date()
  };

  const stateAfterSurprise = options?.isAmphibious && !isFnaInitialInvasionCombat
    ? markCentralMedInvasionUsed(consumeSurpriseMarkerForInvasion({ ...next, units, factionCards }, attacker.side, defender.position), attacker)
    : { ...next, units, factionCards };

  const finalState: GameState = addEventReturnEntries({
    ...stateAfterSurprise,
    fnaAxisAirSortiesUsed: fnaAxisAirCommitted ? (state.fnaAxisAirSortiesUsed || 0) + 1 : state.fnaAxisAirSortiesUsed,
    history: [action, ...next.history],
    timestamp: new Date()
  }, committedEventReturns);
  return checkCountryCollapses(collectEliminatedIntoBox(finalState));
};

const resetUnitActivations = (state: GameState): Map<string, Unit> => {
  const units = new Map<string, Unit>();

  state.units.forEach((unit, id) => {
    units.set(id, {
      ...unit,
      moved: false,
      movementSpent: 0,
      combat: false,
      activated: false,
      hasMobileAttacked: false,
      assaultTarget: undefined,
      improvedThisTurn: false, // 8.1: il limite di una replacement per turno si resetta
      strategicMove: false, // 4.1: marker rimosso a inizio nuovo turno
      morale: unit.status === UnitStatus.DESTROYED ? unit.morale : Math.min(10, unit.morale + GAME_RULES.MORALE.RALLY_RATE)
    });
  });

  return units;
};

const weatherFromRanges = (roll: number, fair: number[], poor: number[], severe: number[] = []): WeatherType => {
  if (fair.includes(roll)) return WeatherType.FAIR;
  if (poor.includes(roll)) return WeatherType.POOR;
  if (severe.includes(roll)) return WeatherType.SEVERE;
  return WeatherType.POOR;
};

export const weatherTableRowLabel = (state: GameState): string => {
  // Stessa etichetta usata dal Player Aid Sheet, es. "Apr (Mar Poor)".
  return weatherTableRowKey(state.turnCode, state.previousWeather || WeatherType.FAIR);
};

// Tabella Weather (10.0) trascritta dal Player Aid Sheet (Tabelle US.pdf, p.3).
// Ogni riga elenca i risultati del d6 per Fair / Poor / Severe. Un elenco vuoto
// corrisponde al trattino "–" sulla tabella cartacea, cioè "esito impossibile
// in questo mese": attenzione, diverse righe non hanno alcun risultato Fair.
type WeatherRow = { fair: number[]; poor: number[]; severe: number[] };

const W = (fair: number[], poor: number[], severe: number[] = []): WeatherRow => ({ fair, poor, severe });

const WEATHER_TABLE: Record<WeatherMapCategory, Record<string, WeatherRow>> = {
  [WeatherMapCategory.OTHER_MAPS]: {
    "Dec-Feb": W([], [1, 2, 3, 4], [5, 6]),
    Mar: W([1], [2, 3], [4, 5, 6]),
    "Apr (Mar Fair)": W([], [1, 2, 3], [4, 5, 6]),
    "Apr (Mar Poor)": W([1], [2, 3, 4], [5, 6]),
    "Apr (Mar Sev)": W([1], [2, 3, 4, 5], [6]),
    May: W([1, 2, 3], [4, 5, 6]),
    Jun: W([1, 2, 3, 4], [5, 6]),
    "Jul-Sep": W([1, 2, 3, 4, 5, 6], []),
    Oct: W([1, 2], [3, 4], [5, 6]),
    "Nov (Oct Fair)": W([], [1, 2, 3, 4], [5, 6]),
    "Nov (Oct Poor)": W([1, 2], [3, 4], [5, 6]),
    "Nov (Oct Sev)": W([1, 2], [3, 4, 5, 6])
  },
  [WeatherMapCategory.BALKANS_FNA_ITALY]: {
    "Dec-Feb": W([1], [2, 3, 4], [5, 6]),
    Mar: W([1, 2], [3, 4], [5, 6]),
    "Apr (Mar Fair)": W([1], [2, 3, 4], [5, 6]),
    "Apr (Mar Poor)": W([1, 2], [3, 4, 5], [6]),
    "Apr (Mar Sev)": W([1, 2], [3, 4, 5, 6]),
    May: W([1, 2, 3, 4], [5, 6]),
    Jun: W([1, 2, 3, 4], [5, 6]),
    "Jul-Sep": W([1, 2, 3, 4, 5, 6], []),
    Oct: W([1, 2], [3, 4, 5], [6]),
    "Nov (Oct Fair)": W([], [1, 2, 3, 4], [5, 6]),
    "Nov (Oct Poor)": W([1, 2], [3, 4, 5, 6]),
    "Nov (Oct Sev)": W([1, 2, 3], [4, 5, 6])
  }
};

// Chiave della riga di tabella: per Apr e Nov dipende dal meteo del mese precedente.
export const weatherTableRowKey = (turnCode: string, previousWeather: WeatherType): string => {
  const month = monthForTurnCode(turnCode);
  if (month === "Dec" || month === "Jan" || month === "Feb") return "Dec-Feb";
  if (month === "Jul" || month === "Aug" || month === "Sep") return "Jul-Sep";
  if (month === "Apr") {
    if (previousWeather === WeatherType.POOR) return "Apr (Mar Poor)";
    if (previousWeather === WeatherType.SEVERE) return "Apr (Mar Sev)";
    return "Apr (Mar Fair)";
  }
  if (month === "Nov") {
    if (previousWeather === WeatherType.POOR) return "Nov (Oct Poor)";
    if (previousWeather === WeatherType.SEVERE) return "Nov (Oct Sev)";
    return "Nov (Oct Fair)";
  }
  return month;
};

export const resolveWeatherRoll = (
  roll: number,
  turnCode: string,
  previousWeather: WeatherType = WeatherType.FAIR,
  mapCategory: WeatherMapCategory = WeatherMapCategory.OTHER_MAPS
): WeatherType => {
  const row = WEATHER_TABLE[mapCategory][weatherTableRowKey(turnCode, previousWeather)];
  if (!row) return WeatherType.FAIR;
  return weatherFromRanges(roll, row.fair, row.poor, row.severe);
};

const rollWeather = (state: GameState): { roll: number; weather: WeatherType } => {
  const roll = Math.floor(Math.random() * 6) + 1;

  // Scenari Russia: turno 1 (Jun-41) sempre FAIR per regola speciale
  if (isBarbarossa1941Scenario(state.scenarioId) && state.turn === 1) {
    return { roll, weather: WeatherType.FAIR };
  }

  // Scenari Russia: Dec-41 sempre SEVERE (Inverno Russo garantito)
  if (isBarbarossa1941Scenario(state.scenarioId) && state.turnCode === "Dec-41") {
    return { roll, weather: WeatherType.SEVERE };
  }

  return {
    roll,
    weather: resolveWeatherRoll(roll, state.turnCode, state.previousWeather || state.weather, state.weatherMap)
  };
};

const isFriendlyControlledProductionCenter = (hex: Hex, side: Side, country: string): boolean =>
  hex.features.country === country &&
  hex.features.productionCenter &&
  !hex.features.prohibited &&
  (hex.features.controller === undefined || hex.features.controller === side);

const countFriendlyProductionCenters = (state: GameState, side: Side, country: string): number =>
  Array.from(state.map.values()).filter((hex) => isFriendlyControlledProductionCenter(hex, side, country)).length;

const isCountryConquered = (state: GameState, side: Side, country: string): boolean =>
  state.factionCards[side].countryStatus?.[country] === "conquered";

export const economyProductionFor = (state: GameState, side: Side): Record<string, number | null> => {
  if (side === Side.AXIS) {
    if (state.scenarioId === "balkans1941") return { Bulgaria: null, Germany: null, Hungary: null, Italy: null, Romania: null };
    if (state.scenarioId === "france1944") return { Germany: 12 };
    if (state.scenarioId === "frenchNorthAfrica1942") return { Germany: null, "Fr.N.Africa": 2, Italy: null };
    if (isItaly1943Scenario(state.scenarioId)) {
      return {
        Germany: state.turnCode.endsWith("-44") && !["Jan-44", "Feb-44", "Mar-44", "Apr-44", "May-44"].includes(state.turnCode) ? 6 : null,
        Italy: state.scenarioId === "italy1943Include" ? 2 : 0
      };
    }
    if (state.scenarioId === "france1941") return { Germany: 22, Italy: null };
    if (isBarbarossa1941Scenario(state.scenarioId)) {
      // Produzione fissa per turno (indipendente dai PP correnti nella carta)
      if (state.scenarioId === "russia19411944") {
        const germanyPP = state.turnCode >= "Jan-43" ? 9 : state.turnCode >= "Jan-42" ? 11 : 13;
        return { Germany: germanyPP, Romania: 2, Finland: 1, Hungary: 1, Italy: 1 };
      }
      // barbarossa1941
      return { Germany: 12, Romania: 2, Finland: 1, Hungary: 1 };
    }
    return { Germany: null }; // NA in France 1940
  }

  if (state.scenarioId === "balkans1941") {
    return {
      Greece: isCountryConquered(state, Side.ALLIED, "Greece") ? 0 : 1,
      UK: null,
      Yugoslavia: isCountryConquered(state, Side.ALLIED, "Yugoslavia") ? 0 : 2
    };
  }

  if (state.scenarioId === "france1944") return { UK: null, USA: null };
  if (state.scenarioId === "frenchNorthAfrica1942") return { UK: null, USA: null };
  if (isItaly1943Scenario(state.scenarioId)) return { UK: state.turnCode.endsWith("-44") && !["Jan-44", "Feb-44", "Mar-44", "Apr-44", "May-44"].includes(state.turnCode) ? 6 : null, USA: null };

  if (isBarbarossa1941Scenario(state.scenarioId)) {
    return { USSR: 15 };
  }

  const franceFactories = countFriendlyProductionCenters(state, Side.ALLIED, "France");
  const franceBaseProduction = state.scenarioId === "france1941" ? 11 : 7;

  return {
    France: isCountryConquered(state, Side.ALLIED, "France") ? 0 : franceBaseProduction + franceFactories * 2,
    UK: null,
    Belgium: isCountryConquered(state, Side.ALLIED, "Belgium") ? 0 : 1,
    Netherlands: isCountryConquered(state, Side.ALLIED, "Netherlands") ? 0 : 1
  };
};

const formatPP = (value: number | null): string => (value === null ? "NA" : String(value));

const economyNoteFor = (state: GameState, side: Side, production: Record<string, number | null>): string => {
  if (side === Side.AXIS) {
    if (state.scenarioId === "balkans1941") return "Axis economy: Bulgaria, Germany, Hungary, Italy, and Romania NA.";
    if (state.scenarioId === "france1944") return `Axis economy: Germany ${formatPP(production.Germany)} PP after strategic warfare reduction.`;
    if (state.scenarioId === "frenchNorthAfrica1942") return `Axis economy: Germany NA, Italy NA, French North Africa ${formatPP(production["Fr.N.Africa"])} PP.`;
    if (isItaly1943Scenario(state.scenarioId)) return `Axis economy: Germany ${formatPP(production.Germany)} PP, Italy ${formatPP(production.Italy)}.`;
    if (state.scenarioId === "france1941") return `Axis economy: Germany ${formatPP(production.Germany)} PP, Italy NA.`;
    if (isBarbarossa1941Scenario(state.scenarioId)) {
      const parts = Object.entries(production).map(([c, v]) => `${c} ${formatPP(v)} PP`).join(", ");
      return `Axis economy: ${parts}.`;
    }
    return "Axis economy: Germany NA (unlimited PP).";
  }
  if (state.scenarioId === "balkans1941") return `Western economy: Greece ${formatPP(production.Greece)} PP, Yugoslavia ${formatPP(production.Yugoslavia)} PP, UK NA.`;
  if (state.scenarioId === "france1944") return "Allied economy: UK NA, USA NA.";
  if (state.scenarioId === "frenchNorthAfrica1942") return "Allied economy: UK NA, USA NA.";
  if (isItaly1943Scenario(state.scenarioId)) return `Allied economy: UK ${formatPP(production.UK)} PP, USA NA.`;
  if (isBarbarossa1941Scenario(state.scenarioId)) {
    const parts = Object.entries(production).map(([c, v]) => `${c} ${formatPP(v)} PP`).join(", ");
    return `Soviet economy: ${parts}.`;
  }
  const franceFactories = countFriendlyProductionCenters(state, Side.ALLIED, "France");
  const franceBaseProduction = state.scenarioId === "france1941" ? 11 : 7;
  return `Allied economy: France ${formatPP(production.France)} PP (${franceBaseProduction} base + ${franceFactories} factories x2), Belgium ${formatPP(production.Belgium)}, Netherlands ${formatPP(production.Netherlands)}, UK NA. Unspent PP from previous turn lost.`;
};

// 9.0: Use-it-or-lose-it per tutti gli scenari.
const resolveEconomyStep = (state: GameState, side: Side): { factionCards: GameState["factionCards"]; note: string } => {
  const production = economyProductionFor(state, side);
  let noteSuffix = "";
  if (state.scenarioId === "france1944" && side === Side.AXIS && production.Germany !== null) {
    const roll = Math.floor(Math.random() * 6) + 1;
    production.Germany = Math.max(0, production.Germany - roll);
    noteSuffix = ` Strategic warfare die roll ${roll}.`;
  }
  const card = state.factionCards[side];

  // Use-it-or-lose-it: sostituisce i PP del paese con la produzione del turno
  const newProductionPoints: Record<string, number | null> = { ...card.productionPoints, ...production };

  return {
    factionCards: {
      ...state.factionCards,
      [side]: {
        ...card,
        productionPoints: newProductionPoints
      }
    },
    note: `${economyNoteFor(state, side, production)}${noteSuffix}`
  };
};

export const canUseOperationalActions = (state: GameState): boolean =>
  state.phase === GamePhase.OPERATIONS && state.subPhase === GameSubPhase.ACTIONS;

const removeTemporaryMapEventsAtEndOfActions = (state: GameState, side: Side): { state: GameState; notes: string[] } => {
  const details = state.mapEventMarkerDetails || [];
  const expiring = details.filter(
    (detail) => detail.side === side && (detail.kind === "airdrop" || detail.kind === "partisans" || detail.kind === "surprise")
  );
  if (expiring.length === 0) return { state, notes: [] };

  const expiringCoords = {
    airdrop: new Set(expiring.filter((detail) => detail.kind === "airdrop").map((detail) => detail.coordKey)),
    partisans: new Set(expiring.filter((detail) => detail.kind === "partisans").map((detail) => detail.coordKey)),
    surprise: new Set(expiring.filter((detail) => detail.kind === "surprise").map((detail) => detail.coordKey))
  };

  const returnEntries = expiring.flatMap((detail) => {
    if (detail.kind === "surprise") {
      // 13.9: alla rimozione, un marker USA torna 4 turni dopo; quelli tedesco e
      // britannico sono rimossi dallo scenario.
      return detail.markerId.toLowerCase().includes("usa")
        ? [eventReturnEntry(state, detail.side, detail.markerId, 4)]
        : [];
    }
    if (detail.kind === "airdrop") {
      // 13.1: alla rimozione si tira un d6. Con 1-5 il marker torna dopo quel
      // numero di turni; con 6 è rimosso dallo scenario (disastri tipo Creta).
      const roll = rollD6();
      return roll <= 5 ? [eventReturnEntry(state, detail.side, detail.markerId, roll)] : [];
    }
    return [eventReturnEntry(state, detail.side, detail.markerId, rollD6())];
  });

  const notes = returnEntries.map((entry) => `${entry.markerId} ritorna al turno ${entry.returnTurn}`);
  const next: GameState = {
    ...state,
    airdropMarkers: {
      ...state.airdropMarkers,
      [side]: (state.airdropMarkers?.[side] || []).filter((key) => !expiringCoords.airdrop.has(key))
    },
    partisansMarkers: {
      ...state.partisansMarkers,
      [side]: (state.partisansMarkers?.[side] || []).filter((key) => !expiringCoords.partisans.has(key))
    },
    surpriseAttackMarkers: {
      ...state.surpriseAttackMarkers,
      [side]: (state.surpriseAttackMarkers?.[side] || []).filter((key) => !expiringCoords.surprise.has(key))
    },
    mapEventMarkerDetails: details.filter((detail) => !expiring.includes(detail))
  };
  return { state: addEventReturnEntries(next, returnEntries), notes };
};

export const canCommandUnit = (state: GameState, unit: Unit): boolean => {
  if (
    isFna1942Scenario(state.scenarioId) &&
    state.turn === 1 &&
    unit.id === "germany_5_pz"
  ) {
    return false;
  }
  // Include-Italy T1: Axis units set up in a port cannot move in the first Axis Operations phase
  if (
    state.scenarioId === "italy1943Include" &&
    state.turn === 1 &&
    unit.side === Side.AXIS &&
    state.phase === GamePhase.OPERATIONS &&
    state.subPhase === GameSubPhase.ACTIONS
  ) {
    const hex = state.map.get(coordKey(unit.position));
    if (hex && hex.features.port) return false;
  }
  if (
    fnaInitialInvasionsPending(state) &&
    state.currentSide === Side.ALLIED &&
    state.phase === GamePhase.OPERATIONS &&
    state.subPhase === GameSubPhase.ACTIONS
  ) {
    const completed = new Set(fnaInitialInvasionRecords(state).map((action) => action.unitId));
    if (!isFnaInitialInvasionUnit(unit) || completed.has(unit.id)) return false;
  }
  // Soviet Counterattack: l'URSS può attivare una propria unità durante le Operazioni Asse
  const commandableSide = state.sovietCounterattackActive ? Side.ALLIED : state.currentSide;
  return (
    canUseOperationalActions(state) &&
    unit.side === commandableSide &&
    unit.type !== UnitType.FORT &&
    unit.status !== UnitStatus.DESTROYED &&
    !unit.activated && // 6.3: un'unità può attivarsi una sola volta per fase
    !unit.strategicMove
  ); // 4.1.2
};

export const sequenceStepLabel = (state: GameState): string => {
  const side = state.currentSide === Side.AXIS ? "Asse" : "Alleati";
  if (state.phase === GamePhase.WEATHER) return "Tiro Meteo";
  if (state.phase === GamePhase.ECONOMY) return "Fine Economia";
  if (state.phase === GamePhase.STRATEGIC_MOVEMENT) return `Fine Movimento Strategico ${side}`;
  if (state.phase === GamePhase.OPERATIONS && state.subPhase === GameSubPhase.ACTIONS) return `Fine Azioni ${side}`;
  if (state.phase === GamePhase.OPERATIONS && state.subPhase === GameSubPhase.SUPPLY_CHECK) return `Fine Rifornimento ${side}`;
  if (state.phase === GamePhase.NO_SUPPLY) return `Fine No Supply ${side}`;
  if (state.phase === GamePhase.REPLACEMENTS) return `Fine Rimpiazzi ${side}`;
  if (state.phase === GamePhase.MOBILIZATION) return `Fine Mobilitazione ${side}`;
  if (state.phase === GamePhase.VICTORY_CHECK) return "Controllo Vittoria";
  if (state.phase === GamePhase.END_TURN) return "Fine Turno";
  return "Prossimo Passo";
};

export const sequenceStepDescription = (state: GameState): string => {
  const side = state.currentSide === Side.AXIS ? "Asse" : "Alleati";
  if (state.phase === GamePhase.WEATHER) return `Tira il dado sulla tabella meteo ${weatherTableRowLabel(state)} della Faction Card.`;
  if (state.phase === GamePhase.ECONOMY) return `Economia ${side}: produzione, risorse e dichiarazioni.`;
  if (state.phase === GamePhase.STRATEGIC_MOVEMENT) return `Movimento strategico ${side}: redeployment su ferrovia/linee strategiche.`;
  if (state.phase === GamePhase.OPERATIONS && state.subPhase === GameSubPhase.ACTIONS) {
    return `Operazioni ${side}: seleziona le unità sulla mappa per muovere o attaccare.`;
  }
  if (state.phase === GamePhase.OPERATIONS && state.subPhase === GameSubPhase.SUPPLY_CHECK) {
    return `Rifornimento ${side}: controllo linee di rifornimento e isolamento.`;
  }
  if (state.phase === GamePhase.NO_SUPPLY) return `No Supply ${side}: verifica gli effetti sulle unità non rifornite.`;
  if (state.phase === GamePhase.REPLACEMENTS) return `Rimpiazzi ${side}: ricostruzione, flip e recupero sortite.`;
  if (state.phase === GamePhase.MOBILIZATION) return `Mobilitazione ${side}: entrata di nuove unità e rinforzi.`;
  if (state.phase === GamePhase.VICTORY_CHECK) return "Controllo delle condizioni di vittoria dello scenario.";
  if (state.phase === GamePhase.END_TURN) return "Chiudi il turno, resetta le attivazioni e passa al mese successivo.";
  return "Avanza al passo successivo della procedura.";
};

export const advanceSequenceStep = (state: GameState): GameState => {
  let next: Partial<GameState> = {};
  let units = state.units;
  let note = sequenceStepDescription(state);

  if (state.phase === GamePhase.WEATHER) {
    const weatherResult = rollWeather(state);
    const weatherState = { ...state, previousWeather: state.weather, weather: weatherResult.weather, weatherRoll: weatherResult.roll };
    const axisEconomy = resolveEconomyStep(weatherState, Side.AXIS);
    const alliedEconomy = resolveEconomyStep({ ...weatherState, factionCards: axisEconomy.factionCards }, Side.ALLIED);
    const econNote = `${axisEconomy.note} ${alliedEconomy.note}`;
    if (state.scenarioId === "balkans1941") {
      next = { previousWeather: state.weather, weather: weatherResult.weather, weatherRoll: weatherResult.roll, phase: GamePhase.OPERATIONS, subPhase: GameSubPhase.ACTIONS, currentSide: Side.AXIS, factionCards: alliedEconomy.factionCards };
      note = `Weather roll ${weatherResult.roll}: ${weatherResult.weather}. ${econNote} Balkans 1941: Axis operations begin.`;
    } else {
      next = { previousWeather: state.weather, weather: weatherResult.weather, weatherRoll: weatherResult.roll, phase: GamePhase.ECONOMY, subPhase: GameSubPhase.FACTION_STEP, currentSide: Side.AXIS, factionCards: alliedEconomy.factionCards };
      note = `Weather roll ${weatherResult.roll}: ${weatherResult.weather}. ${econNote}`;
    }
  } else if (state.phase === GamePhase.ECONOMY) {
    if (state.scenarioId === "balkans1941") {
      next = { phase: GamePhase.OPERATIONS, subPhase: GameSubPhase.ACTIONS, currentSide: Side.AXIS };
      note = "Axis operations begin.";
    } else {
      next = { phase: GamePhase.STRATEGIC_MOVEMENT, currentSide: Side.AXIS };
      note = "Axis strategic movement begins.";
    }
  } else if (state.phase === GamePhase.STRATEGIC_MOVEMENT && state.currentSide === Side.AXIS) {
    next = { currentSide: Side.ALLIED };
    note = "Axis strategic movement ended. Allied strategic movement begins.";
  } else if (state.phase === GamePhase.STRATEGIC_MOVEMENT) {
    next = { phase: GamePhase.OPERATIONS, subPhase: GameSubPhase.ACTIONS, currentSide: Side.AXIS };
    note = "Allied strategic movement ended. Axis operations are now active.";
    // Blitzkrieg: attiva movimento doppio Panzer al turno 1 di Barbarossa
    if (isBarbarossa1941Scenario(state.scenarioId) && state.turn === 1) {
      const blitzCard = state.factionCards[Side.AXIS];
      const blitzMarker = blitzCard.eventsBox.find((id) => id.toLowerCase().includes("blitzkrieg"));
      if (blitzMarker) {
        next.blitzkriegActive = true;
        next.factionCards = {
          ...state.factionCards,
          [Side.AXIS]: { ...blitzCard, eventsBox: blitzCard.eventsBox.filter((id) => id !== blitzMarker) }
        };
        note += " Blitzkrieg attivo: i Panzer tedeschi hanno movimento doppio.";
      }
    }
  } else if (state.phase === GamePhase.OPERATIONS && state.subPhase === GameSubPhase.ACTIONS) {
    const clearedEvents = removeTemporaryMapEventsAtEndOfActions(state, state.currentSide);
    state = clearedEvents.state;
    // Blitzkrieg: disattiva alla fine delle Operazioni Asse (solo al termine delle prime ops di Jun-41)
    const blitzWasActive = state.blitzkriegActive && state.currentSide === Side.AXIS;
    next = { subPhase: GameSubPhase.SUPPLY_CHECK, blitzkriegActive: blitzWasActive ? false : state.blitzkriegActive };
    note = `${state.currentSide} operations ended. ${state.currentSide} supply check begins.`;
    if (blitzWasActive) note += " Blitzkrieg terminato.";
    if (clearedEvents.notes.length > 0) note = `${note} ${clearedEvents.notes.join("; ")}.`;
    const franceAirEvent = applyFranceAirReinforcementEvent(state);
    units = franceAirEvent.units;
    if (franceAirEvent.note) note = `${note} ${franceAirEvent.note}`;
  } else if (state.phase === GamePhase.OPERATIONS && state.subPhase === GameSubPhase.SUPPLY_CHECK && state.currentSide === Side.AXIS) {
    next = { subPhase: GameSubPhase.ACTIONS, currentSide: Side.ALLIED };
    note = "Axis supply check ended. Allied operations are now active.";
  } else if (state.phase === GamePhase.OPERATIONS && state.subPhase === GameSubPhase.SUPPLY_CHECK) {
    next = { phase: GamePhase.NO_SUPPLY, subPhase: GameSubPhase.FACTION_STEP, currentSide: Side.AXIS };
    note = "Allied supply check ended. Axis no-supply step begins.";
  } else if (state.phase === GamePhase.NO_SUPPLY && state.currentSide === Side.AXIS) {
    next = { currentSide: Side.ALLIED };
    note = "Axis no-supply step ended. Allied no-supply step begins.";
  } else if (state.phase === GamePhase.NO_SUPPLY) {
    next = { phase: GamePhase.REPLACEMENTS, currentSide: Side.AXIS };
    note = "Allied no-supply step ended. Axis replacements begin.";
  } else if (state.phase === GamePhase.REPLACEMENTS && state.currentSide === Side.AXIS) {
    next = { currentSide: Side.ALLIED };
    note = "Axis replacements ended. Allied replacements begin.";
  } else if (state.phase === GamePhase.REPLACEMENTS) {
    next = { phase: GamePhase.MOBILIZATION, currentSide: Side.AXIS };
    note = "Allied replacements ended. Axis mobilization begins.";
  } else if (state.phase === GamePhase.MOBILIZATION && state.currentSide === Side.AXIS) {
    next = { currentSide: Side.ALLIED };
    note = "Axis mobilization ended. Allied mobilization begins.";
  } else if (state.phase === GamePhase.MOBILIZATION) {
    next = { phase: GamePhase.VICTORY_CHECK, subPhase: GameSubPhase.CHECK, currentSide: Side.AXIS };
    note = "Allied mobilization ended. Victory check begins.";
  } else if (state.phase === GamePhase.VICTORY_CHECK) {
    next = { phase: GamePhase.END_TURN, subPhase: GameSubPhase.NONE };
    note = "Victory check ended. Ready to close the turn.";
  } else {
    const nextTurn = state.turn + 1;
    const scenarioDefinition = scenarioById(state.scenarioId);
    const nextTurnCode = turnCodeForScenario(nextTurn, scenarioDefinition);
    units = resetUnitActivations(state);
    // 11.2 step 2: prima collezioniamo eventuali unità distrutte rimaste fuori dalle box
    // (può capitare con stati legacy salvati prima dell'introduzione del tracking),
    // poi promuoviamo eliminatedBox → mobilizationBox.
    const collectedFactionCards = (() => {
      const tempState: GameState = { ...state, units };
      const collected = collectEliminatedIntoBox(tempState);
      return collected.factionCards;
    })();
    next = {
      turn: nextTurn,
      turnCode: nextTurnCode,
      phase: GamePhase.WEATHER,
      subPhase: GameSubPhase.WEATHER_ROLL,
      currentSide: Side.AXIS,
      weatherRoll: undefined,
      strategicMoveUsed: {},
      centralMedInvasionUsed: {},
      fnaAxisAirSortiesUsed: 0,
      factionCards: promoteEliminatedFactionCards(collectedFactionCards)
    };
    note = `${state.turnCode} ended. ${nextTurnCode} begins with weather. Eliminated units moved to Mobilization box.`;
  }

  const action: GameAction = {
    type: ActionType.HOLD,
    side: next.currentSide || state.currentSide,
    note,
    timestamp: new Date()
  };

  let result: GameState = {
    ...state,
    ...next,
    units,
    history: [action, ...state.history],
    timestamp: new Date()
  };

  if (result.phase === GamePhase.WEATHER) {
    const processed = processEventReturns(result);
    result = processed.state;
    if (processed.returned.length > 0) {
      result = {
        ...result,
        history: [
          {
            type: ActionType.HOLD,
            side: result.currentSide,
            note: `Event markers returned to Events box: ${processed.returned.join(", ")}.`,
            timestamp: new Date()
          },
          ...result.history
        ]
      };
    }
    const scheduledMobilization = applyScenarioMobilizationSchedule(result);
    result = scheduledMobilization.state;
    if (scheduledMobilization.notes.length > 0) {
      result = {
        ...result,
        history: [
          {
            type: ActionType.HOLD,
            side: result.currentSide,
            note: scheduledMobilization.notes.join("; ") + ".",
            timestamp: new Date()
          },
          ...result.history
        ]
      };
    }
  }

  // 7.2: appena entriamo in Operations / SUPPLY_CHECK eseguiamo il supply check per il side corrente
  if (result.phase === GamePhase.OPERATIONS && result.subPhase === GameSubPhase.SUPPLY_CHECK) {
    result = performSupplyCheck(result, result.currentSide);
  }
  // 7.5: appena entriamo in NO_SUPPLY per un side, eseguiamo l'attrition automatica
  if (result.phase === GamePhase.NO_SUPPLY) {
    result = performNoSupplyPhase(result, result.currentSide);
  }

  // 8.2: appena entriamo in MOBILIZATION recuperiamo unità DESTROYED orfane
  // (es. stati salvati legacy in cui collectEliminatedIntoBox non era ancora stato chiamato).
  // Le mettiamo direttamente in mobilizationBox così il giocatore può rispenderle subito.
  if (result.phase === GamePhase.MOBILIZATION) {
    const collected = collectEliminatedIntoBox(result);
    result = { ...collected, factionCards: promoteEliminatedFactionCards(collected.factionCards) };
  }

  if (result.phase === GamePhase.REPLACEMENTS && isFna1942Scenario(result.scenarioId)) {
    const fnaAir = result.units.get(FNA_AXIS_AIR_SUPPORT_ID);
    if (fnaAir) {
      const replacementUnits = new Map(result.units);
      replacementUnits.set(FNA_AXIS_AIR_SUPPORT_ID, { ...fnaAir, sorties: 4, activated: false });
      result = { ...result, units: replacementUnits };
    }
  }

  // 11.1 / 12.1: ad ogni passo della sequenza ricontrolliamo collapse + vittoria.
  // checkCountryCollapses chiama internamente evaluateVictory.
  result = checkCountryCollapses(result);

  return result;
};

// 4.2.3.3 — costo MP per attaccare (Mobile attack o designare Assault) un hex adiacente
// Player Aid Sheet: include il costo terreno + hexside + weather modifier
export const attackMovementCost = (state: GameState, attacker: Unit, target: HexCoord): number => {
  const targetHex = state.map.get(coordKey(target));
  if (!targetHex) return Infinity;
  if (targetHex.features.fadedDot || targetHex.features.prohibited) return Infinity;
  const crossing = edgeKey(attacker.position, target);
  if (state.impassableEdges.has(crossing)) return Infinity;
  // 4.2.3.3: si paga il costo pieno del terreno del difensore (mai il beneficio
  // ferrovia, 4.2.3.4) più il costo addizionale di attacco legato al meteo.
  const baseCost = baseGroundMovementCost(state, targetHex, attacker.side);
  const hexsideCost = hexsideCrossingCost(state, crossing);
  const weatherCost = state.weather === WeatherType.FAIR ? 1 : (state.weather === WeatherType.POOR || state.weather === WeatherType.SEVERE) ? 2 : 0;
  return baseCost + hexsideCost + weatherCost;
};

// 5.3.3: Designare un Assault durante l'attivazione di una ground unit
export const designateAssault = (state: GameState, unitId: string, target: HexCoord): GameState | null => {
  const unit = state.units.get(unitId);
  if (!unit || !canCommandUnit(state, unit)) return null;
  if (unit.type === UnitType.AIR || unit.type === UnitType.FORT) return null;
  if (unit.hasMobileAttacked) return null; // 5.3.1: non può Assault se già fatto Mobile
  if (hexDistance(unit.position, target) !== 1) return null;
  const targetUnit = getUnitOnHex(state, target);
  if (!targetUnit || targetUnit.side === unit.side) return null;

  const cost = attackMovementCost(state, unit, target);
  const remaining = movementRemainingFor(unit, state);
  if (cost > remaining) return null;

  const units = new Map(state.units);
  units.set(unitId, {
    ...unit,
    movementSpent: (unit.movementSpent || 0) + cost,
    assaultTarget: target,
    moved: true,
    activated: true // 5.3.3: piazzando Assault l'attivazione termina
  });

  const action: GameAction = {
    type: ActionType.DESIGNATE_ASSAULT,
    side: unit.side,
    unitId,
    toPos: target,
    note: `${unit.name} designates Assault on ${hexCodeFor(target)}.`,
    timestamp: new Date()
  };

  return occupyFriendlyFortIfEligible({
    ...state,
    units,
    history: [action, ...state.history],
    timestamp: new Date()
  }, unitId);
};

// 5.3.6: rimuove tutti i No EZOC markers (a fine attivazione dell'unità mossa)
const clearNoEzocMarkers = (state: GameState): GameState => {
  let changed = false;
  const map = new Map(state.map);
  state.map.forEach((hex, key) => {
    if (hex.noEzocMarker) {
      map.set(key, { ...hex, noEzocMarker: false });
      changed = true;
    }
  });
  return changed ? { ...state, map } : state;
};

// Termina volontariamente l'attivazione (utile in EZOC dopo movimento)
export const endUnitActivation = (state: GameState, unitId: string): GameState => {
  const unit = state.units.get(unitId);
  if (!unit) return state;
  const units = new Map(state.units);
  units.set(unitId, { ...unit, activated: true, moved: true });
  return occupyFriendlyFortIfEligible(clearNoEzocMarkers({ ...state, units, timestamp: new Date() }), unitId);
};

// 5.3.2: Mobile attack iniziato durante movimento — paga il costo MP, poi resolveCombat
export const initiateMobileAttack = (state: GameState, attackerId: string, defenderId: string): GameState | null => {
  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);
  if (!attacker || !defender || !canCommandUnit(state, attacker)) return null;
  if (attacker.assaultTarget) return null; // 5.3.1: non può Mobile + Assault
  if (hexDistance(attacker.position, defender.position) !== 1) return null;
  if (state.weather === WeatherType.POOR || state.weather === WeatherType.SEVERE) return null;
  if (isFortHex(state, defender.position)) return null;

  const cost = attackMovementCost(state, attacker, defender.position);
  const remaining = movementRemainingFor(attacker, state);
  if (cost > remaining) return null;

  // Pay MP cost first (4.2.1)
  const units = new Map(state.units);
  units.set(attackerId, { ...attacker, movementSpent: (attacker.movementSpent || 0) + cost });
  const stateAfterPayment = { ...state, units };

  // 6.2.3 / 5.1 step 2: prima del combat, prompt Will Commit per air units.
  return prepareCombat(stateAfterPayment, attackerId, defenderId, { attackType: AttackType.MOBILE });
};

// 5.3.3: Risolvi tutti gli Assault designati contro un hex (1-3 attaccanti)
export const resolveDesignatedAssault = (state: GameState, defenderHex: HexCoord, primaryAttackerId: string): GameState | null => {
  const primary = state.units.get(primaryAttackerId);
  if (!primary || primary.side !== state.currentSide) return null;
  if (!sameCoord(primary.assaultTarget || { q: NaN, r: NaN }, defenderHex)) return null;
  const defender = getUnitOnHex(state, defenderHex);
  // 5.3.3: l'hex potrebbe non avere più difensore (rimosso da altri combat / retreat)
  if (!defender) {
    // Rimuovi marker; opzionalmente advance (TODO: scelta giocatore)
    const units = new Map(state.units);
    units.set(primary.id, { ...primary, assaultTarget: undefined, activated: true });
    const action: GameAction = {
      type: ActionType.HOLD,
      side: primary.side,
      unitId: primary.id,
      note: `Assault on ${hexCodeFor(defenderHex)} found no defender; marker removed.`,
      timestamp: new Date()
    };
    return { ...state, units, history: [action, ...state.history], timestamp: new Date() };
  }
  if (defender.side === primary.side) return null;

  // Trova additional attackers (max 2): unità della stessa fazione con assaultTarget == defenderHex e adiacenti
  const additionalIds = Array.from(state.units.values())
    .filter((u) =>
      u.id !== primary.id &&
      u.side === primary.side &&
      u.status !== UnitStatus.DESTROYED &&
      sameCoord(u.assaultTarget || { q: NaN, r: NaN }, defenderHex) &&
      hexDistance(u.position, defenderHex) === 1
    )
    .slice(0, 2)
    .map((u) => u.id);

  return prepareCombat(state, primary.id, defender.id, {
    attackType: AttackType.ASSAULT,
    additionalAttackerIds: additionalIds
  });
};

// ============ 6.2 AIR ACTIONS ============

const isFriendlyCity = (hex: Hex, side: Side): boolean =>
  (hex.features.city || hex.features.capital) &&
  (hex.features.controller === undefined || hex.features.controller === side);

const isWithinGreatBritainAirRebaseZone = (state: GameState, coord: HexCoord): boolean => {
  const greatBritainHexes = Array.from(state.map.values()).filter((hex) => hex.features.country === "UK");
  return greatBritainHexes.some((hex) => sameCoord(hex.coord, coord) || hexDistance(hex.coord, coord) <= 3);
};

const respectsFrance1940AirRebaseRestriction = (state: GameState, unit: Unit, coord: HexCoord): boolean => {
  if (unit.country !== "UK") return true;
  if (state.scenarioId !== "france1940" && state.scenarioId !== "france1941") return true;
  return isWithinGreatBritainAirRebaseZone(state, coord);
};

export const explainAirRebaseEndHex = (state: GameState, coord: HexCoord, unit: Unit): string[] => {
  const reasons: string[] = [];
  const hex = state.map.get(coordKey(coord));
  if (!hex) return ["hex inesistente sulla mappa"];
  if (hex.features.prohibited) reasons.push("esagono proibito");
  if (!respectsFrance1940AirRebaseRestriction(state, unit, coord)) reasons.push("vincolo scenario UK non rispettato");

  const occupant = getUnitOnHex(state, coord);
  const ezoc = isEnemyZoc(state, coord, unit.side);
  const friendlySupport = isFriendlyCity(hex, unit.side) || isFortHex(state, coord) || Boolean(occupant && occupant.side === unit.side);
  if (ezoc && !friendlySupport) reasons.push("EZOC senza citta/fort/unita amica");
  if (occupant && occupant.side !== unit.side) reasons.push("unita nemica presente");
  if (hex.features.controller !== undefined && hex.features.controller !== unit.side && hex.features.controller !== "neutral" && (hex.features.city || hex.features.capital)) {
    reasons.push(`citta nemica (${hex.features.controller})`);
  }
  if (Object.values(state.airdropMarkers || {}).some((keys) => keys?.includes(coordKey(coord)))) reasons.push("marker Airdrop presente");
  if (Object.values(state.partisansMarkers || {}).some((keys) => keys?.includes(coordKey(coord)))) reasons.push("marker Partisans presente");

  const legalEnd = isFriendlyCity(hex, unit.side) || ((hex.railEdges || []).length > 0 && (!occupant || occupant.side === unit.side));
  if (!legalEnd) reasons.push("non e una citta amica ne un esagono con transport line valido");
  return reasons;
};

// 6.2.1 Air Rebase: end-position requisiti — friendly city OR hex con Transport Line e nessun nemico/marker
const isLegalAirEndHex = (state: GameState, coord: HexCoord, unit: Unit): boolean => {
  const hex = state.map.get(coordKey(coord));
  if (!hex) return false;
  if (hex.features.prohibited) return false;
  if (!respectsFrance1940AirRebaseRestriction(state, unit, coord)) return false;
  if (isFriendlyCity(hex, unit.side)) return true;
  // hex con Transport Line e no enemy unit
  if (!hexHasTransportLine(hex)) return false;
  const occ = getUnitOnHex(state, coord);
  if (occ && occ.side !== unit.side) return false;
  return true;
};

// 4.2.2 Air movement: ogni hex costa 1 MP. Faded Dot OK; prohibited per scenario; no water (in realtà air può sorvolare acqua)
const isAirMoveTransitLegal = (state: GameState, coord: HexCoord): boolean => {
  const hex = state.map.get(coordKey(coord));
  if (!hex) return false;
  if (hex.features.prohibited) return false;
  return true; // air può sorvolare tutto, inclusi water/faded dot
};

export const calculateAirReachableHexes = (state: GameState, unit: Unit): HexCoord[] => {
  if (unit.type !== UnitType.AIR) return [];
  if (isWesternMedUnit(unit)) return [];
  if (sortiesFor(unit) >= GAME_RULES.AIR.MAX_SORTIES) return [];
  if (isCentralMedUnit(unit) || isEastNaUnit(unit)) {
    return Array.from(state.map.values())
      .filter((hex) => isLegalAirEndHex(state, hex.coord, unit))
      .map((hex) => hex.coord);
  }
  const allowance = movementAllowanceFor(unit, state);
  // BFS con costo 1 per hex
  const start = unit.position;
  const distances = new Map<string, number>([[coordKey(start), 0]]);
  const frontier: HexCoord[] = [start];
  const result: HexCoord[] = [];
  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;
    const cd = distances.get(coordKey(current)) || 0;
    if (cd >= allowance) continue;
    HEX_SIDES.forEach((side) => {
      const next = neighborForSide(current, side);
      const key = coordKey(next);
      if (distances.has(key)) return;
      if (!isInsideMap(state, next)) return;
      if (!isAirMoveTransitLegal(state, next)) return;
      distances.set(key, cd + 1);
      frontier.push(next);
      // valido come ending hex se rispetta 6.2.1
      if (isLegalAirEndHex(state, next, unit)) {
        result.push(next);
      }
    });
  }
  return result;
};

export const airRebase = (state: GameState, unitId: string, to: HexCoord): GameState | null => {
  const unit = state.units.get(unitId);
  if (!unit || !canCommandUnit(state, unit)) return null;
  if (unit.type !== UnitType.AIR) return null;
  if (sortiesFor(unit) >= GAME_RULES.AIR.MAX_SORTIES) return null;

  const reachable = calculateAirReachableHexes(state, unit);
  if (!reachable.some((c) => sameCoord(c, to))) return null;

  const units = new Map(state.units);
  units.set(unitId, {
    ...unit,
    position: to,
    mapPresence: "france",
    sorties: (unit.sorties || 0) + 1, // +1 sortie a fine activation (6.2.1)
    activated: true,
    moved: true
  });
  const action: GameAction = {
    type: ActionType.MOVE,
    side: unit.side,
    unitId,
    fromPos: unit.position,
    toPos: to,
    note: `${unit.name} rebased to ${hexCodeFor(to)} (+1 sortie).`,
    timestamp: new Date()
  };
  return { ...state, units, history: [action, ...state.history], timestamp: new Date() };
};

// 6.2.2 Air Strike — target a max 7 hex
export const canAirStrikeTarget = (_state: GameState, attacker: Unit, target: Unit): boolean => {
  if (attacker.type !== UnitType.AIR || target.type !== UnitType.AIR) return false;
  if (isWesternMedUnit(attacker) || isWesternMedUnit(target)) return false;
  if (isFna1942Scenario(_state.scenarioId) && target.id === FNA_AXIS_AIR_SUPPORT_ID) return false;
  if (attacker.side === target.side) return false;
  if (sortiesFor(attacker) >= GAME_RULES.AIR.MAX_SORTIES) return false;
  if (target.status === UnitStatus.DESTROYED) return false;
  if (hexDistance(attacker.position, target.position) > GAME_RULES.AIR.AIR_STRIKE_RANGE) return false;
  return true;
};

// Air Combat: usa lo stesso CRT ma "Air Combat Results (5.2.1)":
// + : entrambi +1 sortie
// DR/DD/DE: attacker +1 sortie, defender +bonus sortie
// AS/AA: defender +1 sortie, attacker +bonus sortie
const applyAirCombatResult = (
  attacker: Unit,
  defender: Unit,
  resultCode: CombatResultCode,
  bonus: number
): { attacker: Unit; defender: Unit } => {
  const cap = (n: number) => Math.min(GAME_RULES.AIR.MAX_SORTIES, n);
  const addSortie = (u: Unit, n: number): Unit => ({ ...u, sorties: cap((u.sorties || 0) + n) });

  switch (resultCode) {
    case CombatResultCode.NO_EFFECT:
      return { attacker: addSortie(attacker, 1), defender: addSortie(defender, 1) };
    case CombatResultCode.DR:
    case CombatResultCode.DD:
    case CombatResultCode.DE:
      return { attacker: addSortie(attacker, 1), defender: addSortie(defender, bonus) };
    case CombatResultCode.AS:
    case CombatResultCode.AA:
      return { attacker: addSortie(attacker, bonus), defender: addSortie(defender, 1) };
  }
};

const isBritainHex = (state: GameState, coord: HexCoord): boolean =>
  state.map.get(coordKey(coord))?.features.country === "UK";

const applyAirCombatHalving = (state: GameState, unit: Unit, modified: number): number => {
  let value = modified;
  if (supplyStateOf(unit) === SupplyState.NO) value = Math.ceil(value / 2);
  if (state.weather === WeatherType.SEVERE) value = Math.ceil(value / 2);
  return Math.max(1, value);
};

const computeAirAttackerDrm = (state: GameState, attacker: Unit): number => {
  let drm = 0;
  if (attacker.country === "Germany") drm += 2;
  if (["UK", "USA"].includes(attacker.country || "")) drm += 1;
  if (attacker.type === UnitType.AIR && (attacker as Unit & { bomber?: boolean }).bomber) drm -= 2;
  if (supplyStateOf(attacker) === SupplyState.LOW) drm -= 2;
  if (state.weather === WeatherType.POOR) drm -= 2;
  drm -= sortiesFor(attacker); // -? Number of Sorties
  return drm;
};

const computeAirDefenderDrm = (
  state: GameState,
  defender: Unit,
  attacker: Unit,
  defenderHex: HexCoord,
  isAirStrike = false
): number => {
  let drm = 0;
  if (defender.country === "Germany") drm += 2;
  if (["UK", "USA"].includes(defender.country || "")) drm += 1;
  // Player Aid, Air Combat DRM: il -2 del bomber è nella colonna
  // "Attacker or Defender", quindi vale anche quando il bomber difende.
  if (defender.bomber) drm -= 2;
  if (supplyStateOf(defender) === SupplyState.LOW) drm -= 2;
  if (state.weather === WeatherType.POOR) drm -= 2;
  if (
    isAirStrike &&
    ["UK", "USA"].includes(defender.country || "") &&
    isBritainHex(state, defenderHex) &&
    !isBritainHex(state, attacker.position)
  ) {
    drm += 2;
  }
  drm -= sortiesFor(defender);
  return drm;
};

const formatAirDrmBreakdown = (
  state: GameState,
  unit: Unit,
  opposingUnit: Unit,
  defenderHex: HexCoord,
  jets = 0,
  isAirStrike = false
): string => {
  const parts: string[] = [];
  if (unit.country === "Germany") parts.push("Germany +2");
  if (["UK", "USA"].includes(unit.country || "")) parts.push(`${unit.country} +1`);
  if ((unit as Unit & { bomber?: boolean }).bomber) parts.push("Bomber -2");
  if (supplyStateOf(unit) === SupplyState.LOW) parts.push("Low Supply -2");
  if (state.weather === WeatherType.POOR) parts.push("Poor Weather -2");
  if (
    isAirStrike &&
    ["UK", "USA"].includes(unit.country || "") &&
    unit.id === opposingUnit.id &&
    isBritainHex(state, defenderHex) &&
    !isBritainHex(state, unit.position)
  ) {
    parts.push("Britain Defense +2");
  }
  if (sortiesFor(unit) !== 0) parts.push(`Sorties -${sortiesFor(unit)}`);
  if (jets) parts.push("Jets +2");
  if (supplyStateOf(unit) === SupplyState.NO) parts.push("No Supply halved");
  if (state.weather === WeatherType.SEVERE) parts.push("Severe Weather halved");
  return parts.length > 0 ? parts.join(", ") : "none";
};

const airSupportEffectText = (code: CombatResultCode): string => {
  switch (code) {
    case CombatResultCode.NO_EFFECT:
    case CombatResultCode.DR:
    case CombatResultCode.AS:
      return "entrambi ricevono Air Support";
    case CombatResultCode.DD:
    case CombatResultCode.DE:
      return "solo l'attaccante riceve Air Support";
    case CombatResultCode.AA:
      return "solo il difensore riceve Air Support";
  }
};

const airSortieEffectText = (code: CombatResultCode, bonus: number): string => {
  switch (code) {
    case CombatResultCode.NO_EFFECT:
      return "attaccante +1 sortie, difensore +1 sortie";
    case CombatResultCode.DR:
    case CombatResultCode.DD:
    case CombatResultCode.DE:
      return `attaccante +1 sortie, difensore +${bonus} sortie`;
    case CombatResultCode.AS:
    case CombatResultCode.AA:
      return `attaccante +${bonus} sortie, difensore +1 sortie`;
  }
};

export interface AirCombatPreview {
  attackerName: string;
  defenderName: string;
  attackerRoll?: number;
  defenderRoll?: number;
  attackerModifier: number;
  defenderModifier: number;
  attackerDrmText: string;
  defenderDrmText: string;
  attackerFinal: number;
  defenderFinal: number;
  resultCode: CombatResultCode;
  resultBonus: number;
  sortieEffect: string;
  supportEffect: string;
}

export const getAirCombatPreview = (
  state: GameState,
  attacker: Unit,
  defender: Unit,
  options?: { attackerRoll?: number; defenderRoll?: number; attackerJets?: boolean; defenderJets?: boolean; isAirStrike?: boolean }
): AirCombatPreview => {
  const attackerRoll = options?.attackerRoll ?? 4;
  const defenderRoll = options?.defenderRoll ?? 4;
  const attackerJets = options?.attackerJets ? 2 : 0;
  const defenderJets = options?.defenderJets ? 2 : 0;
  const attackerModifier = computeAirAttackerDrm(state, attacker) + attackerJets;
  const defenderModifier = computeAirDefenderDrm(state, defender, attacker, defender.position, options?.isAirStrike) + defenderJets;
  const attackerFinal = applyAirCombatHalving(state, attacker, Math.max(1, attackerRoll + attackerModifier));
  const defenderFinal = applyAirCombatHalving(state, defender, Math.max(1, defenderRoll + defenderModifier));
  const crt = lookupAirCrtResult(attackerFinal, defenderFinal);
  const resultCode = crt.code as CombatResultCode;
  return {
    attackerName: attacker.name,
    defenderName: defender.name,
    attackerRoll: options?.attackerRoll,
    defenderRoll: options?.defenderRoll,
    attackerModifier,
    defenderModifier,
    attackerDrmText: formatAirDrmBreakdown(state, attacker, defender, defender.position, attackerJets, options?.isAirStrike),
    defenderDrmText: formatAirDrmBreakdown(state, defender, attacker, defender.position, defenderJets, options?.isAirStrike),
    attackerFinal,
    defenderFinal,
    resultCode,
    resultBonus: crt.bonus,
    sortieEffect: airSortieEffectText(resultCode, crt.bonus),
    supportEffect: airSupportEffectText(resultCode)
  };
};

export const resolveAirStrike = (state: GameState, attackerId: string, defenderId: string): GameState | null => {
  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);
  if (!attacker || !defender) return null;
  if (!canAirStrikeTarget(state, attacker, defender)) return null;

  const attRoll = rollD6();
  const defRoll = rollD6();
  const attModified = Math.max(1, attRoll + computeAirAttackerDrm(state, attacker));
  const defModified = Math.max(1, defRoll + computeAirDefenderDrm(state, defender, attacker, defender.position, true));
  const attFinal = applyAirCombatHalving(state, attacker, attModified);
  const defFinal = applyAirCombatHalving(state, defender, defModified);
  const crt = lookupAirCrtResult(attFinal, defFinal);
  const updated = applyAirCombatResult(attacker, defender, crt.code as CombatResultCode, crt.bonus);

  const units = new Map(state.units);
  // +1 sortie va già in applyAirCombatResult; activated + activation end
  units.set(attacker.id, { ...updated.attacker, activated: true, moved: true });
  units.set(defender.id, updated.defender);

  const action: GameAction = {
    type: ActionType.ATTACK,
    side: attacker.side,
    unitId: attacker.id,
    targetUnitId: defender.id,
    note: `Air Strike: Att. (${attRoll} ${attModified - attRoll >= 0 ? "+" : "-"} ${Math.abs(attModified - attRoll)}) vs Dif. (${defRoll} ${defModified - defRoll >= 0 ? "+" : "-"} ${Math.abs(defModified - defRoll)}) = ${attFinal} vs ${defFinal} → ${crt.code}+${crt.bonus}`,
    timestamp: new Date()
  };
  return { ...state, units, history: [action, ...state.history], timestamp: new Date() };
};

// ============ 6.1 / 13.9 SURPRISE ATTACK + 6.3.2 AMPHIBIOUS INVASION ============

const isPortHex = (hex: Hex): boolean => Boolean(hex.features.port);

const hasMulberryMarker = (state: GameState, coord: HexCoord, side: Side): boolean => {
  const key = coordKey(coord);
  return (state.mulberryMarkers?.[side] || []).includes(key);
};

const ITALY_AMPHIBIOUS_ZONES: Record<string, string[]> = {
  west: ["4622", "4322", "4526", "4127", "3621"],
  cataniaWest: ["4322", "4526", "4628"],
  cataniaEast: ["4628", "4230", "4231"],
  east: ["4230", "4231", "3525", "3527"],
  centralMed: ["4322", "4526", "4628", "4230", "4231", "4127"]
};

const italyPortLandingAreaContains = (state: GameState, portCode: string, invadeHex: HexCoord): boolean => {
  const portCoord = coordFromHexCodeForMap(portCode, "italy");
  const targetHex = state.map.get(coordKey(invadeHex));
  if (!targetHex || !isCoastalHex(targetHex)) return false;
  if (sameCoord(portCoord, invadeHex)) return true;
  return hexDistance(portCoord, invadeHex) === 1;
};

const italyLandingIsInZone = (state: GameState, portCodes: string[], invadeHex: HexCoord): boolean =>
  portCodes.some((portCode) => italyPortLandingAreaContains(state, portCode, invadeHex));

const canUseItalyAmphibiousZone = (state: GameState, attacker: Unit, fromPort: HexCoord, invadeHex: HexCoord): boolean => {
  if (!isItaly1943Scenario(state.scenarioId)) return true;
  if (isCentralMedUnit(attacker)) {
    if (state.centralMedInvasionUsed?.[attacker.side]) return false;
    return italyLandingIsInZone(state, ITALY_AMPHIBIOUS_ZONES.centralMed, invadeHex);
  }

  const fromCode = hexCodeForMap(fromPort, "italy");
  const eligibleZones = Object.values(ITALY_AMPHIBIOUS_ZONES).filter((zone) => zone.includes(fromCode));
  if (eligibleZones.length === 0) return false;
  return eligibleZones.some((zone) => italyLandingIsInZone(state, zone.filter((code) => code !== fromCode), invadeHex));
};

const markCentralMedInvasionUsed = (state: GameState, unit: Unit): GameState =>
  isCentralMedUnit(unit)
    ? {
      ...state,
      centralMedInvasionUsed: {
        ...state.centralMedInvasionUsed,
        [unit.side]: true
      }
    }
    : state;

export const placeSurpriseAttackMarker = (
  state: GameState,
  side: Side,
  coord: HexCoord,
  markerId?: string
): GameState | null => {
  if (state.currentSide !== side) return null;
  if (!canUseOperationalActions(state)) return null;
  const hex = state.map.get(coordKey(coord));
  if (!hex) return null;
  const terrainTags = hex.terrainTags || [];
  if (hex.terrain === TerrainType.SEA || (terrainTags.includes("sea") && !terrainTags.includes("coast"))) return null;
  if (hex.features.prohibited) return null;
  const eventsBox = state.factionCards[side].eventsBox;
  // Se viene passato un markerId esplicito, usalo (cosi distinguiamo "USA Surprise Attack" da "UK Surprise Attack").
  const marker = markerId
    ? (eventsBox.includes(markerId) ? markerId : null)
    : eventsBox.find((id) => id.toLowerCase().includes("surprise attack"));
  if (!marker) return null;
  const key = coordKey(coord);
  const current = state.surpriseAttackMarkers || {};
  const existing = current[side] || [];
  if (existing.includes(key)) return null;
  return {
    ...state,
    factionCards: {
      ...state.factionCards,
      [side]: {
        ...state.factionCards[side],
        eventsBox: eventsBox.filter((id) => id !== marker)
      }
    },
    surpriseAttackMarkers: { ...current, [side]: [...existing, key] },
    mapEventMarkerDetails: [
      ...(state.mapEventMarkerDetails || []),
      { markerId: marker, side, kind: "surprise", coordKey: key }
    ],
    history: [
      { type: ActionType.HOLD, side, note: `${marker} placed at ${hexCodeForMap(coord, scenarioById(state.scenarioId).mapId)}.`, timestamp: new Date() },
      ...state.history
    ],
    timestamp: new Date()
  };
};

export const placePartisansMarker = (
  state: GameState,
  side: Side,
  coord: HexCoord,
  markerId?: string
): GameState | null => {
  if (state.currentSide !== side) return null;
  if (!canUseOperationalActions(state)) return null;
  const eventsBox = state.factionCards[side].eventsBox;
  const marker = markerId
    ? (eventsBox.includes(markerId) ? markerId : null)
    : eventsBox.find((id) => id.toLowerCase().includes("partisans"));
  if (!marker) return null;
  const hex = state.map.get(coordKey(coord));
  if (!hex) return null;
  const enemyHere = Array.from(state.units.values()).some((unit) =>
    unit.status !== UnitStatus.DESTROYED &&
    unit.side !== side &&
    unit.type !== UnitType.FORT &&
    sameCoord(unit.position, coord)
  );
  if (!enemyHere) return null;
  const key = coordKey(coord);
  const current = state.partisansMarkers || {};
  const existing = current[side] || [];
  if (existing.includes(key)) return null;
  return {
    ...state,
    factionCards: {
      ...state.factionCards,
      [side]: {
        ...state.factionCards[side],
        eventsBox: state.factionCards[side].eventsBox.filter((id) => id !== marker)
      }
    },
    partisansMarkers: { ...current, [side]: [...existing, key] },
    mapEventMarkerDetails: [
      ...(state.mapEventMarkerDetails || []),
      { markerId: marker, side, kind: "partisans", coordKey: key }
    ],
    history: [
      { type: ActionType.HOLD, side, note: `Partisans marker placed at ${hexCodeFor(coord)}.`, timestamp: new Date() },
      ...state.history
    ],
    timestamp: new Date()
  };
};

export const placeAirdropMarker = (
  state: GameState,
  side: Side,
  coord: HexCoord,
  markerId?: string
): GameState | null => {
  if (state.currentSide !== side) return null;
  if (!canUseOperationalActions(state)) return null;
  const eventsBox = state.factionCards[side].eventsBox;
  const marker = markerId
    ? (eventsBox.includes(markerId) ? markerId : null)
    : eventsBox.find((id) => id.toLowerCase().includes("airdrop"));
  if (!marker) return null;
  const hex = state.map.get(coordKey(coord));
  if (!hex) return null;
  if (side === Side.AXIS && hex.features.country === "UK") return null;
  const terrainTags = hex.terrainTags || [];
  if (hex.terrain === TerrainType.SEA || (terrainTags.includes("sea") && !terrainTags.includes("coast"))) return null;
  const markerCountryMatch = (air: Unit): boolean => {
    const markerName = marker.toLowerCase();
    if (side === Side.ALLIED) {
      if (markerName.includes("uk/usa") || markerName.includes("western") || !markerName.includes("airdrop")) {
        return air.country === "UK" || air.country === "USA";
      }
      if (markerName.includes("uk")) return air.country === "UK";
      if (markerName.includes("usa")) return air.country === "USA";
      return air.country === "UK" || air.country === "USA";
    }
    if (markerName.includes("germany")) return air.country === "Germany";
    if (markerName.includes("italy")) return air.country === "Italy";
    return air.side === side;
  };
  const hasAirInRange = Array.from(state.units.values()).some((unit) =>
    unit.type === UnitType.AIR &&
    unit.side === side &&
    unit.status !== UnitStatus.DESTROYED &&
    markerCountryMatch(unit) &&
    (isNavalMapBoxUnit(unit) || hexDistance(unit.position, coord) <= 3)
  );
  if (!hasAirInRange) return null;
  const key = coordKey(coord);
  const current = state.airdropMarkers || {};
  const existing = current[side] || [];
  if (existing.includes(key)) return null;

  const placed: GameState = {
    ...state,
    factionCards: {
      ...state.factionCards,
      [side]: {
        ...state.factionCards[side],
        eventsBox: state.factionCards[side].eventsBox.filter((id) => id !== marker)
      }
    },
    airdropMarkers: { ...current, [side]: [...existing, key] },
    mapEventMarkerDetails: [
      ...(state.mapEventMarkerDetails || []),
      { markerId: marker, side, kind: "airdrop", coordKey: key }
    ]
  };

  // 13.1: se l'hex contiene una città nemica e NESSUNA unità nemica, si tira un
  // d6: con 1-3 la città passa sotto controllo amico, con 4-6 non succede nulla.
  const enemyUnitHere = Array.from(state.units.values()).some(
    (unit) => unit.side !== side && unit.status !== UnitStatus.DESTROYED && sameCoord(unit.position, coord)
  );
  const enemyCityHere = hexHasCity(hex) && isEnemyControlledFeature(hex, side);
  let captureNote = "";
  let withCapture = placed;
  if (enemyCityHere && !enemyUnitHere) {
    const roll = rollD6();
    if (roll <= 3) {
      const change = applyHexControlChange(placed, coord, side);
      withCapture = applyNationalWillDelta(change.state, change.nationalWillDelta);
      captureNote = ` Tiro ${roll}: paracadutisti prendono la città. ${change.note}`;
    } else {
      captureNote = ` Tiro ${roll}: le forze locali respingono i paracadutisti.`;
    }
  }

  return {
    ...withCapture,
    history: [
      {
        type: ActionType.HOLD,
        side,
        note: `Airdrop marker placed at ${hexCodeForMap(coord, scenarioById(state.scenarioId).mapId)}.${captureNote}`,
        timestamp: new Date()
      },
      ...state.history
    ],
    timestamp: new Date()
  };
};

export const placeMulberryMarker = (
  state: GameState,
  side: Side,
  coord: HexCoord,
  markerId?: string
): GameState | null => {
  if (state.currentSide !== side) return null;
  if (!canUseOperationalActions(state)) return null;
  const eventsBox = state.factionCards[side].eventsBox;
  const marker = markerId
    ? (eventsBox.includes(markerId) ? markerId : null)
    : eventsBox.find((id) => id.toLowerCase().includes("mulberry"));
  if (!marker) return null;
  const hex = state.map.get(coordKey(coord));
  if (!hex || !isCoastalHex(hex)) return null;
  if (hex.features.port) return null;
  const friendlyGroundHere = getGroundUnitOnHex(state, coord);
  if (!friendlyGroundHere || friendlyGroundHere.side !== side) return null;
  const key = coordKey(coord);
  const current = state.mulberryMarkers || {};
  const existing = current[side] || [];
  if (existing.includes(key)) return null;
  return {
    ...state,
    factionCards: {
      ...state.factionCards,
      [side]: {
        ...state.factionCards[side],
        eventsBox: eventsBox.filter((id) => id !== marker)
      }
    },
    mulberryMarkers: { ...current, [side]: [...existing, key] },
    mapEventMarkerDetails: [
      ...(state.mapEventMarkerDetails || []),
      { markerId: marker, side, kind: "mulberry", coordKey: key }
    ],
    history: [
      { type: ActionType.HOLD, side, note: `${marker} placed at ${hexCodeForMap(coord, scenarioById(state.scenarioId).mapId)}.`, timestamp: new Date() },
      ...state.history
    ],
    timestamp: new Date()
  };
};

export const playMapEventMarker = (state: GameState, side: Side, markerId: string, coord: HexCoord): GameState | null => {
  const normalized = markerId.toLowerCase();
  if (normalized.includes("partisans")) return placePartisansMarker(state, side, coord, markerId);
  if (normalized.includes("surprise attack")) return placeSurpriseAttackMarker(state, side, coord, markerId);
  if (normalized.includes("airdrop")) return placeAirdropMarker(state, side, coord, markerId);
  if (normalized.includes("mulberry")) return placeMulberryMarker(state, side, coord, markerId);
  return null;
};

const isCoastalHex = (hex: Hex): boolean =>
  hex.terrain === TerrainType.COASTAL || (hex.terrainTags || []).includes("coast");

const surpriseMarkerKeyForInvasion = (state: GameState, side: Side, invadeHex: HexCoord): string | null => {
  const markers = state.surpriseAttackMarkers?.[side] || [];
  const allowed = new Set([coordKey(invadeHex), ...neighborsOf(invadeHex).map(coordKey)]);
  return markers.find((key) => allowed.has(key)) || null;
};

const consumeSurpriseMarkerForInvasion = (state: GameState, side: Side, invadeHex: HexCoord): GameState => {
  const markerKey = surpriseMarkerKeyForInvasion(state, side, invadeHex);
  if (!markerKey) return state;
  const current = state.surpriseAttackMarkers || {};
  const detail = (state.mapEventMarkerDetails || []).find(
    (item) => item.side === side && item.kind === "surprise" && item.coordKey === markerKey
  );
  const returnEntries = detail?.markerId.toLowerCase().includes("usa")
    ? [eventReturnEntry(state, side, detail.markerId, 4)]
    : [];
  return addEventReturnEntries({
    ...state,
    surpriseAttackMarkers: {
      ...current,
      [side]: (current[side] || []).filter((key) => key !== markerKey)
    },
    mapEventMarkerDetails: (state.mapEventMarkerDetails || []).filter(
      (item) => !(item.side === side && item.kind === "surprise" && item.coordKey === markerKey)
    )
  }, returnEntries);
};

// 6.3.2.1 prohibition: invade hex non può contenere unità amica
// 6.3.2.1: severe weather no amphibious
// 6.3.2: invade hex deve essere coastal con port marker oppure adiacente a port marker
export const canAmphibiousInvade = (state: GameState, attacker: Unit, fromPort: HexCoord, invadeHex: HexCoord): boolean => {
  if (attacker.type === UnitType.AIR || attacker.type === UnitType.FORT) return false;
  if (attacker.side !== Side.ALLIED) return false;
  const target = state.map.get(coordKey(invadeHex));
  if (!target) return false;
  if (!isCoastalHex(target)) return false;
  const isFnaInitialInvasion = canPerformFnaInitialInvasion(state, attacker, invadeHex);
  if (!isFnaInitialInvasion && state.weather === WeatherType.SEVERE) return false;
  if (isFnaInitialInvasion) {
    // FNA 1942 special rule: the first UK 1 Canada / USA Task Force actions are
    // automatic amphibious invasions into Casablanca, Oran, or Algiers.
  } else if (isWesternMedUnit(attacker)) {
    if (!isMarseilleOrAdjacent(invadeHex)) return false;
  } else if (isCentralMedUnit(attacker)) {
    if (!canUseItalyAmphibiousZone(state, attacker, fromPort, invadeHex)) return false;
  } else {
    const fromHex = state.map.get(coordKey(fromPort));
    if (!fromHex || !isPortHex(fromHex)) return false;
    if (!sameCoord(attacker.position, fromPort)) return false;
    if (!canUseItalyAmphibiousZone(state, attacker, fromPort, invadeHex)) return false;
  }
  // Surprise Attack marker richiesto in invadeHex o adiacente, tranne per le
  // invasioni iniziali automatiche dello scenario FNA.
  if (!isFnaInitialInvasion && !surpriseMarkerKeyForInvasion(state, attacker.side, invadeHex)) return false;
  // No friendly unit on invade hex
  const occ = getUnitOnHex(state, invadeHex);
  if (occ && occ.side === attacker.side) return false;
  return true;
};

// Restituisce tutte le hex su cui questa unità può invadere ora.
// Considera Western Med Box (Marsiglia + adiacenti) e port-based amphibious.
export const amphibiousTargetsFor = (state: GameState, attacker: Unit): HexCoord[] => {
  if (attacker.type === UnitType.AIR || attacker.type === UnitType.FORT) return [];
  if (attacker.side !== Side.ALLIED) return [];
  const fromPort = isWesternMedUnit(attacker) ? attacker.position : attacker.position;
  const candidates: HexCoord[] = [];
  state.map.forEach((hex) => {
    if (canAmphibiousInvade(state, attacker, fromPort, hex.coord)) {
      candidates.push(hex.coord);
    }
  });
  return candidates;
};

export const executeAmphibiousInvasion = (
  state: GameState,
  unitId: string,
  fromPort: HexCoord,
  invadeHex: HexCoord
): GameState | null => {
  const attacker = state.units.get(unitId);
  if (!attacker || !canCommandUnit(state, attacker)) return null;
  if (!canAmphibiousInvade(state, attacker, fromPort, invadeHex)) return null;

  const defender = getUnitOnHex(state, invadeHex);
  const units = new Map(state.units);

  // 6.3.2.2: se nessun nemico, sposta subito unità nell'invade hex
  if (!defender) {
    units.set(unitId, { ...attacker, position: invadeHex, mapPresence: "france", activated: true, moved: true, occupyingFort: false });
    const isFnaInitialInvasion = canPerformFnaInitialInvasion(state, attacker, invadeHex);
    let landed: GameState = markCentralMedInvasionUsed(
      isFnaInitialInvasion
        ? { ...state, units }
        : consumeSurpriseMarkerForInvasion({ ...state, units }, attacker.side, invadeHex),
      attacker
    );
    // 4.2.3.7: displace air nemiche dall'invade hex
    landed = displaceEnemyAirFrom(landed, invadeHex, attacker.side);
    const claim = applyHexControlChange(landed, invadeHex, attacker.side);
    landed = applyNationalWillDelta(claim.state, claim.nationalWillDelta);
    const action: GameAction = {
      type: ActionType.MOVE,
      side: attacker.side,
      unitId,
      fromPos: fromPort,
      toPos: invadeHex,
      note: `${isFnaInitialInvasion ? "FNA initial amphibious invasion: " : ""}${attacker.name} amphibious invasion from ${isEastNaUnit(attacker) ? "Eastern North America Box" : isWesternMedUnit(attacker) ? "Western Mediterranean Box" : isCentralMedUnit(attacker) ? "Central Mediterranean Box" : hexCodeForMap(fromPort, scenarioById(state.scenarioId).mapId)} landed on ${hexCodeForMap(invadeHex, scenarioById(state.scenarioId).mapId)}.${claim.note ? " " + claim.note : ""}`,
      timestamp: new Date()
    };
    landed = occupyFriendlyFortIfEligible(landed, unitId);
    return checkCountryCollapses({ ...landed, history: [action, ...landed.history], timestamp: new Date() });
  }

  // 6.3.2.2: difensore presente → Assault immediato. L'attaccante resta in fromPort durante il combat.
  // L'unità non esercita EZOC contro/intorno alla difensiva (semplificazione: lo è già perché non è ancora adiacente)
  // Per l'Assault con Naval Support DRM, il difensore deve essere in coastal hex
  // Non gestiamo additionalAttackers da Assault precedenti per ora.
  const stateBeforeCombat: GameState = {
    ...state,
    units,
    // setto temporaneamente assaultTarget per coerenza CRT (anche se è amphibious)
  };
  // Risolvi Assault (CRT)
  const next = prepareCombat(stateBeforeCombat, attacker.id, defender.id, { attackType: AttackType.ASSAULT, isAmphibious: true })
    || resolveCombat(stateBeforeCombat, attacker.id, defender.id, { attackType: AttackType.ASSAULT, isAmphibious: true });
  // Dopo combat: se difensore eliminato/retreat, l'attaccante DEVE essere messo nell'invade hex (6.3.2.2)
  // Lo gestisce la pendingCombat advance (l'utente può scegliere di non advance, ma in amphibious è obbligatorio: forziamo advance)
  if (next.pendingCombat?.kind === "advance" && next.pendingCombat.attackerId === unitId) {
    return resolveAdvanceChoice(next, true) || next;
  }
  return next;
};

// ============ 7.x SUPPLY ============

export const supplyStateOf = (unit: Unit): SupplyState => isNavalMapBoxUnit(unit) ? SupplyState.FULL : unit.supplyState ?? SupplyState.FULL;

export const isSupplied = (unit: Unit): boolean => supplyStateOf(unit) !== SupplyState.NO;

const canUseNavalTransportDestination = (state: GameState, unit: Unit, hex: Hex): boolean => {
  const hasPort = hex.features.port || hasMulberryMarker(state, hex.coord, unit.side);
  if (!hasPort || hex.features.controller !== unit.side) return false;
  if (hex.features.prohibited || isGroundMovementProhibited(state, hex.coord, unit)) return false;
  if (isEnemyControlledCity(hex, unit.side)) return false;
  if (isFortHex(state, hex.coord)) return false;
  const occupant = getUnitOnHex(state, hex.coord);
  if (occupant && occupant.id !== unit.id) {
    if (occupant.side !== unit.side) return false;
    if (unit.type !== UnitType.AIR) return false;
  }
  const key = coordKey(hex.coord);
  if (Object.values(state.airdropMarkers || {}).some((keys) => keys?.includes(key))) return false;
  if (Object.values(state.partisansMarkers || {}).some((keys) => keys?.includes(key))) return false;
  return true;
};

export const canNavalTransport = (state: GameState, unit: Unit): boolean => {
  if (!canCommandUnit(state, unit)) return false;
  if (unit.side !== Side.ALLIED) return false;
  if (unit.type === UnitType.FORT) return false;
  if (isWesternMedUnit(unit) || isCentralMedUnit(unit)) return true;
  if (unit.mapPresence !== "france") return false;
  const hex = state.map.get(coordKey(unit.position));
  if (!hex || hex.features.controller !== unit.side) return false;
  return hex.features.port || hasMulberryMarker(state, unit.position, unit.side);
};

export const calculateNavalTransportTargets = (state: GameState, unit: Unit): HexCoord[] => {
  if (!canNavalTransport(state, unit)) return [];
  return Array.from(state.map.values())
    .filter((hex) => (unit.mapPresence !== "france" || !sameCoord(hex.coord, unit.position)) && canUseNavalTransportDestination(state, unit, hex))
    .map((hex) => hex.coord);
};

export const executeNavalTransport = (state: GameState, unitId: string, to: HexCoord): GameState | null => {
  const unit = state.units.get(unitId);
  if (!unit || !canNavalTransport(state, unit)) return null;
  const targets = calculateNavalTransportTargets(state, unit);
  if (!targets.some((coord) => sameCoord(coord, to))) return null;

  const units = new Map(state.units);
  units.set(unit.id, {
    ...unit,
    position: to,
    mapPresence: "france",
    moved: true,
    activated: true,
    movementSpent: movementAllowanceFor(unit),
    occupyingFort: false
  });

  const mapId = scenarioById(state.scenarioId).mapId;
  const fromLabel = isCentralMedUnit(unit)
    ? "Central Mediterranean Box"
    : isWesternMedUnit(unit)
      ? "Western Mediterranean Box"
      : hexCodeForMap(unit.position, mapId);
  const action: GameAction = {
    type: ActionType.MOVE,
    side: unit.side,
    unitId,
    fromPos: unit.position,
    toPos: to,
    note: `${unit.name} Naval Transport from ${fromLabel} to ${hexCodeForMap(to, mapId)}.`,
    timestamp: new Date()
  };

  let nextState: GameState = {
    ...state,
    units,
    history: [action, ...state.history],
    timestamp: new Date()
  };
  nextState = displaceEnemyAirFrom(nextState, to, unit.side);
  return nextState;
};

const BARBAROSSA_AXIS_COUNTRIES = new Set(["Germany", "Romania", "Hungary", "Finland"]);

const isBarbarossaAxisSupplySourceHex = (state: GameState, hex: Hex, unit: Unit): boolean => {
  if (!isBarbarossa1941Scenario(state.scenarioId)) return false;
  if (unit.side !== Side.AXIS) return false;
  // Hex con ferrovia che esce dal bordo OVEST = collegamento con la Germania
  if (hasTransportLineToWestEdge(state, hex.coord)) return true;
  // Città/capitali Asse friendly
  const features = hex.features;
  if (!(features.city || features.capital || features.productionCenter)) return false;
  if (!features.country || !BARBAROSSA_AXIS_COUNTRIES.has(features.country)) return false;
  const controller = features.controller;
  return controller === undefined || controller === Side.AXIS;
};

// 7.3.2: Unlimited Supply Source per `unit`?
const isUnlimitedSupplySource = (state: GameState, hex: Hex, unit: Unit): boolean => {
  if (unit.country === "Germany" && isGermanItalyUnlimitedSupplySourceHex(state, hex)) return true;
  if (isBarbarossaAxisSupplySourceHex(state, hex, unit)) return true;
  // Mulberry marker counts as a Western friendly port for Allied units (capped at 2 units in performSupplyCheck)
  if (unit.side === Side.ALLIED && hasMulberryMarker(state, hex.coord, Side.ALLIED)) return true;
  const features = hex.features;
  const isCity = features.city || features.capital || features.productionCenter;
  if (!isCity) {
    // Eccezione: friendly UK city = USS per USA. Già coperto dal check sopra (UK city = isCity).
    // Eccezione: friendly Western port outside UK = USS for up to 2 Western units (gestito a parte tramite limit).
    return false;
  }
  const country = features.country;
  if (!country) return false;
  const controller = features.controller;
  // hex deve essere "friendly" per l'unità
  const friendlyControlled = controller === undefined || controller === unit.side;
  if (!friendlyControlled) return false;
  // 7.3.2: friendly country's city is a USS for that country's units
  if (country === unit.country) return true;
  // 7.3.2: friendly UK city is a USS for a USA unit
  if (country === "UK" && unit.country === "USA") return true;
  return false;
};

// 7.3.1: Limited Supply Source per `unit`?
const isLimitedSupplySource = (_state: GameState, hex: Hex, unit: Unit, controlledCountriesByConqueror: Set<string>): boolean => {
  const features = hex.features;
  if (!features.capital) return false;
  // friendly capital in conquered country = LSS for the controlling faction
  const country = features.country;
  if (!country) return false;
  if (controlledCountriesByConqueror.has(country) && features.controller === unit.side) {
    return true;
  }
  // friendly capital without a port in a Western country = LSS for UK or USA unit (gestito quando active country)
  if (!features.port && features.controller === unit.side && unit.side === Side.ALLIED && (unit.country === "UK" || unit.country === "USA")) {
    return true;
  }
  return false;
};

// 7.3.2 port limitation: Western friendly port outside UK supplies up to 2 Western units (Full)
const isWesternFriendlyPortHex = (hex: Hex): boolean =>
  Boolean(hex.features.port) && hex.features.controller === Side.ALLIED && hex.features.country !== "UK";

const isFnaAxisSpecialSupplySource = (state: GameState, hex: Hex, unit: Unit): boolean => {
  if (!isFna1942Scenario(state.scenarioId)) return false;
  if (unit.side !== Side.AXIS || (unit.country !== "Germany" && unit.country !== "Italy")) return false;
  if (hex.features.controller !== Side.AXIS) return false;
  const code = hexCodeForMap(hex.coord, "west");
  return code === "4622" || code === "5022"; // Tunis or Gabes
};

const isFnaAxisSpecialSupplyTrace = (state: GameState, unit: Unit, sourceCoord: HexCoord | undefined): boolean => {
  if (!sourceCoord) return false;
  const sourceHex = state.map.get(coordKey(sourceCoord));
  return Boolean(sourceHex && isFnaAxisSpecialSupplySource(state, sourceHex, unit));
};

// Restituisce true se il path supply line è valido (7.4 prohibitions)
const supplyHexAllowed = (state: GameState, coord: HexCoord, side: Side): boolean => {
  const hex = state.map.get(coordKey(coord));
  if (!hex) return false;
  if (hex.features.prohibited) return false;
  if (isGroundMovementProhibited(state, coord)) return false;
  // no enemy city/fort
  const enemyCity = (hex.features.city || hex.features.capital) &&
    hex.features.controller !== undefined && hex.features.controller !== side && hex.features.controller !== "neutral";
  if (enemyCity) return false;
  if (isFortHex(state, coord)) {
    // forte: enemy fort blocca
    const fortUnit = Array.from(state.units.values()).find(
      (u) => u.type === UnitType.FORT && u.status !== UnitStatus.DESTROYED && sameCoord(u.position, coord)
    );
    if (fortUnit && fortUnit.side !== side) return false;
  }
  // no enemy unit
  const occ = getGroundUnitOnHex(state, coord);
  if (occ && occ.side !== side) return false;
  // no enemy ZOC, eccezione: friendly city/fort/ground unit cancella l'EZOC nell'hex
  const friendlyHere = Boolean(occ && occ.side === side) ||
    ((hex.features.city || hex.features.capital) && hex.features.controller === side) ||
    (isFortHex(state, coord));
  if (!friendlyHere && isEnemyZoc(state, coord, side)) return false;
  return true;
};

// 7.4.1: traccia una supply line dall'unità a una source. Ritorna {sourceType, sourceCoord} o null.
export const traceSupplyLine = (
  state: GameState,
  unit: Unit
): { sourceType: "unlimited" | "limited"; sourceCoord: HexCoord; path: HexCoord[] } | null => {
  if (unit.type === UnitType.AIR || unit.type === UnitType.FORT) return null;

  // Trova countries conquered (semplificazione: tutte le città del paese sono enemy controlled)
  const conqueredCountries = new Set<string>();
  const countriesSeen = new Map<string, { totalCities: number; enemyCities: number }>();
  state.map.forEach((hex) => {
    const country = hex.features.country;
    if (!country) return;
    if (!(hex.features.city || hex.features.capital)) return;
    const stat = countriesSeen.get(country) || { totalCities: 0, enemyCities: 0 };
    stat.totalCities += 1;
    if (hex.features.controller && hex.features.controller !== "neutral" && hex.features.controller !== unit.side) {
      stat.enemyCities += 1;
    }
    countriesSeen.set(country, stat);
  });
  countriesSeen.forEach((stat, country) => {
    if (stat.totalCities > 0 && stat.totalCities === stat.enemyCities) conqueredCountries.add(country);
  });

  // BFS: max 2 hex senza Transport Line, poi unlimited lungo Transport Line.
  // State frontier: { coord, hopsWithoutRail, reachedTransport }
  type Node = { coord: HexCoord; hopsWithoutRail: number; reachedTransport: boolean };
  const visited = new Map<string, number>(); // best hopsWithoutRail per key
  const parent = new Map<string, string | null>();
  const coordsByKey = new Map<string, HexCoord>();
  const queue: Node[] = [{ coord: unit.position, hopsWithoutRail: 0, reachedTransport: false }];
  const startKey = coordKey(unit.position);
  visited.set(startKey, 0);
  parent.set(startKey, null);
  coordsByKey.set(startKey, unit.position);

  const reconstructPath = (source: HexCoord): HexCoord[] => {
    const path: HexCoord[] = [];
    let key: string | null | undefined = coordKey(source);
    while (key) {
      const coord = coordsByKey.get(key);
      if (coord) path.push(coord);
      key = parent.get(key);
    }
    return path.reverse();
  };

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) break;
    const hex = state.map.get(coordKey(node.coord));
    if (!hex) continue;

    // Controllo se l'hex corrente è una source
    if (isUnlimitedSupplySource(state, hex, unit)) {
      return { sourceType: "unlimited", sourceCoord: node.coord, path: reconstructPath(node.coord) };
    }
    if (isLimitedSupplySource(state, hex, unit, conqueredCountries)) {
      return { sourceType: "limited", sourceCoord: node.coord, path: reconstructPath(node.coord) };
    }
    if (isFnaAxisSpecialSupplySource(state, hex, unit)) {
      return { sourceType: "unlimited", sourceCoord: node.coord, path: reconstructPath(node.coord) };
    }

    // Se l'hex è un Western friendly port outside UK, è USS per Western units (limite a 2 per port gestito esternamente)
    if (
      unit.side === Side.ALLIED &&
      (unit.country === "UK" || unit.country === "USA") &&
      isWesternFriendlyPortHex(hex)
    ) {
      return { sourceType: "unlimited", sourceCoord: node.coord, path: reconstructPath(node.coord) };
    }

    // Espansione: per ogni vicino, se l'hex è ancora attraversabile per supply
    HEX_SIDES.forEach((side) => {
      const next = neighborForSide(node.coord, side);
      const nextKey = coordKey(next);
      if (!isInsideMap(state, next)) return;
      if (state.impassableEdges.has(edgeKey(node.coord, next))) return;
      if (!supplyHexAllowed(state, next, unit.side)) return;

      const railHere = hasTransportLineThroughSide(state, node.coord, next);
      let nextHops = node.hopsWithoutRail;
      let reachedTr = node.reachedTransport;

      if (railHere) {
        reachedTr = true; // siamo entrati su transport line
        // movimento "lungo" la transport line non incrementa hops
      } else {
        // se reachedTr era true, non possiamo abbandonare la transport line
        if (reachedTr) return;
        nextHops = node.hopsWithoutRail + 1;
        if (nextHops > 2) return; // max 2 hex senza transport line
      }

      const prev = visited.get(nextKey);
      if (prev !== undefined && prev <= nextHops) return; // già visitato con costo migliore
      visited.set(nextKey, nextHops);
      parent.set(nextKey, coordKey(node.coord));
      coordsByKey.set(nextKey, next);
      queue.push({ coord: next, hopsWithoutRail: nextHops, reachedTransport: reachedTr });
    });
  }

  return null;
};

// 7.2: esegue il supply check per una fazione. Ritorna lo stato aggiornato e una nota.
export const performSupplyCheck = (state: GameState, side: Side): GameState => {
  const portUsage = new Map<string, number>(); // coordKey port → usage
  const newUnits = new Map<string, Unit>();
  const notes: string[] = [];

  state.units.forEach((unit, id) => {
    if (unit.side !== side || unit.status === UnitStatus.DESTROYED) {
      newUnits.set(id, unit);
      return;
    }
    if (isNavalMapBoxUnit(unit) || unit.mapPresence === "east_na" || unit.type === UnitType.AIR || unit.type === UnitType.FORT) {
      // Western Med Box / Air / Fort non tracciano supply allo stesso modo (semplificazione: assumiamo Full)
      newUnits.set(id, {
        ...unit,
        supplyState: SupplyState.FULL,
        supplySourceType: undefined,
        supplySourceCoord: undefined,
        supplyPath: undefined,
        supplyCheckedTurn: state.turn
      });
      return;
    }

    const trace = traceSupplyLine(state, unit);
    let nextSupply: SupplyState;
    let supplySourceType = trace?.sourceType;
    if (!trace) {
      // Nessuna supply line: peggioramento di un livello (7.2 last paragraph)
      const cur = supplyStateOf(unit);
      nextSupply = cur === SupplyState.FULL ? SupplyState.LOW : cur === SupplyState.LOW ? SupplyState.NO : SupplyState.NO;
      if (nextSupply !== cur) notes.push(`${unit.name} → ${nextSupply}`);
    } else if (trace.sourceType === "unlimited") {
      // Verifica port limit (Western friendly port outside UK = max 2 Western units)
      const sourceHex = state.map.get(coordKey(trace.sourceCoord));
      if (isFnaAxisSpecialSupplyTrace(state, unit, trace.sourceCoord)) {
        const roll = rollD6();
        nextSupply = roll <= 3 ? SupplyState.FULL : SupplyState.LOW;
        supplySourceType = roll <= 3 ? "unlimited" : "limited";
        notes.push(`${unit.name} FNA supply roll ${roll}${roll <= 3 ? " Full" : " Low"}`);
      } else if (sourceHex && (isWesternFriendlyPortHex(sourceHex) || hasMulberryMarker(state, trace.sourceCoord, Side.ALLIED))) {
        const portKey = coordKey(trace.sourceCoord);
        const used = portUsage.get(portKey) || 0;
        if (used >= 2) {
          // Eccede il limite: questa unità diventa Low (LSS-like) o se vuole può non essere fornita
          nextSupply = SupplyState.LOW;
        } else {
          portUsage.set(portKey, used + 1);
          nextSupply = SupplyState.FULL;
        }
      } else {
        nextSupply = SupplyState.FULL;
      }
    } else {
      // 7.3.1: una Limited Supply Source rifornisce fino a DUE unità, dando a
      // ciascuna Low Supply. Oltre la capacità l'unità resta senza rifornimento
      // e il suo stato peggiora di un livello come da 7.2.
      const lssKey = coordKey(trace.sourceCoord);
      const usedLss = portUsage.get(lssKey) || 0;
      if (usedLss >= 2) {
        const cur = supplyStateOf(unit);
        nextSupply = cur === SupplyState.FULL ? SupplyState.LOW : SupplyState.NO;
        supplySourceType = undefined;
        notes.push(`${unit.name}: fonte limitata già satura (2 unità)`);
      } else {
        portUsage.set(lssKey, usedLss + 1);
        nextSupply = SupplyState.LOW;
      }
    }

    if (nextSupply !== supplyStateOf(unit)) {
      notes.push(`${unit.name} ${supplyStateOf(unit)} → ${nextSupply}`);
    }
    newUnits.set(id, {
      ...unit,
      supplyState: nextSupply,
      supplySourceType,
      supplySourceCoord: trace?.sourceCoord,
      supplyPath: trace?.path,
      supplyCheckedTurn: state.turn
    });
  });

  const action: GameAction = {
    type: ActionType.HOLD,
    side,
    note: `Supply check: ${notes.length > 0 ? notes.join("; ") : "no changes"}.`,
    timestamp: new Date()
  };

  return {
    ...state,
    units: newUnits,
    history: [action, ...state.history],
    timestamp: new Date()
  };
};

// 7.5.1: Unsupplied Attrition per la fazione corrente.
// Reduced ground unit con No Supply → eliminata
// Full strength ground unit con No Supply → reduced
// Air unit con No Supply → sortie rimosse, eliminata
export const performNoSupplyPhase = (state: GameState, side: Side): GameState => {
  const newUnits = new Map<string, Unit>();
  const notes: string[] = [];
  let nextState: GameState = state;

  state.units.forEach((unit, id) => {
    if (unit.side !== side || unit.status === UnitStatus.DESTROYED) {
      newUnits.set(id, unit);
      return;
    }
    if (supplyStateOf(unit) !== SupplyState.NO) {
      newUnits.set(id, unit);
      return;
    }
    if (unit.type === UnitType.FORT) {
      newUnits.set(id, unit);
      return;
    }
    if (unit.type === UnitType.AIR) {
      // 7.5.1 step 3: air unit eliminata, sortie rimosse
      newUnits.set(id, { ...unit, status: UnitStatus.DESTROYED, sorties: 0 });
      notes.push(`${unit.name} air eliminated (no supply)`);
      return;
    }
    // Ground
    if (unit.reduced) {
      newUnits.set(id, { ...unit, status: UnitStatus.DESTROYED, strength: 0 });
      notes.push(`${unit.name} eliminated (no supply attrition)`);
    } else {
      newUnits.set(id, { ...unit, reduced: true, strength: Math.ceil(unit.maxStrength / 2) });
      notes.push(`${unit.name} reduced (no supply attrition)`);
    }
  });

  nextState = { ...nextState, units: newUnits };

  const action: GameAction = {
    type: ActionType.HOLD,
    side,
    note: `No Supply Phase: ${notes.length > 0 ? notes.join("; ") : "no attrition"}.`,
    timestamp: new Date()
  };

  return collectEliminatedIntoBox({ ...nextState, history: [action, ...nextState.history], timestamp: new Date() });
};

// ============ 12.1 COUNTRY COLLAPSE + 11.1 VICTORY CHECK ============

// Restituisce per ogni country presente sulla mappa: stato di controllo città
// (totalCities, friendlyCities, enemyCities, neutralCities) per la fazione del country.
const computeCountryCityStatus = (state: GameState): Map<string, { country: string; ownerSide: Side; totalCities: number; enemyCities: number }> => {
  const result = new Map<string, { country: string; ownerSide: Side; totalCities: number; enemyCities: number }>();
  state.map.forEach((hex) => {
    const country = hex.features.country;
    if (!country) return;
    if (!(hex.features.city || hex.features.capital)) return;
    // owner side: chi possiede la nation? Lo deduco dal seed → initialControllerForCountry
    const owner = initialControllerForCountry(country, (state.scenarioId as ScenarioId | undefined) || DEFAULT_SCENARIO_ID);
    if (owner !== Side.AXIS && owner !== Side.ALLIED) return; // skip neutrali (Italy)
    const stat = result.get(country) || { country, ownerSide: owner, totalCities: 0, enemyCities: 0 };
    stat.totalCities += 1;
    if (hex.features.controller && hex.features.controller !== "neutral" && hex.features.controller !== owner) {
      stat.enemyCities += 1;
    }
    result.set(country, stat);
  });
  return result;
};

// 12.1.1: applica la procedura di collapse per un country.
// Step 1: ogni reduced ground unit del country va in eliminated; ogni full ground viene reduced;
// ogni air unit del country: sortie rimosse (= 0) e va in eliminated.
// Step 2: NationalWill resettato a metà (round up) del valore iniziale.
const applyCollapseProcedure = (state: GameState, country: string, side: Side): GameState => {
  const units = new Map(state.units);
  const card = state.factionCards[side];
  const eliminatedBox = [...card.eliminatedBox];

  state.units.forEach((unit, id) => {
    if (unit.country !== country || unit.status === UnitStatus.DESTROYED) return;
    if (unit.type === UnitType.FORT) return; // forti restano
    if (unit.type === UnitType.AIR) {
      units.set(id, { ...unit, status: UnitStatus.DESTROYED, sorties: 0 });
      if (!eliminatedBox.includes(id)) eliminatedBox.push(id);
      return;
    }
    // Ground
    if (unit.reduced) {
      units.set(id, { ...unit, status: UnitStatus.DESTROYED, strength: 0 });
      if (!eliminatedBox.includes(id)) eliminatedBox.push(id);
    } else {
      units.set(id, { ...unit, reduced: true, strength: Math.ceil(unit.maxStrength / 2) });
    }
  });

  // Reset NW a metà del valore iniziale
  const initialWill = card.countryInitialNationalWill?.[country];
  const newWill = typeof initialWill === "number" ? Math.ceil(initialWill / 2) : card.nationalWill[country];

  const factionCards: GameState["factionCards"] = {
    ...state.factionCards,
    [side]: {
      ...card,
      eliminatedBox,
      nationalWill: { ...card.nationalWill, [country]: newWill ?? null },
      countryStatus: { ...(card.countryStatus || {}), [country]: "collapsed" }
    }
  };

  return { ...state, units, factionCards };
};

// 12.1.2: Conquered Country — rimuovi tutte le unità del paese, marca country come conquered.
const applyConqueredCountry = (state: GameState, country: string, side: Side): GameState => {
  const units = new Map(state.units);
  state.units.forEach((unit, id) => {
    if (unit.country !== country) return;
    units.delete(id);
  });
  const card = state.factionCards[side];
  const factionCards: GameState["factionCards"] = {
    ...state.factionCards,
    [side]: {
      ...card,
      countryStatus: { ...(card.countryStatus || {}), [country]: "conquered" },
      // rimuovi anche eventuali id nelle box
      eliminatedBox: card.eliminatedBox.filter((id) => state.units.get(id)?.country !== country),
      mobilizationBox: card.mobilizationBox.filter((id) => state.units.get(id)?.country !== country)
    }
  };
  return { ...state, units, factionCards };
};

// 12.1: detection. Per ogni country attivo, controlla se NW=0 o tutte le città enemy controlled → collapse.
// Se collapse + almeno una città enemy + enemy ground unit nel country → conquered.
// Helper: ritorna true se nel country c'è almeno un'unità ground enemy
const hasEnemyGroundInCountry = (state: GameState, country: string, ownerSide: Side): boolean => {
  const enemySide = ownerSide === Side.AXIS ? Side.ALLIED : Side.AXIS;
  return Array.from(state.units.values()).some(
    (u) =>
      u.side === enemySide &&
      u.status !== UnitStatus.DESTROYED &&
      u.type !== UnitType.AIR &&
      u.type !== UnitType.FORT &&
      state.map.get(coordKey(u.position))?.features.country === country
  );
};

export const checkCountryCollapses = (state: GameState): GameState => {
  let result = state;

  ([Side.AXIS, Side.ALLIED] as Side[]).forEach((side) => {
    const initialCard = result.factionCards[side];
    Object.keys(initialCard.countryStatus || {}).forEach((country) => {
      // Re-leggo lo state ad ogni country (perché un collapse precedente può averlo modificato)
      const cardNow = result.factionCards[side];
      const currentStatus = cardNow.countryStatus![country];
      if (currentStatus === "conquered") return;

      const will = cardNow.nationalWill[country];
      const cityStatusMap = computeCountryCityStatus(result);
      const cityStat = cityStatusMap.get(country);

      const willZero = will === 0;
      const allCitiesEnemy = cityStat ? (cityStat.totalCities > 0 && cityStat.enemyCities === cityStat.totalCities) : false;

      // Per già-collapsed: verifichiamo solo upgrade a conquered.
      // Per active: trigger di collapse + eventuale conquered.
      if (currentStatus === "active") {
        if (!willZero && !allCitiesEnemy) return;
        result = applyCollapseProcedure(result, country, side);
      }

      // Conquest check (vale per active appena collassato, e per collapsed esistente).
      const enemyCitiesPresent = (cityStat?.enemyCities || 0) > 0;
      if (enemyCitiesPresent && hasEnemyGroundInCountry(result, country, side)) {
        const enemySide = side === Side.AXIS ? Side.ALLIED : Side.AXIS;
        result = applyConqueredCountry(result, country, side);
        result = {
          ...result,
          history: [
            { type: ActionType.HOLD, side: enemySide, note: `${country} CONQUERED.`, timestamp: new Date() },
            ...result.history
          ]
        };
      } else if (currentStatus === "active") {
        // Solo nota di collapse senza conquest
        result = {
          ...result,
          history: [
            { type: ActionType.HOLD, side, note: `${country} collapsed (NW=${willZero ? 0 : will}, all-cities-enemy=${allCitiesEnemy}).`, timestamp: new Date() },
            ...result.history
          ]
        };
      }
    });
  });

  // 12.0 / 11.1: dopo ogni collapse/conquest detection, valuta anche le condizioni di vittoria.
  return evaluateVictory(result);
};

// 11.1 Victory Check
// Conditions per France 1940:
// - Axis vince se France è "conquered"
// - Allied vince se siamo all'ultimo turno (scenarioEndsTurn) senza Axis victory
export const evaluateVictory = (state: GameState): GameState => {
  if (state.victory) return state; // già determinata

  if (isFna1942Scenario(state.scenarioId) && state.phase === GamePhase.VICTORY_CHECK) {
    const fnaCities = Array.from(state.map.values()).filter((hex) =>
      hex.features.country === "Fr.N.Africa" && Boolean(hex.features.city || hex.features.capital || hex.features.productionCenter)
    );
    const westernGroundInFna = Array.from(state.units.values()).some((unit) => {
      if (unit.side !== Side.ALLIED || unit.status === UnitStatus.DESTROYED || unit.type === UnitType.AIR || unit.type === UnitType.FORT) return false;
      const hex = state.map.get(coordKey(unit.position));
      return hex?.features.country === "Fr.N.Africa";
    });
    const allFnaCitiesWestern = fnaCities.length > 0 && fnaCities.every((hex) => hex.features.controller === Side.ALLIED);

    if (!westernGroundInFna) {
      return {
        ...state,
        victory: { winner: Side.AXIS, reason: "No Western ground unit is in French North Africa during Victory Check." },
        history: [
          { type: ActionType.HOLD, side: Side.AXIS, note: "AXIS VICTORY: no Western ground unit is in French North Africa.", timestamp: new Date() },
          ...state.history
        ]
      };
    }
    if (allFnaCitiesWestern) {
      return {
        ...state,
        victory: { winner: Side.ALLIED, reason: "Western controls all French North Africa cities." },
        history: [
          { type: ActionType.HOLD, side: Side.ALLIED, note: "WESTERN VICTORY: all French North Africa cities are under Western control.", timestamp: new Date() },
          ...state.history
        ]
      };
    }
    const endTurn = state.scenarioEndsTurn ?? 8;
    if (state.turn >= endTurn) {
      const axisHeld = fnaCities.filter((hex) => hex.features.controller !== Side.ALLIED).length;
      return {
        ...state,
        victory: { winner: Side.AXIS, reason: `Western does not control all French North Africa cities at scenario end (${axisHeld} not Western-controlled).` },
        history: [
          { type: ActionType.HOLD, side: Side.AXIS, note: `AXIS VICTORY: ${axisHeld} French North Africa cities remain outside Western control.`, timestamp: new Date() },
          ...state.history
        ]
      };
    }
  }

  if (state.scenarioId === "balkans1941" && state.phase === GamePhase.VICTORY_CHECK) {
    const statuses = state.factionCards[Side.ALLIED].countryStatus || {};
    const axisWins = statuses.Greece === "conquered" && statuses.Yugoslavia === "conquered";
    const endTurn = state.scenarioEndsTurn ?? 2;
    if (axisWins) {
      return {
        ...state,
        victory: { winner: Side.AXIS, reason: "Greece and Yugoslavia conquered." },
        history: [
          { type: ActionType.HOLD, side: Side.AXIS, note: "AXIS VICTORY: Greece and Yugoslavia conquered.", timestamp: new Date() },
          ...state.history
        ]
      };
    }
    if (state.turn >= endTurn) {
      return {
        ...state,
        victory: { winner: Side.ALLIED, reason: "Scenario end reached without conquest of both Greece and Yugoslavia." },
        history: [
          { type: ActionType.HOLD, side: Side.ALLIED, note: "WESTERN VICTORY: Greece and Yugoslavia were not both conquered.", timestamp: new Date() },
          ...state.history
        ]
      };
    }
  }

  if (state.scenarioId === "france1944" && state.phase === GamePhase.VICTORY_CHECK) {
    const axisControlledCities = Array.from(state.map.values()).filter((hex) => {
      const country = hex.features.country;
      if (!country || !["Belgium", "Netherlands", "France"].includes(country)) return false;
      if (!(hex.features.city || hex.features.capital)) return false;
      return hex.features.controller === Side.AXIS;
    }).length;

    if (axisControlledCities <= 6) {
      return {
        ...state,
        victory: { winner: Side.ALLIED, reason: `Axis controls ${axisControlledCities} cities in Belgium, Netherlands, Occupied France, and Vichy.` },
        history: [
          { type: ActionType.HOLD, side: Side.ALLIED, note: `ALLIED VICTORY: Axis controls ${axisControlledCities} cities.`, timestamp: new Date() },
          ...state.history
        ]
      };
    }

    const endTurn = state.scenarioEndsTurn ?? 4;
    if (state.turn >= endTurn) {
      return {
        ...state,
        victory: { winner: Side.AXIS, reason: `Axis controls ${axisControlledCities} cities at scenario end.` },
        history: [
          { type: ActionType.HOLD, side: Side.AXIS, note: `AXIS VICTORY: Axis controls ${axisControlledCities} cities at scenario end.`, timestamp: new Date() },
          ...state.history
        ]
      };
    }
  }

  if (isItaly1943Scenario(state.scenarioId) && state.phase === GamePhase.VICTORY_CHECK) {
    const mapId = scenarioById(state.scenarioId).mapId;
    const isCity = (hex: Hex) => Boolean(hex.features.city || hex.features.capital);
    const italyCities = Array.from(state.map.values()).filter((hex) => hex.features.country === "Italy" && isCity(hex));
    const axisControlledItalianCities = italyCities.filter((hex) => hex.features.controller !== Side.ALLIED).length;
    const westernControlsCityOutsideFna = Array.from(state.map.values()).some((hex) => {
      if (!isCity(hex) || hex.features.controller !== Side.ALLIED) return false;
      return hexCodeForMap(hex.coord, mapId) !== "4622";
    });
    const surpriseUsed = state.history.some((entry) => (entry.note || "").toLowerCase().includes("surprise attack"));
    const postJune44 = state.turnCode === "Jun-44" || state.turnCode === "Jul-44" || state.turnCode === "Aug-44" || state.turnCode === "Sep-44";
    const westernThreshold = postJune44 && surpriseUsed ? 3 : 4;

    if (state.turn >= 2 && !westernControlsCityOutsideFna) {
      return {
        ...state,
        victory: { winner: Side.AXIS, reason: "Western controls no city outside French North Africa from Sep-43 onward." },
        history: [
          { type: ActionType.HOLD, side: Side.AXIS, note: "AXIS VICTORY: Western controls no city outside French North Africa.", timestamp: new Date() },
          ...state.history
        ]
      };
    }

    if (axisControlledItalianCities <= westernThreshold) {
      return {
        ...state,
        victory: { winner: Side.ALLIED, reason: `Axis controls ${axisControlledItalianCities} cities in Italy/Sardinia/Sicily.` },
        history: [
          { type: ActionType.HOLD, side: Side.ALLIED, note: `WESTERN VICTORY: Axis controls ${axisControlledItalianCities} Italian cities.`, timestamp: new Date() },
          ...state.history
        ]
      };
    }

    const endTurn = state.scenarioEndsTurn ?? 14;
    if (state.turn >= endTurn) {
      return {
        ...state,
        victory: { winner: Side.AXIS, reason: `Axis controls ${axisControlledItalianCities} Italian cities at scenario end.` },
        history: [
          { type: ActionType.HOLD, side: Side.AXIS, note: `AXIS VICTORY: Axis controls ${axisControlledItalianCities} Italian cities at scenario end.`, timestamp: new Date() },
          ...state.history
        ]
      };
    }
  }

  // Scenari fan-made Barbarossa / Russia (non presenti nel gioco originale):
  // condizioni come descritte nelle regole speciali dello scenario.
  if (isBarbarossa1941Scenario(state.scenarioId)) {
    const alliedCard = state.factionCards[Side.ALLIED];
    const ussrStatus = alliedCard.countryStatus?.USSR;
    if (ussrStatus === "conquered" || ussrStatus === "collapsed") {
      return {
        ...state,
        victory: { winner: Side.AXIS, reason: "USSR collapsed." },
        history: [
          { type: ActionType.HOLD, side: Side.AXIS, note: "AXIS VICTORY: l'URSS è collassata.", timestamp: new Date() },
          ...state.history
        ]
      };
    }

    if (state.scenarioId === "russia19411944") {
      // "La fazione sovietica vince se ci sono meno di 4 unità terrestri
      // tedesche nell'URSS." La condizione descrive i tedeschi RICACCIATI fuori:
      // a inizio scenario le armate sono ancora schierate al confine (una sola
      // dentro l'URSS), quindi si attiva solo dopo che l'invasione è avvenuta.
      const germansInUssr = Array.from(state.units.values()).filter((unit) => {
        if (unit.side !== Side.AXIS || unit.country !== "Germany") return false;
        if (unit.type === UnitType.AIR || unit.type === UnitType.FORT) return false;
        if (unit.status === UnitStatus.DESTROYED || unit.mapPresence === "off_map") return false;
        return state.map.get(coordKey(unit.position))?.features.country === "USSR";
      }).length;

      const invaded = state.axisInvadedUssr || germansInUssr >= AXIS_INVASION_FOOTHOLD;
      if (invaded && germansInUssr < AXIS_INVASION_FOOTHOLD) {
        return {
          ...state,
          axisInvadedUssr: true,
          victory: { winner: Side.ALLIED, reason: `Only ${germansInUssr} German ground units left in the USSR.` },
          history: [
            { type: ActionType.HOLD, side: Side.ALLIED, note: `SOVIET VICTORY: restano ${germansInUssr} unità terrestri tedesche in URSS.`, timestamp: new Date() },
            ...state.history
          ]
        };
      }
      if (invaded && !state.axisInvadedUssr) state = { ...state, axisInvadedUssr: true };
    } else {
      // Barbarossa 1941: "L'Asse vince se la National Will sovietica scende
      // sotto 45 alla Victory Check finale; altrimenti vince l'URSS."
      const ussrWill = alliedCard.nationalWill?.USSR;
      if (typeof ussrWill === "number" && ussrWill < BARBAROSSA_SOVIET_WILL_THRESHOLD) {
        return {
          ...state,
          victory: { winner: Side.AXIS, reason: `Soviet National Will down to ${ussrWill}.` },
          history: [
            { type: ActionType.HOLD, side: Side.AXIS, note: `AXIS VICTORY: National Will sovietica a ${ussrWill}.`, timestamp: new Date() },
            ...state.history
          ]
        };
      }
    }

    const russiaEndTurn = state.scenarioEndsTurn ?? (state.scenarioId === "russia19411944" ? 43 : 7);
    if (state.turn >= russiaEndTurn && state.phase === GamePhase.VICTORY_CHECK) {
      const winner = state.scenarioId === "russia19411944" ? Side.AXIS : Side.ALLIED;
      const reason = winner === Side.AXIS
        ? "Soviet faction did not achieve its victory conditions."
        : "Soviet National Will held above the Axis threshold.";
      return {
        ...state,
        victory: { winner, reason },
        history: [
          { type: ActionType.HOLD, side: winner, note: `${winner === Side.AXIS ? "AXIS" : "SOVIET"} VICTORY: ${reason}`, timestamp: new Date() },
          ...state.history
        ]
      };
    }
    return state;
  }

  // Axis victory (France 1940/1941, Playbook 21.3.1 e 21.4.1): l'Asse vince se
  // Belgio, Francia e Paesi Bassi sono TUTTI conquistati, non la sola Francia.
  const alliedStatus = state.factionCards[Side.ALLIED].countryStatus ?? {};
  const lowCountriesScenario = state.scenarioId === undefined ||
    state.scenarioId === "france1940" || state.scenarioId === "france1941";
  const requiredConquests = lowCountriesScenario
    ? ["Belgium", "France", "Netherlands"].filter((country) => country in alliedStatus)
    : ["France"];
  const allConquered = requiredConquests.length > 0 &&
    requiredConquests.every((country) => alliedStatus[country] === "conquered");
  if (allConquered) {
    const label = requiredConquests.join(", ");
    return {
      ...state,
      victory: { winner: Side.AXIS, reason: `${label} conquered.` },
      history: [
        { type: ActionType.HOLD, side: Side.AXIS, note: `AXIS VICTORY: ${label} conquered.`, timestamp: new Date() },
        ...state.history
      ]
    };
  }

  // Allied victory: ultimo turno e Axis non ha vinto
  const endTurn = state.scenarioEndsTurn ?? 8;
  if (state.turn >= endTurn && state.phase === GamePhase.VICTORY_CHECK) {
    return {
      ...state,
      victory: { winner: Side.ALLIED, reason: "Scenario end reached without Axis conquest of France." },
      history: [
        { type: ActionType.HOLD, side: Side.ALLIED, note: "ALLIED VICTORY: scenario ends.", timestamp: new Date() },
        ...state.history
      ]
    };
  }

  return state;
};

// ============ 8.1 REPLACEMENTS ============

// Player Aid Sheet — costo PP per replacement
export const replacementCostFor = (unit: Unit): number => {
  if (unit.type === UnitType.AIR) return unit.bomber ? 4 : 3;
  if (unit.type === UnitType.ARMOR || unit.type === UnitType.CAVALRY) return 2;
  return 1; // leg ground (infantry, artillery, support)
};

// 8.1.1: Full Supply, no Strategic Move, non già migliorata in questo turno
export const canReceiveReplacement = (state: GameState, unit: Unit): boolean => {
  if (state.phase !== GamePhase.REPLACEMENTS) return false;
  if (unit.side !== state.currentSide) return false;
  if (unit.status === UnitStatus.DESTROYED) return false;
  if (unit.type === UnitType.FORT) return false;
  if (unit.strategicMove) return false; // 4.1.2 / 8.1.1
  if (unit.improvedThisTurn) return false;
  if (supplyStateOf(unit) !== SupplyState.FULL) return false;
  if (unit.type === UnitType.AIR) {
    if ((unit.sorties || 0) === 0) return false; // niente da rimuovere
    return true;
  }
  // ground
  return Boolean(unit.reduced); // 8.1: solo reduced units possono essere flippate a full
};

// 8.1: applica replacement. Per ground: flip reduced→full. Per air: rimuove fino a 2 sortie.
export const applyReplacement = (state: GameState, unitId: string): GameState | null => {
  const unit = state.units.get(unitId);
  if (!unit || !canReceiveReplacement(state, unit)) return null;

  const cost = replacementCostFor(unit);
  const card = state.factionCards[unit.side];
  const country = replacementProductionCountry(state.scenarioId, unit);
  const currentPP = card.productionPoints[country];
  // 9.1.1: NA = illimitato
  if (currentPP !== null && (currentPP === undefined || currentPP < cost)) return null;

  const factionCards = currentPP === null ? state.factionCards : {
    ...state.factionCards,
    [unit.side]: {
      ...card,
      productionPoints: { ...card.productionPoints, [country]: (currentPP || 0) - cost }
    }
  };

  const units = new Map(state.units);
  let note: string;
  if (unit.type === UnitType.AIR) {
    const removed = Math.min(2, unit.sorties || 0);
    units.set(unitId, {
      ...unit,
      sorties: (unit.sorties || 0) - removed,
      improvedThisTurn: true
    });
    note = `${unit.name} replacement: removed ${removed} sortie(s) for ${cost} PP.`;
  } else {
    units.set(unitId, {
      ...unit,
      reduced: false,
      strength: unit.maxStrength,
      improvedThisTurn: true
    });
    note = `${unit.name} replacement: flipped to full strength for ${cost} PP.`;
  }

  const action: GameAction = {
    type: ActionType.HOLD,
    side: unit.side,
    unitId,
    note,
    timestamp: new Date()
  };

  return {
    ...state,
    units,
    factionCards,
    history: [action, ...state.history],
    timestamp: new Date()
  };
};

// ============ 8.2 MOBILIZATION ============

// Player Aid: 1 leg, 2 mobile, 3 fighter (bomber non listato → trattiamo come 4)
export const mobilizationCostFor = (unit: Unit): number => {
  if (unit.type === UnitType.AIR) return unit.bomber ? 4 : 3;
  if (unit.type === UnitType.ARMOR || unit.type === UnitType.CAVALRY) return 2;
  return 1;
};

// 8.2.1: friendly city del proprio paese; per USA anche città UK; UK/USA può andare in Map Box (non modellato)
const isLegalMobilizationLocation = (state: GameState, unit: Unit, coord: HexCoord): boolean => {
  const hex = state.map.get(coordKey(coord));
  if (!hex) return false;
  if (hex.features.prohibited) return false;
  const isGermanItalyMobilization = unit.country === "Germany" && isGermanItalyMobilizationHex(state, coord);
  const isWesternItalyMobilization = isWesternItalyMobilizationHex(state, unit, hex);
  const isBarbarossaGermanMob = isBarbarossaGermanMobilizationHex(state, unit, coord);
  if (!isGermanItalyMobilization && !isWesternItalyMobilization && !isBarbarossaGermanMob && !(hex.features.city || hex.features.capital)) return false;

  // hex deve essere "friendly" (controller stesso side o non settato)
  const friendlyControlled = hex.features.controller === undefined || hex.features.controller === unit.side;
  if (!friendlyControlled) return false;

  if (isBarbarossaGermanMob) {
    // West-edge transport line hexes are always valid for German mobilization regardless of country label
  } else {
  const country = hex.features.country;
  if (!country) return false;
  if (isGermanItalyMobilization) {
    if (country !== "Italy" && country !== "Yugoslavia") return false;
  } else if (isWesternItalyMobilization) {
    if (country !== "France") return false;
  } else {
  // USA può anche andare in città UK
    if (unit.country === "USA" && country === "UK") return true;
  // Altrimenti, paese deve coincidere
    if (country !== unit.country) return false;
  }
  }

  // 8.2: stacking — può occupare un fort, ma non violare stacking ground (1 ground per hex)
  const groundOccupant = getGroundUnitOnHex(state, coord);
  if (groundOccupant) return false;

  // Una mobilization ground non può essere fatta in hex con air nemica.
  // (Le air vanno displaced 4.2.3.7 ma non gestiamo qui — semplicemente vietiamo).
  if (unit.type !== UnitType.AIR) {
    const enemyAirHere = Array.from(state.units.values()).some(
      (u) =>
        u.type === UnitType.AIR &&
        u.status !== UnitStatus.DESTROYED &&
        u.side !== unit.side &&
        sameCoord(u.position, coord)
    );
    if (enemyAirHere) return false;
  }

  return true;
};

const mobilizedMapPresenceFor = (state: GameState): Unit["mapPresence"] =>
  scenarioById(state.scenarioId).mapId === "france" ? "france" : "france";

// Lista di hex valide per mobilization
export const legalMobilizationHexes = (state: GameState, unit: Unit): HexCoord[] => {
  const result: HexCoord[] = [];
  // Diagnostica: per ogni hex città del proprio country, dico perché viene rifiutata.
  const targetCountry = unit.country || "";
  const cities: { coord: HexCoord; reason: string }[] = [];
  state.map.forEach((hex) => {
    const isGermanItalyCandidate = targetCountry === "Germany" && isItaly1943Scenario(state.scenarioId) &&
      (hex.features.country === "Italy" || hex.features.country === "Yugoslavia");
    const isWesternItalyCandidate = isWesternItalyMobilizationHex(state, unit, hex);
    const isBarbarossaGermanCandidate = isBarbarossaGermanMobilizationHex(state, unit, hex.coord);
    if (!isGermanItalyCandidate && !isWesternItalyCandidate && !isBarbarossaGermanCandidate && !(hex.features.city || hex.features.capital)) return;
    if (!isGermanItalyCandidate && !isWesternItalyCandidate && !isBarbarossaGermanCandidate && hex.features.country !== targetCountry && !(unit.country === "USA" && hex.features.country === "UK")) return;

    const reasons: string[] = [];
    if (hex.features.prohibited) reasons.push("prohibited");
    const friendlyControlled = hex.features.controller === undefined || hex.features.controller === unit.side;
    if (!friendlyControlled) reasons.push(`controller=${hex.features.controller}`);
    if (isGermanItalyCandidate && !isGermanItalyMobilizationHex(state, hex.coord)) reasons.push("not German Italy USS/adjacent");
    if (isWesternItalyCandidate && !(hex.railEdges || []).length) reasons.push("not French North Africa transport line");
    const groundOccupant = getGroundUnitOnHex(state, hex.coord);
    if (groundOccupant) reasons.push(`stacked: ${groundOccupant.name}`);

    if (reasons.length === 0 && isLegalMobilizationLocation(state, unit, hex.coord)) {
      result.push(hex.coord);
      cities.push({ coord: hex.coord, reason: "OK" });
    } else {
      cities.push({ coord: hex.coord, reason: reasons.join(", ") || "unknown" });
    }
  });
  return result;
};

export const canMobilizeToCentralMedBox = (state: GameState, unit: Unit): boolean =>
  state.phase === GamePhase.MOBILIZATION &&
  isItaly1943Scenario(state.scenarioId) &&
  unit.side === Side.ALLIED &&
  (unit.country === "UK" || unit.country === "USA") &&
  unit.status === UnitStatus.DESTROYED &&
  (state.factionCards[unit.side].mobilizationBox || []).includes(unit.id);

const applyMobilizationCost = (state: GameState, unit: Unit): { factionCards: GameState["factionCards"]; cost: number } | null => {
  const card = state.factionCards[unit.side];
  if (unit.freeMobilization) {
    return {
      cost: 0,
      factionCards: {
        ...state.factionCards,
        [unit.side]: { ...card, mobilizationBox: card.mobilizationBox.filter((id) => id !== unit.id) }
      }
    };
  }
  const cost = mobilizationCostFor(unit);
  const country = productionCountryFor(unit);
  const currentPP = card.productionPoints[country];
  if (currentPP !== null && (currentPP === undefined || currentPP < cost)) return null;
  return {
    cost,
    factionCards: {
      ...state.factionCards,
      [unit.side]: {
        ...card,
        mobilizationBox: card.mobilizationBox.filter((id) => id !== unit.id),
        productionPoints: currentPP === null ? card.productionPoints : { ...card.productionPoints, [country]: (currentPP || 0) - cost }
      }
    }
  };
};

// 8.2: piazza unità dalla Mobilization box sulla mappa pagando PP.
// L'unità arriva: ground reduced o air con 4 sortie.
export const mobilizeUnit = (state: GameState, unitId: string, target: HexCoord): GameState | null => {
  if (state.phase !== GamePhase.MOBILIZATION) return null;
  const unit = state.units.get(unitId);
  if (!unit) return null;
  if (unit.side !== state.currentSide) return null;
  if (unit.status !== UnitStatus.DESTROYED) return null; // mobilization riguarda unità nella mob box (modellate come DESTROYED + nella card)

  const card = state.factionCards[unit.side];
  if (!card.mobilizationBox.includes(unitId)) return null;
  if (!isLegalMobilizationLocation(state, unit, target)) return null;

  const paid = applyMobilizationCost(state, unit);
  if (!paid) return null;
  const { factionCards, cost } = paid;

  const units = new Map(state.units);
  if (unit.type === UnitType.AIR) {
    units.set(unitId, {
      ...unit,
      status: UnitStatus.READY,
      position: target,
      mapPresence: mobilizedMapPresenceFor(state),
      sorties: 4, // 8.2: air entra con 4 sortie usate
      moved: false,
      activated: false,
      reduced: false,
      strength: unit.maxStrength,
      improvedThisTurn: false
    });
  } else {
    units.set(unitId, {
      ...unit,
      status: UnitStatus.READY,
      position: target,
      mapPresence: mobilizedMapPresenceFor(state),
      reduced: true, // 8.2: ground entra reduced
      strength: Math.ceil(unit.maxStrength / 2),
      moved: false,
      activated: false,
      movementSpent: 0,
      improvedThisTurn: false
    });
  }

  const action: GameAction = {
    type: ActionType.MOVE,
    side: unit.side,
    unitId,
    toPos: target,
    note: `${unit.name} mobilized at ${hexCodeForMap(target, scenarioById(state.scenarioId).mapId)} for ${cost} PP.`,
    timestamp: new Date()
  };

  return {
    ...state,
    units,
    factionCards,
    history: [action, ...state.history],
    timestamp: new Date()
  };
};

export const mobilizeUnitToCentralMedBox = (state: GameState, unitId: string): GameState | null => {
  const unit = state.units.get(unitId);
  if (!unit || !canMobilizeToCentralMedBox(state, unit)) return null;
  const paid = applyMobilizationCost(state, unit);
  if (!paid) return null;
  const { factionCards, cost } = paid;
  const units = new Map(state.units);
  units.set(unitId, unit.type === UnitType.AIR
    ? {
      ...unit,
      status: UnitStatus.READY,
      position: { q: -97, r: -97 },
      mapPresence: "central_med",
      sorties: 4,
      moved: false,
      activated: false,
      reduced: false,
      strength: unit.maxStrength,
      improvedThisTurn: false
    }
    : {
      ...unit,
      status: UnitStatus.READY,
      position: { q: -97, r: -97 },
      mapPresence: "central_med",
      reduced: true,
      strength: Math.ceil(unit.maxStrength / 2),
      moved: false,
      activated: false,
      movementSpent: 0,
      improvedThisTurn: false
    });

  return {
    ...state,
    units,
    factionCards,
    history: [
      {
        type: ActionType.MOVE,
        side: unit.side,
        unitId,
        note: `${unit.name} mobilized in Central Mediterranean Box for ${cost} PP.`,
        timestamp: new Date()
      },
      ...state.history
    ],
    timestamp: new Date()
  };
};

// Sincronizza: tutte le unità DESTROYED non ancora nelle box vengono messe nell'eliminatedBox del loro side.
// Va chiamata dopo combat / no-supply attrition.
const collectEliminatedIntoBox = (state: GameState): GameState => {
  const factionCards = { ...state.factionCards };
  let changed = false;
  state.units.forEach((unit) => {
    if (unit.status !== UnitStatus.DESTROYED) return;
    if (unit.type === UnitType.FORT) return; // fort distrutti non vanno in box
    if (
      isFna1942Scenario(state.scenarioId) &&
      unit.side === Side.AXIS &&
      unit.type !== UnitType.AIR &&
      (unit.country === "Germany" || unit.country === "Italy")
    ) {
      return; // FNA: German/Italian ground units are removed from the scenario.
    }
    // Rinforzo programmato: non raccogliere prima del turno di entrata
    if (unit.entryTurn !== undefined && unit.entryTurn > state.turn) return;
    const card = factionCards[unit.side];
    if (card.eliminatedBox.includes(unit.id) || card.mobilizationBox.includes(unit.id)) return;
    factionCards[unit.side] = {
      ...card,
      eliminatedBox: [...card.eliminatedBox, unit.id]
    };
    changed = true;
  });
  return changed ? { ...state, factionCards } : state;
};

// 11.2 step 2: muove tutte le unità dall'Eliminated box alla Mobilization box.
const promoteEliminatedFactionCards = (cards: GameState["factionCards"]): GameState["factionCards"] => {
  const next = { ...cards };
  ([Side.AXIS, Side.ALLIED] as Side[]).forEach((side) => {
    const card = next[side];
    if (!card.eliminatedBox.length) return;
    next[side] = {
      ...card,
      mobilizationBox: [...card.mobilizationBox, ...card.eliminatedBox],
      eliminatedBox: []
    };
  });
  return next;
};

// ============ 4.1 STRATEGIC MOVEMENT ============

// 4.1: Strategic Move richiede Full Supply
const isFullySupplied = (unit: Unit): boolean =>
  unit.status !== UnitStatus.DESTROYED && supplyStateOf(unit) === SupplyState.FULL;

const hexHasTransportLine = (hex: Hex): boolean => (hex.railEdges || []).length > 0;

const isFortHex = (state: GameState, coord: HexCoord): boolean =>
  Array.from(state.units.values()).some(
    (u) => u.type === UnitType.FORT && u.status !== UnitStatus.DESTROYED && sameCoord(u.position, coord)
  );

const isEnemyControlledCity = (hex: Hex, movingSide: Side): boolean => {
  const isCity = hex.features.city || hex.features.capital;
  if (!isCity) return false;
  return hex.features.controller !== undefined && hex.features.controller !== movingSide && hex.features.controller !== "neutral";
};

// 4.1.2: la destinazione/transito è valida per Strategic Move?
const isStrategicHexLegal = (state: GameState, coord: HexCoord, movingSide: Side, unit: Unit): boolean => {
  const hex = state.map.get(coordKey(coord));
  if (!hex) return false;
  if (hex.features.prohibited) return false;
  if (isGroundMovementProhibited(state, coord, unit)) return false;
  if (isEnemyControlledCity(hex, movingSide)) return false;
  if (isFortHex(state, coord)) return false;
  if (isEnemyZoc(state, coord, movingSide)) return false;
  const occupant = getUnitOnHex(state, coord);
  if (occupant && occupant.side !== movingSide) return false;
  return true;
};

// Restituisce le hex raggiungibili in Strategic Move via Transport Line contigua.
export const calculateStrategicReachableHexes = (state: GameState, unit: Unit): HexCoord[] => {
  if (!canStrategicMove(state, unit)) return [];
  const start = unit.position;
  const visited = new Set<string>([coordKey(start)]);
  const reachable: HexCoord[] = [];
  const frontier: HexCoord[] = [start];

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;

    HEX_SIDES.forEach((side) => {
      const next = neighborForSide(current, side);
      const key = coordKey(next);
      if (visited.has(key)) return;
      if (!isInsideMap(state, next)) return;
      if (state.impassableEdges.has(edgeKey(current, next))) return;
      if (!hasTransportLineThroughSide(state, current, next)) return;
      if (!isStrategicHexLegal(state, next, unit.side, unit)) return;

      visited.add(key);
      reachable.push(next);
      frontier.push(next);
    });
  }

  return reachable;
};

export const canStrategicMove = (state: GameState, unit: Unit): boolean => {
  if (state.phase !== GamePhase.STRATEGIC_MOVEMENT) return false;
  if (unit.side !== state.currentSide) return false;
  if (unit.status === UnitStatus.DESTROYED) return false;
  if (unit.type === UnitType.FORT) return false;
  if (!isFullySupplied(unit)) return false;
  if (state.strategicMoveUsed?.[unit.side]) return false; // un solo marker per fazione per turno (4.1)
  // L'unità deve trovarsi su una hex con Transport Line per essere eleggibile (4.1 step 2)
  const startHex = state.map.get(coordKey(unit.position));
  if (!startHex || !hexHasTransportLine(startHex)) return false;
  return true;
};

export const executeStrategicMove = (state: GameState, unitId: string, to: HexCoord): GameState | null => {
  const unit = state.units.get(unitId);
  if (!unit || !canStrategicMove(state, unit)) return null;

  const reachable = calculateStrategicReachableHexes(state, unit);
  if (!reachable.some((c) => sameCoord(c, to))) return null;

  // Step 1: rimuovere marker da qualsiasi unità della fazione che lo aveva dal turno precedente
  const units = new Map<string, Unit>();
  state.units.forEach((u, id) => {
    if (u.side === unit.side && u.strategicMove && id !== unitId) {
      units.set(id, { ...u, strategicMove: false });
    } else {
      units.set(id, u);
    }
  });

  // Step 2: piazzare marker sull'unità che si muove e spostarla
  units.set(unitId, { ...unit, position: to, strategicMove: true, occupyingFort: false });

  const action: GameAction = {
    type: ActionType.MOVE,
    side: unit.side,
    unitId,
    fromPos: unit.position,
    toPos: to,
    note: `${unit.name} strategic move to ${hexCodeFor(to)}.`,
    timestamp: new Date()
  };

  return {
    ...state,
    units,
    strategicMoveUsed: { ...(state.strategicMoveUsed || {}), [unit.side]: true },
    history: [action, ...state.history],
    timestamp: new Date()
  };
};

// Strategic Move event: consume the marker from eventsBox and reset
// strategicMoveUsed so the side can perform an additional strategic move
// this turn. Returns null if the event cannot be played right now.
export const playStrategicMoveEvent = (state: GameState, side: Side, markerId: string): GameState | null => {
  if (state.phase !== GamePhase.STRATEGIC_MOVEMENT) return null;
  if (state.currentSide !== side) return null;
  const eventsBox = state.factionCards[side].eventsBox;
  if (!eventsBox.includes(markerId)) return null;
  const nextStrategicMoveUsed = { ...(state.strategicMoveUsed || {}) };
  delete nextStrategicMoveUsed[side];
  const next: GameState = {
    ...state,
    factionCards: {
      ...state.factionCards,
      [side]: {
        ...state.factionCards[side],
        eventsBox: eventsBox.filter((id) => id !== markerId)
      }
    },
    strategicMoveUsed: nextStrategicMoveUsed,
    history: [
      { type: ActionType.HOLD, side, note: `${markerId} giocato: movimento strategico extra.`, timestamp: new Date() },
      ...state.history
    ],
    timestamp: new Date()
  };
  return addEventReturnEntries(next, [eventReturnEntry(next, side, markerId, rollD6())]);
};

// Soviet Counterattack: l'URSS gioca il marker durante le Operazioni Asse per poter attivare
// una propria unità. Il flag sovietCounterattackActive permette al lato ALLIED di agire
// finché non esegue una singola attivazione (o la rinuncia).
export const playSovietCounterattackEvent = (state: GameState, markerId: string): GameState | null => {
  if (!isBarbarossa1941Scenario(state.scenarioId)) return null;
  if (state.phase !== GamePhase.OPERATIONS || state.subPhase !== GameSubPhase.ACTIONS) return null;
  if (state.currentSide !== Side.AXIS) return null; // può giocarsi solo durante le Operazioni Asse
  if (state.sovietCounterattackActive) return null; // già attivo
  const eventsBox = state.factionCards[Side.ALLIED].eventsBox;
  const marker = markerId
    ? (eventsBox.includes(markerId) ? markerId : null)
    : eventsBox.find((id) => id.toLowerCase().includes("counterattack"));
  if (!marker) return null;
  return {
    ...state,
    sovietCounterattackActive: true,
    factionCards: {
      ...state.factionCards,
      [Side.ALLIED]: { ...state.factionCards[Side.ALLIED], eventsBox: eventsBox.filter((id) => id !== marker) }
    },
    history: [
      { type: ActionType.HOLD, side: Side.ALLIED, note: `Soviet Counterattack giocato: l'URSS può attivare una unità.`, timestamp: new Date() },
      ...state.history
    ],
    timestamp: new Date()
  };
};

// Fine contrattacco sovietico: resetta il flag e torna il turno all'Asse.
export const endSovietCounterattack = (state: GameState): GameState | null => {
  if (!state.sovietCounterattackActive) return null;
  return {
    ...state,
    sovietCounterattackActive: false,
    history: [
      { type: ActionType.HOLD, side: Side.ALLIED, note: "Soviet Counterattack completato. Operazioni Asse riprendono.", timestamp: new Date() },
      ...state.history
    ],
    timestamp: new Date()
  };
};

// Rasputitsa: l'URSS annulla un combattimento Asse in corso (pendingCombat).
// Deve essere giocata dopo che l'Asse ha designato un attacco (pendingCombat presente)
// ma prima che sia risolto.
export const playRasputitsaEvent = (state: GameState, markerId: string): GameState | null => {
  if (!isBarbarossa1941Scenario(state.scenarioId)) return null;
  if (state.phase !== GamePhase.OPERATIONS || state.subPhase !== GameSubPhase.ACTIONS) return null;
  if (!state.pendingCombat || state.pendingCombat.kind !== "commit") return null;
  const attackerId = state.pendingCombat.attackerId;
  const attacker = state.units.get(attackerId);
  if (!attacker || attacker.side !== Side.AXIS) return null;
  const eventsBox = state.factionCards[Side.ALLIED].eventsBox;
  const marker = markerId
    ? (eventsBox.includes(markerId) ? markerId : null)
    : eventsBox.find((id) => id.toLowerCase().includes("rasputitsa"));
  if (!marker) return null;

  // Ripristina le unità: rimuove il costo MP pagato per l'attacco mobile
  const defender = state.units.get(state.pendingCombat.defenderId);
  const units = new Map(state.units);
  if (attacker && defender) {
    const costPaid = attackMovementCost(state, attacker, defender.position);
    units.set(attackerId, {
      ...attacker,
      movementSpent: Math.max(0, (attacker.movementSpent || 0) - costPaid),
      moved: false,
      activated: false
    });
  }

  return {
    ...state,
    pendingCombat: undefined,
    units,
    factionCards: {
      ...state.factionCards,
      [Side.ALLIED]: { ...state.factionCards[Side.ALLIED], eventsBox: eventsBox.filter((id) => id !== marker) }
    },
    history: [
      { type: ActionType.HOLD, side: Side.ALLIED, note: `Rasputitsa giocato: l'attacco Asse è annullato.`, timestamp: new Date() },
      ...state.history
    ],
    timestamp: new Date()
  };
};

export const advanceTurn = advanceSequenceStep;

export interface SerializedGameState extends Omit<GameState, "units" | "map" | "riverEdges" | "mountainEdges" | "straitEdges" | "impassableEdges" | "timestamp"> {
  units: Unit[];
  map: Array<[string, Hex]>;
  riverEdges: string[];
  mountainEdges: string[];
  straitEdges: string[];
  impassableEdges: string[];
  timestamp: string;
}

export const serializeGameState = (state: GameState): SerializedGameState => ({
  ...state,
  units: Array.from(state.units.values()),
  map: Array.from(state.map.entries()),
  riverEdges: Array.from(state.riverEdges),
  mountainEdges: Array.from(state.mountainEdges),
  straitEdges: Array.from(state.straitEdges),
  impassableEdges: Array.from(state.impassableEdges),
  timestamp: state.timestamp.toISOString()
});

export const deserializeGameState = (state: SerializedGameState): GameState => {
  const isBarbarossa = state.scenarioId === "barbarossa1941" || state.scenarioId === "russia19411944";
  const impassableEdges = isBarbarossa
    ? new Set<string>((barbarossa1941Seed as unknown as { impassableEdges: string[] }).impassableEdges || [])
    : new Set<string>(state.impassableEdges || []);
  return {
    ...state,
    units: new Map(state.units.map((unit) => [unit.id, unit])),
    map: new Map(state.map),
    riverEdges: new Set(state.riverEdges || []),
    mountainEdges: new Set(state.mountainEdges || []),
    straitEdges: new Set(state.straitEdges || []),
    impassableEdges,
    timestamp: new Date(state.timestamp)
  };
};
