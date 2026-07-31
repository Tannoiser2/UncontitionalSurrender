/**
 * Zustand store per lo stato del gioco
 */

import { create } from "zustand";
import {
  ActionType,
  advanceSequenceStep,
  activateUnitForAction,
  airRebase,
  applyReplacement,
  attackMovementCost,
  calculateAirReachableHexes,
  calculateNavalEvacuationTargets,
  calculateNavalTransportTargets,
  coordKey,
  commitCombatEventMarker,
  confirmAirCommit,
  CountryStatus,
  getUnitsOnHex,
  legalMobilizationHexes,
  mobilizeUnit,
  mobilizeUnitToCentralMedBox,
  calculateReachableHexes,
  calculateStrategicReachableHexes,
  canCommandUnit,
  canStrategicMove,
  createFrance1940Units,
  createInitialGameState,
  createScenarioUnits,
  designateAssault,
  edgeKey,
  explainAirRebaseEndHex,
  endUnitActivation,
  amphibiousTargetsFor,
  executeAmphibiousInvasion,
  executeNavalTransport,
  executeNavalEvacuationTo,
  resolveAirStrike,
  resolveDefenderCannotRetreatChoice,
  resolveRetreatChoice,
  resolveAdvanceChoice,
  runAiOperationStep,
  executeStrategicMove,
  GameState,
  GamePhase,
  GameSubPhase,
  getUnitOnHex,
  HEX_SIDES,
  HexFeatures,
  HexCoord,
  HexSide,
  hexDistance,
  isInsideMap,
  neighborForSide,
  initiateMobileAttack,
  movementRemainingFor,
  moveUnit,
  playMapEventMarker,
  playStrategicMoveEvent,
  playSovietCounterattackEvent,
  endSovietCounterattack,
  playRasputitsaEvent,
  ReachableHex,
  resolveDesignatedAssault,
  sameCoord,
  ScenarioId,
  ScenarioMapId,
  scenarioById,
  Side,
  sideBetween,
  TerrainTag,
  TerrainType,
  Unit,
  UnitStatus,
  UnitType,
  WeatherMapCategory,
  WeatherType
} from "@uswc/shared";

export interface PrivateMapLayer {
  imageDataUrl: string | null;
  opacity: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  gridHexSize: number;
  gridHexWidth: number;
  gridHexHeight: number;
  gridColumnStep: number;
  gridRowStep: number;
  gridRowShift: number;
  gridOffsetX: number;
  gridOffsetY: number;
  gridColumns: number;
  gridShortRowColumns: number;
  gridRows: number;
  shortRowsStart: "even" | "odd";
  showGrid: boolean;
  showCountryColors: boolean;
  showProceduralTerrain: boolean;
  proceduralTerrainOpacity: number;
}

export type MapCalibration = Omit<PrivateMapLayer, "imageDataUrl">;

export interface SavedCalibration {
  id: string;
  name: string;
  calibration: MapCalibration;
  gameState?: SerializedGameState;
  updatedAt: string;
}

interface SerializedGameState extends Omit<GameState, "units" | "map" | "riverEdges" | "mountainEdges" | "straitEdges" | "impassableEdges" | "timestamp"> {
  units: Unit[];
  map: Array<[string, GameState["map"] extends Map<string, infer H> ? H : never]>;
  riverEdges: string[];
  mountainEdges?: string[];
  straitEdges?: string[];
  impassableEdges?: string[];
  timestamp: string;
}

interface ScenarioExport {
  version: 1;
  exportedAt: string;
  privateMapLayer: PrivateMapLayer;
  gameState: SerializedGameState | null;
}

const retreatMovesFor = (state: GameState): ReachableHex[] => {
  const pending = state.pendingCombat;
  if (pending?.kind !== "retreat") return [];
  const defender = state.units.get(pending.defenderId);
  if (!defender) return [];
  return pending.options
    .filter((coord) =>
      !Array.from(state.units.values()).some(
        (unit) =>
          unit.type !== UnitType.FORT &&
          unit.status !== UnitStatus.DESTROYED &&
          unit.side !== defender.side &&
          sameCoord(unit.position, coord)
      )
    )
    .map((coord) => ({ coord, cost: 0 }));
};

const commitAirMovesFor = (_state: GameState): ReachableHex[] => [];

export type AttackMode = "mobile" | "assault";
export type AirActionMode = "rebase" | "strike" | "naval" | null;
export interface MapEventPlacement {
  side: Side;
  markerId: string;
  mode?: "map" | "naval-evacuation" | "strategic-move";
  unitId?: string;
}

interface GameStore {
  gameState: GameState | null;
  combatRollbackState: GameState | null;
  selectedUnit: Unit | null;
  selectedHex: HexCoord | null;
  validMoves: ReachableHex[];
  attackMode: AttackMode;
  airActionMode: AirActionMode;
  amphibiousMode: boolean;
  mobilizingUnitId: string | null;
  mapEventPlacement: MapEventPlacement | null;
  privateMapLayer: PrivateMapLayer;
  savedCalibrations: SavedCalibration[];
  // Avviso transitorio mostrato dalla UI (es. una regola che ha cambiato
  // l'azione richiesta dal giocatore). Sostituisce i return silenziosi.
  notice: string | null;

  setNotice: (text: string | null) => void;
  setGameState: (state: GameState) => void;
  selectUnit: (unit: Unit | null) => void;
  selectHex: (hex: HexCoord | null) => void;
  setValidMoves: (moves: ReachableHex[]) => void;
  setAttackMode: (mode: AttackMode) => void;
  setAirActionMode: (mode: AirActionMode) => void;
  toggleAmphibiousMode: () => void;
  resetSelection: () => void;
  hydratePersistentScenario: () => void;
  newLocalGame: (scenarioId?: ScenarioId) => void;
  resetFrance1940Setup: () => void;
  selectWesternMedUnit: (unitId: string) => void;
  clickHex: (hex: HexCoord) => void;
  endSelectedActivation: () => void;
  resolvePendingAssaults: () => void;
  chooseRetreat: (target: HexCoord) => void;
  chooseDefenderCannotRetreat: () => void;
  chooseAdvance: (advance: boolean, attackerId?: string) => void;
  cancelPendingCombat: () => void;
  chooseAirCommit: (airUnitId: string | null) => void;
  chooseEventCommit: (markerId: string) => void;
  playEventMarker: (side: Side, markerId: string) => void;
  cancelMapEventPlacement: () => void;
  playSovietCounterattack: (markerId: string) => void;
  endSovietCounterattackAction: () => void;
  playRasputitsa: (markerId: string) => void;
  applyReplacementAction: (unitId: string) => void;
  startMobilizingUnit: (unitId: string) => void; // entra in modalità "scegli hex per mobilization"
  mobilizeUnitToCentralMed: (unitId: string) => void;
  cancelMobilizing: () => void;
  runAiStep: () => string | null;
  // force=true prosegue anche con assalti designati non risolti (5.3.3: un
  // assalto designato non deve per forza essere risolto). La UI chiede conferma.
  advanceGameSequence: (force?: boolean) => void;
  setPrivateMapImage: (imageDataUrl: string | null) => void;
  updatePrivateMapLayer: (settings: Partial<Omit<PrivateMapLayer, "imageDataUrl">>) => void;
  saveCurrentCalibration: (name: string) => void;
  loadCalibration: (id: string) => void;
  deleteCalibration: (id: string) => void;
  exportScenario: () => string;
  importScenario: (contents: string) => boolean;
  updateProductionPoints: (side: Side, country: string, points: number) => void;
  assignDefaultFrenchHexes: () => void;
  assignScenarioControl: () => void;
  updateHexTerrain: (hex: HexCoord, terrain: TerrainType) => void;
  toggleHexTerrainTag: (hex: HexCoord, terrainTag: TerrainTag) => void;
  updateHexFeatures: (hex: HexCoord, features: Partial<HexFeatures>) => void;
  toggleRailSide: (hex: HexCoord, side: HexSide) => void;
  toggleRiverEdge: (from: HexCoord, to: HexCoord) => void;
  toggleMountainEdge: (from: HexCoord, to: HexCoord) => void;
  toggleStraitEdge: (from: HexCoord, to: HexCoord) => void;
  toggleImpassableEdge: (from: HexCoord, to: HexCoord) => void;
}

const PRIVATE_MAP_STORAGE_KEY = "uswc.privateMapLayer.v1";
const CALIBRATIONS_STORAGE_KEY = "uswc.mapCalibrations.v1";
const GAME_STATE_STORAGE_KEY = "uswc.gameState.v1";
const SCENARIO_IDB_NAME = "uswc.scenarioStore.v1";
const SCENARIO_IDB_STORE = "scenario";
const SCENARIO_IDB_KEY = "current";
const FNA_CALIBRATION_VERSION = 5;
const RUSSIA_CALIBRATION_VERSION = 10;

const mapIdForScenario = (scenarioId: string | undefined): ScenarioMapId => scenarioById(scenarioId).mapId;

const initialControllerForEditorCountry = (
  country: string | undefined,
  scenarioId: ScenarioId | "procedural"
): Side | "neutral" | undefined => {
  if (!country) return undefined;
  if (scenarioId === "balkans1941") {
    if (["Germany", "Italy", "Hungary", "Romania", "Bulgaria", "Albania"].includes(country)) return Side.AXIS;
    if (["Greece", "Yugoslavia", "UK"].includes(country)) return Side.ALLIED;
    return undefined;
  }
  if (scenarioId === "france1944") {
    if (country === "Germany") return Side.AXIS;
    if (["UK", "USA"].includes(country)) return Side.ALLIED;
    if (["France", "Belgium", "Netherlands"].includes(country)) return Side.AXIS;
    if (country === "Italy") return "neutral";
    return undefined;
  }
  if (scenarioId === "italy1943" || scenarioId === "italy1943Include") {
    if (["Germany", "Italy", "Yugoslavia"].includes(country)) return Side.AXIS;
    if (["UK", "USA", "France"].includes(country)) return Side.ALLIED;
    return undefined;
  }
  if (scenarioId === "barbarossa1941") {
    if (["Germany", "Romania", "Finland", "Hungary", "Estonia", "Latvia", "Lithuania", "Poland"].includes(country)) return Side.AXIS;
    if (country === "USSR") return Side.ALLIED;
    return "neutral";
  }
  if (country === "Germany") return Side.AXIS;
  if (country === "Italy") return "neutral";
  if (["France", "Belgium", "Netherlands", "UK", "USA"].includes(country)) return Side.ALLIED;
  return undefined;
};

const privateMapStorageKeyFor = (mapId: ScenarioMapId): string => `${PRIVATE_MAP_STORAGE_KEY}.${mapId}`;

const calibrationsStorageKeyFor = (mapId: ScenarioMapId): string => `${CALIBRATIONS_STORAGE_KEY}.${mapId}`;

const currentMapIdForState = (state: GameState | null): ScenarioMapId => mapIdForScenario(state?.scenarioId);

const mapGridDefaults = (mapId: ScenarioMapId) => ({
  gridColumns: mapId === "west" ? 31 : mapId === "russia" ? 30 : 15,
  gridShortRowColumns: mapId === "west" ? 31 : mapId === "russia" ? 30 : 15,
  gridRows: mapId === "russia" ? 29 : 14,
  shortRowsStart: "odd" as const
});

const mapLayerDefaults = (mapId: ScenarioMapId): PrivateMapLayer => ({
  ...defaultPrivateMapLayer,
  ...mapGridDefaults(mapId),
  ...(mapId === "west"
    ? {
      scale: 0.4,
      offsetX: 0,
      offsetY: 0,
      gridHexWidth: 81,
      gridHexHeight: 89,
      gridColumnStep: 80,
      gridRowStep: 68,
      gridRowShift: 40,
      gridOffsetX: 100,
      gridOffsetY: 75
    }
    : mapId === "russia"
      ? {
        scale: 0.4,
        offsetX: 0,
        offsetY: 0,
        gridHexWidth: 81,
        gridHexHeight: 89,
        gridColumnStep: 80,
        gridRowStep: 68,
        gridRowShift: 41,
        gridOffsetX: 75,
        gridOffsetY: 64,
        showGrid: true
      }
      : {})
});

// Calibrazione France 1940 (estratta da Codex setup): la mappa privata reale
// è in /scenarios/france1940-map.png e viene caricata via fetchFrance1940Map().
const defaultPrivateMapLayer: PrivateMapLayer = {
  imageDataUrl: null,
  opacity: 1,
  scale: 0.4,
  offsetX: -8,
  offsetY: 1,
  gridHexSize: 45,
  gridHexWidth: 81,
  gridHexHeight: 89,
  gridColumnStep: 80,
  gridRowStep: 68,
  gridRowShift: 41,
  gridOffsetX: 75,
  gridOffsetY: 64,
  gridColumns: 15,
  gridShortRowColumns: 15,
  gridRows: 14,
  shortRowsStart: "odd",
  showGrid: false,
  showCountryColors: false,
  showProceduralTerrain: false,
  proceduralTerrainOpacity: 0.85
};

const MAP_ASSET_URLS: Partial<Record<ScenarioMapId, string>> = {
  france: "/scenarios/france1940-map.jpg",
  balkans: "/scenarios/balkans1941-map.jpg",
  italy: "/scenarios/italy1943-map.jpg",
  west: "/scenarios/fna1942-map.jpg",
  russia: "/scenarios/barbarossa1941-map.jpg"
};
const defaultHexFeatures: HexFeatures = {
  country: undefined,
  controller: undefined,
  disputedArea: undefined,
  city: false,
  port: false,
  productionCenter: false,
  capital: false,
  prohibited: false,
  fadedDot: false
};

// Carica il PNG della mappa dello scenario e lo converte in dataURL.
// Usato per popolare imageDataUrl al boot quando manca dal localStorage.
const fetchMapDataUrl = async (mapId: ScenarioMapId): Promise<string | null> => {
  const url = MAP_ASSET_URLS[mapId];
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const createGameForLayer = (layer: PrivateMapLayer, scenarioId: ScenarioId = "france1940"): GameState =>
  createInitialGameState({
    width: layer.gridColumns,
    height: layer.gridRows,
    shortRowWidth: layer.gridShortRowColumns,
    shortRowsStart: layer.shortRowsStart,
    scenario: scenarioId
  });

const serializeGameState = (state: GameState): SerializedGameState => ({
  ...state,
  units: Array.from(state.units.values()),
  map: Array.from(state.map.entries()),
  riverEdges: Array.from(state.riverEdges),
  mountainEdges: Array.from(state.mountainEdges || []),
  straitEdges: Array.from(state.straitEdges || []),
  impassableEdges: Array.from(state.impassableEdges || []),
  timestamp: state.timestamp.toISOString()
});

const normalizeGameState = (state: GameState): GameState => {
  const phase =
    Object.values(GamePhase).includes(state.phase) && state.phase !== GamePhase.MOVEMENT ? state.phase : GamePhase.WEATHER;
  const scenarioId = state.scenarioId || "france1940";
  const hasExistingFactionCards = Boolean(state.factionCards);
  const axisEvents = state.factionCards?.[Side.AXIS]?.eventsBox;
  const alliedEvents = state.factionCards?.[Side.ALLIED]?.eventsBox;
  const eventsAlreadyUsed = (state.history || []).some((action) => action.note?.includes("Events:"));
  const isBalkans = scenarioId === "balkans1941";
  const isFrance1944 = scenarioId === "france1944";
  const isFrance1941 = scenarioId === "france1941";
  const isItaly1943 = scenarioId === "italy1943" || scenarioId === "italy1943Include";
  const isItaly1943Include = scenarioId === "italy1943Include";
  const isFna1942 = scenarioId === "frenchNorthAfrica1942";
  const isBarbarossa = scenarioId === "barbarossa1941" || scenarioId === "russia19411944";
  const isRussia1944 = scenarioId === "russia19411944";

  // Nazioni valide per ogni scenario (usate per filtrare PP salvati e rimuovere paesi spuri)
  const validAxisCountries = isBarbarossa
    ? (isRussia1944
        ? ["Germany", "Romania", "Finland", "Hungary", "Italy"]
        : ["Germany", "Romania", "Finland", "Hungary"])
    : isBalkans
      ? ["Bulgaria", "Germany", "Hungary", "Italy", "Romania"]
      : isFrance1944 ? ["Germany"]
      : isItaly1943 ? ["Germany", "Italy"]
      : isFna1942 ? ["Germany", "Fr.N.Africa", "Italy"]
      : isFrance1941 ? ["Germany", "Italy"]
      : ["Germany"];
  const validAlliedCountries = isBarbarossa
    ? ["USSR"]
    : isBalkans ? ["Greece", "UK", "Yugoslavia"]
    : isFrance1944 ? ["UK", "USA"]
    : isItaly1943 ? ["UK", "USA"]
    : isFna1942 ? ["UK", "USA"]
    : isFrance1941 ? ["Belgium", "France", "Netherlands", "UK"]
    : ["France", "UK", "Belgium", "Netherlands"];

  const filterToValidCountries = <T,>(obj: Record<string, T> | undefined, validKeys: string[]): Record<string, T> => {
    if (!obj) return {};
    return Object.fromEntries(Object.entries(obj).filter(([k]) => validKeys.includes(k)));
  };

  const defaultAxisProduction: Record<string, number | null> = isBalkans
    ? { Bulgaria: null, Germany: null, Hungary: null, Italy: null, Romania: null }
    : isFrance1944
      ? { Germany: 12 }
      : isItaly1943
        ? { Germany: null, Italy: isItaly1943Include ? 2 : 0 }
      : isFna1942
        ? { Germany: null, "Fr.N.Africa": 2, Italy: null }
      : isFrance1941
        ? { Germany: 22, Italy: null }
      : isBarbarossa
        ? (isRussia1944
            ? { Germany: 13, Romania: 2, Finland: 1, Hungary: 1, Italy: 1 }
            : { Germany: 12, Romania: 2, Finland: 1, Hungary: 1 })
        : { Germany: null };
  const defaultAxisWill: Record<string, number | null> = isBalkans
    ? { Bulgaria: null, Germany: null, Hungary: null, Italy: null, Romania: null }
    : isItaly1943
      ? { Germany: null, Italy: 3 }
    : isFna1942
      ? { Germany: null, "Fr.N.Africa": 5, Italy: null }
    : isFrance1941
      ? { Germany: null, Italy: null }
    : isBarbarossa
      ? (isRussia1944
          ? { Germany: null, Romania: 6, Finland: 3, Hungary: 4, Italy: 4 }
          : { Germany: null, Romania: 6, Finland: 3, Hungary: 4 })
      : { Germany: null };
  const defaultAxisStatus: Record<string, CountryStatus> = isBalkans
    ? { Bulgaria: "active" as const, Germany: "active" as const, Hungary: "active" as const, Italy: "active" as const, Romania: "active" as const }
    : isItaly1943
      ? { Germany: "active" as const, Italy: isItaly1943Include ? "active" as const : "conquered" as const }
    : isFna1942
      ? { Germany: "active" as const, "Fr.N.Africa": "active" as const, Italy: "active" as const }
    : isFrance1941
      ? { Germany: "active" as const, Italy: "active" as const }
    : isBarbarossa
      ? (isRussia1944
          ? { Germany: "active" as const, Romania: "active" as const, Finland: "active" as const, Hungary: "active" as const, Italy: "active" as const }
          : { Germany: "active" as const, Romania: "active" as const, Finland: "active" as const, Hungary: "active" as const })
      : { Germany: "active" as const };
  const defaultAlliedProduction: Record<string, number | null> = isBalkans
    ? { Greece: 1, UK: null, Yugoslavia: 2 }
    : isFrance1944
      ? { UK: null, USA: null }
      : isItaly1943
        ? { UK: null, USA: null }
      : isFna1942
        ? { UK: null, USA: null }
      : isFrance1941
        ? { Belgium: 1, France: 11, Netherlands: 1, UK: null }
      : isBarbarossa
        ? { USSR: 15 }
        : { France: hasExistingFactionCards ? 0 : 7, UK: null, Belgium: hasExistingFactionCards ? 0 : 1, Netherlands: hasExistingFactionCards ? 0 : 1 };
  const defaultAlliedWill: Record<string, number | null> = isBalkans
    ? { Greece: 4, UK: null, Yugoslavia: 6 }
    : isFrance1944
      ? { UK: null, USA: null }
      : isItaly1943
        ? { UK: null, USA: null }
      : isFna1942
        ? { UK: null, USA: null }
      : isFrance1941
        ? { Belgium: 2, France: 30, Netherlands: 2, UK: null }
      : isBarbarossa
        ? { USSR: 95 }
        : { France: 20, UK: null, Belgium: 2, Netherlands: 2 };
  const defaultAlliedStatus: Record<string, CountryStatus> = isBalkans
    ? { Greece: "active" as const, UK: "active" as const, Yugoslavia: "active" as const }
    : isFrance1944
      ? { UK: "active" as const, USA: "active" as const }
      : isItaly1943
        ? { UK: "active" as const, USA: "active" as const }
      : isFna1942
        ? { UK: "active" as const, USA: "active" as const }
      : isBarbarossa
        ? { USSR: "active" as const }
        : { France: "active" as const, UK: "active" as const, Belgium: "active" as const, Netherlands: "active" as const };
  const defaultAxisEvents = isBalkans
    ? ["Ground Support", "Ground Support #2", "Germany Airdrop"]
    : isFrance1944
      ? ["Strategic Move", "Germany Jets", "Germany Tanks"]
      : isItaly1943
        ? isItaly1943Include
          ? ["Strategic Move", "Germany Tanks", "Italy Tanks", "SNAFU"]
          : ["Strategic Move", "Germany Tanks", "SNAFU"]
      : isFna1942
        ? ["Strategic Move", "Germany Tanks", "Italy Tanks"]
      : isFrance1941
        ? ["Strategic Move", "Germany Airdrop", "Germany Tanks", "Italy Tanks"]
      : isBarbarossa
        ? (isRussia1944
            ? ["Strategic Move", "Ground Support", "Ground Support #2", "Germany Airdrop", "Blitzkrieg", "Surface Action", "Surprise Attack", "SNAFU"]
            : ["Strategic Move", "Ground Support", "Ground Support #2", "Germany Airdrop", "Blitzkrieg", "Surface Action", "Surprise Attack", "SNAFU"])
        : ["Germany Tanks", "Jets", "Rockets", "Surprise Attack", "SNAFU"];
  const defaultAlliedEvents = isBalkans
    ? ["Ground Support", "Ground Support #2"]
    : isFrance1944
      ? ["UK Naval Evacuation", "UK Surprise Attack", "UK/USA Airdrop", "USA Surprise Attack", "USA Surprise Attack #2", "Western Partisans", "Western Mulberry", "Strategic Move", "Western ULTRA", "Western SNAFU"]
      : isItaly1943
        ? isItaly1943Include
          ? ["UK Naval Evacuation", "UK Surprise Attack", "UK Tanks", "UK Tanks #2", "UK/USA Airdrop", "USA Surprise Attack", "USA Surprise Attack #2", "Western Free Forces", "Strategic Move", "Western ULTRA", "Western SNAFU"]
          : ["UK Naval Evacuation", "UK Surprise Attack", "UK Tanks", "UK Tanks #2", "USA Surprise Attack", "USA Surprise Attack #2", "Western Free Forces", "Western ULTRA", "Western SNAFU"]
      : isFna1942
        ? ["UK Naval Evacuation", "UK Tanks", "USA Tanks", "Western Free Forces", "Strategic Move", "Western ULTRA"]
      : isFrance1941
        ? ["France Tanks", "France Tanks #2", "UK Naval Evacuation", "UK Tanks", "Ground Support", "Ground Support #2", "Strategic Move"]
      : isBarbarossa
        ? (isRussia1944
            ? ["Strategic Move", "Soviet Counterattack", "Rasputitsa", "Partisans", "Partisans #2", "Surface Action", "2x Tanks", "Lend Lease"]
            : ["Strategic Move", "Soviet Counterattack", "Rasputitsa", "Partisans", "Surface Action"])
        : ["France Tanks", "UK ULTRA", "Free Forces", "Ground Support", "Naval Evacuation", "Partisans", "UK Surprise Attack"];
  const factionCards: GameState["factionCards"] = {
    [Side.AXIS]: {
      side: Side.AXIS,
      productionPoints: {
        ...defaultAxisProduction,
        ...filterToValidCountries(state.factionCards?.[Side.AXIS]?.productionPoints, validAxisCountries)
      } as Record<string, number | null>,
      nationalWill: {
        ...defaultAxisWill,
        ...filterToValidCountries(state.factionCards?.[Side.AXIS]?.nationalWill, validAxisCountries)
      },
      countryStatus: {
        ...defaultAxisStatus,
        ...filterToValidCountries(state.factionCards?.[Side.AXIS]?.countryStatus, validAxisCountries)
      },
      countryInitialNationalWill: {
        ...defaultAxisWill,
        ...filterToValidCountries(state.factionCards?.[Side.AXIS]?.countryInitialNationalWill, validAxisCountries)
      },
      eventsBox: axisEvents && axisEvents.length > 0 ? axisEvents : eventsAlreadyUsed ? [] : defaultAxisEvents,
      eliminatedBox: state.factionCards?.[Side.AXIS]?.eliminatedBox || [],
      mobilizationBox: state.factionCards?.[Side.AXIS]?.mobilizationBox || []
    },
    [Side.ALLIED]: {
      side: Side.ALLIED,
      productionPoints: {
        ...defaultAlliedProduction,
        ...filterToValidCountries(state.factionCards?.[Side.ALLIED]?.productionPoints, validAlliedCountries)
      } as Record<string, number | null>,
      nationalWill: {
        ...defaultAlliedWill,
        ...filterToValidCountries(state.factionCards?.[Side.ALLIED]?.nationalWill, validAlliedCountries)
      },
      countryStatus: {
        ...defaultAlliedStatus,
        ...filterToValidCountries(state.factionCards?.[Side.ALLIED]?.countryStatus, validAlliedCountries)
      },
      countryInitialNationalWill: {
        ...defaultAlliedWill,
        ...filterToValidCountries(state.factionCards?.[Side.ALLIED]?.countryInitialNationalWill, validAlliedCountries)
      },
      eventsBox: alliedEvents && alliedEvents.length > 0 ? alliedEvents : eventsAlreadyUsed ? [] : defaultAlliedEvents,
      eliminatedBox: state.factionCards?.[Side.ALLIED]?.eliminatedBox || [],
      mobilizationBox: state.factionCards?.[Side.ALLIED]?.mobilizationBox || []
    }
  };
  if (isBalkans) {
    const alliedCard = factionCards[Side.ALLIED];
    const activeGreece = (alliedCard.countryStatus?.Greece || "active") === "active";
    const activeYugoslavia = (alliedCard.countryStatus?.Yugoslavia || "active") === "active";
    const greeceAtScenarioWill = alliedCard.nationalWill.Greece === 4;
    const yugoslaviaAtScenarioWill = alliedCard.nationalWill.Yugoslavia === 6;
    factionCards[Side.ALLIED] = {
      ...alliedCard,
      productionPoints: {
        ...alliedCard.productionPoints,
        Greece: activeGreece && greeceAtScenarioWill && (alliedCard.productionPoints.Greece ?? 0) <= 0 ? 1 : alliedCard.productionPoints.Greece,
        Yugoslavia: activeYugoslavia && yugoslaviaAtScenarioWill && (alliedCard.productionPoints.Yugoslavia ?? 0) <= 0 ? 2 : alliedCard.productionPoints.Yugoslavia
      }
    };
  }

  const normalizedMap = new Map(
    Array.from(state.map.entries()).map(([key, hex]) => [
      key,
      {
        ...hex,
        terrainTags: hex.terrainTags || [],
        railEdges: hex.railEdges || [],
        features: { ...defaultHexFeatures, ...hex.features }
      }
    ])
  );
  if (isFna1942) {
    const patchFnaSource = (code: string, name: string) => {
      const row = Number(code.slice(0, 2));
      const col = Number(code.slice(2));
      const coord = { q: col - 2, r: row - 40 };
      const key = coordKey(coord);
      const hex = normalizedMap.get(key);
      if (!hex) return;
      normalizedMap.set(key, {
        ...hex,
        terrain: TerrainType.COASTAL,
        terrainTags: Array.from(new Set([...(hex.terrainTags || []).filter((tag) => tag !== "sea"), "coast" as TerrainTag])),
        features: {
          ...hex.features,
          country: "Fr.N.Africa",
          controller: Side.AXIS,
          name,
          city: true,
          port: true,
          productionCenter: false,
          capital: false,
          prohibited: false,
          fadedDot: false
        }
      });
    };
    patchFnaSource("4622", "Tunisi");
    patchFnaSource("5022", "Gabes");
  }

  return {
    ...state,
    scenarioId,
    scenarioEndsTurn: scenarioById(scenarioId).endTurn || state.scenarioEndsTurn,
    turnCode: state.turnCode || "May-40",
    phase,
    subPhase: state.subPhase || GameSubPhase.WEATHER_ROLL,
    currentSide: phase === GamePhase.WEATHER ? Side.AXIS : state.currentSide || Side.AXIS,
    weather: state.weather || WeatherType.FAIR,
    previousWeather: state.previousWeather,
    weatherRoll: state.weatherRoll,
    weatherMap: state.weatherMap || (isBalkans || isItaly1943 || isFna1942 ? WeatherMapCategory.BALKANS_FNA_ITALY : WeatherMapCategory.OTHER_MAPS),
    factionCards,
    eventTurnTrack: state.eventTurnTrack || [],
    mapEventMarkerDetails: state.mapEventMarkerDetails || [],
    units: new Map(Array.from(state.units.entries()).map(([id, unit]) => [id, { ...unit, mapPresence: unit.mapPresence || "france" }])),
    map: normalizedMap,
    riverEdges: state.riverEdges || new Set<string>(),
    mountainEdges: state.mountainEdges || new Set<string>(),
    straitEdges: state.straitEdges || new Set<string>(),
    impassableEdges: state.impassableEdges || new Set<string>()
  };
};

const deserializeGameState = (state: SerializedGameState): GameState => normalizeGameState({
  ...state,
  units: new Map(state.units.map((unit) => [unit.id, unit])),
  map: new Map(state.map),
  riverEdges: new Set(state.riverEdges || []),
  mountainEdges: new Set(state.mountainEdges || []),
  straitEdges: new Set(state.straitEdges || []),
  impassableEdges: new Set(state.impassableEdges || []),
  timestamp: new Date(state.timestamp)
});

const saveGameState = (state: GameState) => {
  try {
    localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(serializeGameState(state)));
  } catch {
    // The game can continue even if the browser refuses local persistence.
  }
};

const loadGameState = (): GameState | null => {
  try {
    const stored = localStorage.getItem(GAME_STATE_STORAGE_KEY);
    if (!stored) return null;
    return deserializeGameState(JSON.parse(stored));
  } catch {
    return null;
  }
};

const loadPrivateMapLayer = (mapId: ScenarioMapId = "france"): PrivateMapLayer => {
  try {
    const defaults = mapLayerDefaults(mapId);
    const stored = localStorage.getItem(privateMapStorageKeyFor(mapId)) ||
      (mapId === "france" ? localStorage.getItem(PRIVATE_MAP_STORAGE_KEY) : null);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored);
    if (mapId === "west" && parsed.fnaCalibrationVersion !== FNA_CALIBRATION_VERSION) {
      return {
        ...defaults,
        imageDataUrl: parsed.imageDataUrl || defaults.imageDataUrl,
        opacity: parsed.opacity ?? defaults.opacity,
        showProceduralTerrain: false
      };
    }
    if (mapId === "russia" && parsed.russiaCalibrationVersion !== RUSSIA_CALIBRATION_VERSION) {
      return {
        ...defaults,
        imageDataUrl: parsed.imageDataUrl || defaults.imageDataUrl,
        opacity: parsed.opacity ?? defaults.opacity,
        showProceduralTerrain: false
      };
    }
    const layer = { ...defaults, ...parsed };
    return {
      ...layer,
      ...mapGridDefaults(mapId),
      showProceduralTerrain: false
    };
  } catch {
    return mapLayerDefaults(mapId);
  }
};

const savePrivateMapLayer = (mapId: ScenarioMapId, layer: PrivateMapLayer) => {
  try {
    const payload = mapId === "west"
      ? { ...layer, fnaCalibrationVersion: FNA_CALIBRATION_VERSION }
      : mapId === "russia"
        ? { ...layer, russiaCalibrationVersion: RUSSIA_CALIBRATION_VERSION }
        : layer;
    localStorage.setItem(privateMapStorageKeyFor(mapId), JSON.stringify(payload));
  } catch {
    // Large private maps can exceed localStorage; the UI still works for this session.
  }
};

const toCalibration = ({ imageDataUrl: _imageDataUrl, ...calibration }: PrivateMapLayer): MapCalibration => calibration;

const loadSavedCalibrations = (mapId: ScenarioMapId = "france"): SavedCalibration[] => {
  try {
    const stored = localStorage.getItem(calibrationsStorageKeyFor(mapId)) ||
      (mapId === "france" ? localStorage.getItem(CALIBRATIONS_STORAGE_KEY) : null);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

const saveSavedCalibrations = (mapId: ScenarioMapId, calibrations: SavedCalibration[]) => {
  try {
    localStorage.setItem(calibrationsStorageKeyFor(mapId), JSON.stringify(calibrations));
  } catch {
    // Calibration data is small, but ignore storage failures so the board remains usable.
  }
};

const serializeScenario = (privateMapLayer: PrivateMapLayer, gameState: GameState | null): string => {
  const scenario: ScenarioExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    privateMapLayer,
    gameState: gameState ? serializeGameState(gameState) : null
  };
  return JSON.stringify(scenario, null, 2);
};

const openScenarioDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open(SCENARIO_IDB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SCENARIO_IDB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open IndexedDB."));
  });

const saveScenarioToIndexedDb = async (privateMapLayer: PrivateMapLayer, gameState: GameState | null) => {
  try {
    const db = await openScenarioDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SCENARIO_IDB_STORE, "readwrite");
      transaction.objectStore(SCENARIO_IDB_STORE).put(JSON.parse(serializeScenario(privateMapLayer, gameState)), SCENARIO_IDB_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save scenario."));
    });
    db.close();
  } catch {
    // IndexedDB is a best-effort browser backup; file export remains available.
  }
};

const loadScenarioFromIndexedDb = async (): Promise<{ privateMapLayer: PrivateMapLayer; gameState: GameState | null } | null> => {
  try {
    const db = await openScenarioDb();
    const scenario = await new Promise<ScenarioExport | undefined>((resolve, reject) => {
      const transaction = db.transaction(SCENARIO_IDB_STORE, "readonly");
      const request = transaction.objectStore(SCENARIO_IDB_STORE).get(SCENARIO_IDB_KEY);
      request.onsuccess = () => resolve(request.result as ScenarioExport | undefined);
      request.onerror = () => reject(request.error || new Error("Could not load scenario."));
    });
    db.close();
    return scenario ? deserializeScenario(JSON.stringify(scenario)) : null;
  } catch {
    return null;
  }
};

const deserializeScenario = (contents: string): { privateMapLayer: PrivateMapLayer; gameState: GameState | null } => {
  const parsed = JSON.parse(contents) as Partial<ScenarioExport>;
  if (parsed.version !== 1 || !parsed.privateMapLayer) {
    throw new Error("Unsupported scenario file.");
  }

  const mapId = mapIdForScenario(parsed.gameState?.scenarioId);
  const privateMapLayer: PrivateMapLayer = {
    ...mapLayerDefaults(mapId),
    ...parsed.privateMapLayer,
    ...mapGridDefaults(mapId),
    showProceduralTerrain: false
  };

  return {
    privateMapLayer,
    gameState: parsed.gameState ? deserializeGameState(parsed.gameState) : null
  };
};

const withFrance1940Setup = (state: GameState): GameState => {
  if ((state.scenarioId || "france1940") !== "france1940") return state;
  const hasPrototypeUnits = Array.from(state.units.keys()).some((id) => id.startsWith("axis_") || id.startsWith("allied_"));
  const hasFranceSetup = state.units.has("germany_1") || state.units.has("france_1");
  if (hasPrototypeUnits && !hasFranceSetup) {
    return {
      ...state,
      currentSide: state.currentSide,
      units: createFrance1940Units(),
      timestamp: new Date()
    };
  }

  const setupUnits = createFrance1940Units();
  const units = new Map(state.units);
  let changed = false;
  setupUnits.forEach((unit, id) => {
    if (!units.has(id)) {
      units.set(id, unit);
      changed = true;
    }
  });
  if (!changed) return state;
  return {
    ...state,
    units,
    timestamp: new Date()
  };
};

const withScenarioSetup = (state: GameState): GameState => {
  if ((state.scenarioId || "france1940") === "france1940") return withFrance1940Setup(state);
  const setupUnits = createScenarioUnits(state.scenarioId as ScenarioId);
  if (setupUnits.size === 0) return state;
  if (state.units.size > 0) {
    const units = new Map(state.units);
    let changed = false;
    setupUnits.forEach((unit, id) => {
      if (!units.has(id)) {
        units.set(id, unit);
        changed = true;
      }
    });
    return changed ? { ...state, units, timestamp: new Date() } : state;
  }
  return {
    ...state,
    units: setupUnits,
    timestamp: new Date()
  };
};

// Auto-migration: se lo state salvato è anteriore al seed France 1940, rigeneralo.
// Detection: nessuna hex ha features.country settato → state pre-seed → scarta.
const stateHasSeedData = (state: GameState | null): boolean => {
  if (!state) return false;
  if (state.scenarioId === "italy1943" || state.scenarioId === "italy1943Include") return true;
  if (state.scenarioId === "frenchNorthAfrica1942") return true;
  for (const hex of state.map.values()) {
    if (hex.features?.country) return true;
  }
  return false;
};
const loadedState = loadGameState();
const usableState = stateHasSeedData(loadedState) ? loadedState : null;
const initialMapId = currentMapIdForState(usableState);
const initialPrivateMapLayer = loadPrivateMapLayer(initialMapId);
const initialGameState = withScenarioSetup(usableState || createGameForLayer(initialPrivateMapLayer));

const adjacentMovesOnly = (state: GameState, unit: Unit): ReachableHex[] => {
  // Hex amici/vuoti raggiungibili (movement)
  const moves = calculateReachableHexes(state, unit).filter((move) => sideBetween(unit.position, move.coord));
  // Hex nemici adiacenti (attacco): mostriamo il costo MP che servirebbe per attaccare,
  // così il giocatore vede il costo reale prima di lanciare l'attacco.
  if (unit.type === "air" || unit.type === "fort") return moves;
  HEX_SIDES.forEach((side) => {
    const adj = neighborForSide(unit.position, side);
    if (!isInsideMap(state, adj)) return;
    const occ = getUnitOnHex(state, adj);
    if (!occ || occ.side === unit.side) return;
    const cost = attackMovementCost(state, unit, adj);
    if (cost === Infinity || cost > movementRemainingFor(unit)) return;
    moves.push({ coord: adj, cost });
  });
  return moves;
};

const finishUnitIfNoActionOptions = (state: GameState, unitId: string): GameState => {
  if (state.pendingCombat) return state;
  const unit = state.units.get(unitId);
  if (!unit || unit.activated || unit.status === "destroyed" || unit.type === "air" || unit.type === "fort") return state;
  if (adjacentMovesOnly(state, unit).length > 0) return state;
  return endUnitActivation(state, unitId);
};

const westernMedAmphibiousTargets = (state: GameState, unit: Unit): ReachableHex[] => {
  // Filtriamo con canAmphibiousInvade per mostrare solo bersagli realmente attaccabili
  // (richiede Surprise Attack marker presente etc.).
  return amphibiousTargetsFor(state, unit).map((coord) => ({ coord, cost: 0 }));
};

const isMapPlacementEvent = (markerId: string): boolean => {
  const normalized = markerId.toLowerCase();
  return normalized.includes("airdrop") || normalized.includes("mulberry") || normalized.includes("partisans") || normalized.includes("surprise attack");
};

const mapEventTargets = (state: GameState, side: Side, markerId: string): ReachableHex[] =>
  Array.from(state.map.values())
    .filter((hex) => playMapEventMarker(state, side, markerId, hex.coord) !== null)
    .map((hex) => ({ coord: hex.coord, cost: 0 }));

const strategicMoveSelectableUnits = (state: GameState): ReachableHex[] => {
  const seen = new Set<string>();
  return Array.from(state.units.values())
    .filter((unit) => canStrategicMove(state, unit))
    .flatMap((unit) => {
      const key = `${unit.position.q},${unit.position.r}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ coord: unit.position, cost: 0 }];
    });
};

const resolvePendingForHex = (state: GameState, defenderHex: HexCoord, primaryId: string): GameState | null =>
  resolveDesignatedAssault(state, defenderHex, primaryId);

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: initialGameState,
  combatRollbackState: null,
  selectedUnit: null,
  selectedHex: null,
  validMoves: initialGameState.phase === GamePhase.STRATEGIC_MOVEMENT
    ? strategicMoveSelectableUnits(initialGameState)
    : [],
  attackMode: "mobile",
  airActionMode: null,
  amphibiousMode: false,
  mobilizingUnitId: null,
  mapEventPlacement: null,
  privateMapLayer: initialPrivateMapLayer,
  savedCalibrations: loadSavedCalibrations(initialMapId),
  notice: null,

  setNotice: (text) => set({ notice: text }),

  setGameState: (state) => {
    saveGameState(state);
    set({
      gameState: state,
      selectedUnit: null,
      selectedHex: null,
      validMoves: state.phase === GamePhase.STRATEGIC_MOVEMENT
        ? strategicMoveSelectableUnits(state)
        : [],
      mobilizingUnitId: null,
      mapEventPlacement: null,
      airActionMode: null,
      amphibiousMode: false
    });
  },
  selectUnit: (unit) => set({ selectedUnit: unit }),
  selectHex: (hex) => set({ selectedHex: hex }),
  setValidMoves: (moves) => set({ validMoves: moves }),
  setAttackMode: (mode) => set({ attackMode: mode }),
  setAirActionMode: (mode) => {
    set({ airActionMode: mode });
    // Aggiorna validMoves per evidenziare gli hex/target raggiungibili
    const { gameState, selectedUnit } = get();
    if (!gameState || !selectedUnit) return;
    if (mode === "rebase") {
      const reach = calculateAirReachableHexes(gameState, selectedUnit);
      if (reach.length === 0 && typeof window !== "undefined") {
        const sample = Array.from(gameState.map.values())
          .filter((hex) => hex.features.name || hex.features.city || hex.features.capital || hex.features.port)
          .slice(0, 18)
          .map((hex) => {
            const reasons = explainAirRebaseEndHex(gameState, hex.coord, selectedUnit);
            if (reasons.length === 0) return `${hex.features.name || `${hex.coord.q},${hex.coord.r}`}: OK ma fuori portata/contesto`;
            return `${hex.features.name || `${hex.coord.q},${hex.coord.r}`}: ${reasons.join(", ")}`;
          })
          .join("\n");
        window.alert(
          `Nessuna destinazione valida per Air Rebase di ${selectedUnit.name}.\n\n` +
          `${sample}`
        );
      }
      set({ validMoves: reach.map((coord) => ({ coord, cost: 0 })) });
    } else if (mode === "naval") {
      const targets = calculateNavalTransportTargets(gameState, selectedUnit);
      set({ validMoves: targets.map((coord) => ({ coord, cost: 0 })) });
    } else if (mode === "strike") {
      // Mostra come validMoves le hex contenenti enemy air unit nel range
      const targets = Array.from(gameState.units.values())
        .filter((u) => u.type === "air" && u.side !== selectedUnit.side && u.status !== "destroyed")
        .filter((u) => hexDistance(selectedUnit.position, u.position) <= 7)
        .map((u) => ({ coord: u.position, cost: 0 }));
      set({ validMoves: targets });
    } else {
      set({ validMoves: [] });
    }
  },
  toggleAmphibiousMode: () => {
    const { gameState, selectedUnit, amphibiousMode } = get();
    if (!gameState || !selectedUnit) return;
    if (amphibiousMode) {
      set({ amphibiousMode: false, validMoves: [] });
      return;
    }
    const targets = amphibiousTargetsFor(gameState, selectedUnit);
    set({
      amphibiousMode: true,
      validMoves: targets.map((coord) => ({ coord, cost: 0 })),
      airActionMode: null,
      mobilizingUnitId: null,
      mapEventPlacement: null
    });
  },
  resetSelection: () =>
    set({
      selectedUnit: null,
      selectedHex: null,
      validMoves: [],
      mapEventPlacement: null
    }),
  hydratePersistentScenario: () => {
    loadScenarioFromIndexedDb().then((scenario) => {
      if (scenario) {
        const current = get();
        // Idratiamo da IndexedDB SOLO se lo scenario salvato è "moderno" (ha country sui hex)
        // e se manca l'immagine privata o il gameState. Altrimenti rischiamo di sovrascrivere
        // lo state seed corrente con uno legacy senza country.
        const scenarioIsModern = scenario.gameState ? stateHasSeedData(scenario.gameState) : false;
        const shouldHydrateImage = !current.privateMapLayer.imageDataUrl && Boolean(scenario.privateMapLayer.imageDataUrl);
        const shouldHydrateGame = !current.gameState && scenarioIsModern;

        if (shouldHydrateImage && shouldHydrateGame) {
          const gameState = scenario.gameState!;
          set({
            privateMapLayer: scenario.privateMapLayer,
            gameState,
            selectedUnit: null,
            selectedHex: null,
            validMoves: [],
            mobilizingUnitId: null,
            mapEventPlacement: null,
            airActionMode: null,
            amphibiousMode: false
          });
        } else if (shouldHydrateImage) {
          // Solo l'immagine: aggiorna SOLO il layer mantenendo lo state corrente
          set({
            privateMapLayer: { ...current.privateMapLayer, imageDataUrl: scenario.privateMapLayer.imageDataUrl }
          });
        } else if (shouldHydrateGame) {
          set({
            gameState: scenario.gameState!,
            selectedUnit: null,
            selectedHex: null,
            validMoves: [],
            mobilizingUnitId: null,
            mapEventPlacement: null,
            airActionMode: null,
            amphibiousMode: false
          });
        }
      }

      // Se la mappa privata non ha ancora imageDataUrl, fetcha dall'asset statico.
      const stateNow = get();
      const mapId = currentMapIdForState(stateNow.gameState);
      if (!stateNow.privateMapLayer.imageDataUrl) {
        fetchMapDataUrl(mapId).then((dataUrl) => {
          if (!dataUrl) return;
          const layer = { ...get().privateMapLayer, imageDataUrl: dataUrl, showProceduralTerrain: false };
          savePrivateMapLayer(mapId, layer);
          set({ privateMapLayer: layer });
        });
      }
    });
  },
  newLocalGame: (scenarioId = "france1940") => {
    const mapId = mapIdForScenario(scenarioId);
    const privateMapLayer = loadPrivateMapLayer(mapId);
    const gameState = createGameForLayer(privateMapLayer, scenarioId);
    savePrivateMapLayer(mapId, privateMapLayer);
    saveGameState(gameState);
    set({
      privateMapLayer,
      gameState,
      selectedUnit: null,
      selectedHex: null,
      validMoves: [],
      mobilizingUnitId: null,
      mapEventPlacement: null,
      airActionMode: null,
      amphibiousMode: false,
      savedCalibrations: loadSavedCalibrations(mapId)
    });
    // Se la mappa privata non è ancora stata caricata, scaricala dall'asset.
    if (!privateMapLayer.imageDataUrl) {
      fetchMapDataUrl(mapId).then((dataUrl) => {
        if (!dataUrl) return;
        const layer = { ...get().privateMapLayer, imageDataUrl: dataUrl, showProceduralTerrain: false };
        savePrivateMapLayer(mapId, layer);
        set({ privateMapLayer: layer });
      });
    }
  },
  resetFrance1940Setup: () => {
    const { gameState } = get();
    if (!gameState) return;
    const scenarioId = (gameState.scenarioId as ScenarioId | undefined) || "france1940";
    const setupUnits = createScenarioUnits(scenarioId);
    const scenarioLabel = scenarioById(scenarioId).title;
    const nextState: GameState = {
      ...gameState,
      units: setupUnits,
      history: [
        {
          type: ActionType.HOLD,
          side: gameState.currentSide,
          note: `${scenarioLabel} setup reset.`,
          timestamp: new Date()
        },
        ...gameState.history
      ],
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({
      gameState: nextState,
      selectedUnit: null,
      selectedHex: null,
      validMoves: []
    });
  },
  selectWesternMedUnit: (unitId) => {
    const { gameState } = get();
    if (!gameState) return;
    const unit = gameState.units.get(unitId);
    if (!unit || unit.status === "destroyed" || !["west_med", "central_med", "east_na"].includes(unit.mapPresence || "")) return;
    const targets = unit.type !== "air" && unit.type !== "fort" && unit.side === gameState.currentSide && canCommandUnit(gameState, unit)
      ? westernMedAmphibiousTargets(gameState, unit)
      : [];
    set({
      selectedUnit: unit,
      selectedHex: null,
      validMoves: targets,
      airActionMode: null,
      mobilizingUnitId: null,
      mapEventPlacement: null
    });
  },
  clickHex: (hex) => {
    const { gameState, selectedUnit, validMoves, airActionMode, mobilizingUnitId, mapEventPlacement } = get();
    if (!gameState) return;

    if (gameState.pendingCombat?.kind === "retreat") {
      get().chooseRetreat(hex);
      return;
    }
    if (gameState.pendingCombat?.kind === "advance") return;
    if (gameState.pendingCombat?.kind === "commit") return;

    if (mapEventPlacement) {
      if (mapEventPlacement.mode === "strategic-move") {
        if (selectedUnit) {
          const selectedStillCurrent = gameState.units.get(selectedUnit.id);
          if (!selectedStillCurrent || !canStrategicMove(gameState, selectedStillCurrent)) {
            set({
              selectedUnit: null,
              validMoves: strategicMoveSelectableUnits(gameState)
            });
            return;
          }
          if (validMoves.some((move) => sameCoord(move.coord, hex))) {
            const nextState = executeStrategicMove(gameState, selectedStillCurrent.id, hex);
            if (nextState) {
              saveGameState(nextState);
              set({
                gameState: nextState,
                selectedUnit: null,
                selectedHex: hex,
                validMoves: [],
                mapEventPlacement: null
              });
            }
            return;
          }
        }

        const unitOnHex = getUnitOnHex(gameState, hex);
        if (unitOnHex && canStrategicMove(gameState, unitOnHex)) {
          const reachable = calculateStrategicReachableHexes(gameState, unitOnHex);
          set({
            selectedUnit: unitOnHex,
            selectedHex: hex,
            validMoves: reachable.map((coord) => ({ coord, cost: 0 }))
          });
          return;
        }

        set({ selectedHex: hex });
        return;
      }
      if (!validMoves.some((move) => sameCoord(move.coord, hex))) {
        set({ selectedHex: hex });
        return;
      }
      const next = mapEventPlacement.mode === "naval-evacuation" && mapEventPlacement.unitId
        ? executeNavalEvacuationTo(gameState, mapEventPlacement.unitId, hex)
        : playMapEventMarker(gameState, mapEventPlacement.side, mapEventPlacement.markerId, hex);
      if (!next) {
        if (typeof window !== "undefined") {
          window.alert(`Impossibile piazzare ${mapEventPlacement.markerId} su questo esagono, anche se risultava evidenziato.`);
        }
        return;
      }
      saveGameState(next);
      set({
        gameState: next,
        selectedUnit: null,
        selectedHex: hex,
        validMoves: [],
        airActionMode: null,
        mobilizingUnitId: null,
        mapEventPlacement: null
      });
      return;
    }

    // 8.2 Mobilization: piazza l'unità in coda nella hex scelta se nelle valide
    if (mobilizingUnitId && validMoves.some((m) => sameCoord(m.coord, hex))) {
      const next = mobilizeUnit(gameState, mobilizingUnitId, hex);
      if (next) {
        saveGameState(next);
        set({ gameState: next, mobilizingUnitId: null, mapEventPlacement: null, validMoves: [], selectedUnit: null, selectedHex: hex });
      }
      return;
    }

    const unitOnHex = getUnitOnHex(gameState, hex);

    if (selectedUnit && !airActionMode && ["west_med", "central_med", "east_na"].includes(selectedUnit.mapPresence || "") && validMoves.some((move) => sameCoord(move.coord, hex))) {
      const next = executeAmphibiousInvasion(gameState, selectedUnit.id, selectedUnit.position, hex);
      if (next) {
        saveGameState(next);
        const pendingMoves = next.pendingCombat?.kind === "retreat" ? retreatMovesFor(next) : next.pendingCombat?.kind === "commit" ? commitAirMovesFor(next) : [];
        set({
          gameState: next,
          selectedUnit: null,
          selectedHex: hex,
          validMoves: pendingMoves,
          airActionMode: null,
          amphibiousMode: false,
          combatRollbackState: next.pendingCombat?.kind === "commit" ? gameState : null
        });
      }
      return;
    }

    // Amphibious mode da port (UK/USA): la unit è ground in un port amico, e il giocatore
    // ha attivato la modalità Amphibious. La hex cliccata deve essere fra i validMoves.
    const amphibiousMode = get().amphibiousMode;
    if (amphibiousMode && selectedUnit && validMoves.some((m) => sameCoord(m.coord, hex))) {
      const next = executeAmphibiousInvasion(gameState, selectedUnit.id, selectedUnit.position, hex);
      if (next) {
        saveGameState(next);
        const pendingMoves = next.pendingCombat?.kind === "retreat" ? retreatMovesFor(next) : next.pendingCombat?.kind === "commit" ? commitAirMovesFor(next) : [];
        set({
          gameState: next,
          selectedUnit: null,
          selectedHex: hex,
          validMoves: pendingMoves,
          airActionMode: null,
          amphibiousMode: false,
          combatRollbackState: next.pendingCombat?.kind === "commit" ? gameState : null
        });
      }
      return;
    }

    // 6.2 Air actions: rebase / strike
    if (airActionMode === "naval" && selectedUnit && validMoves.some((move) => sameCoord(move.coord, hex))) {
      const next = executeNavalTransport(gameState, selectedUnit.id, hex);
      if (next) {
        saveGameState(next);
        set({ gameState: next, selectedUnit: null, selectedHex: hex, validMoves: [], airActionMode: null });
      }
      return;
    }

    // 6.2 Air actions: rebase / strike
    if (airActionMode && selectedUnit && selectedUnit.type === "air") {
      if (airActionMode === "rebase") {
        const next = airRebase(gameState, selectedUnit.id, hex);
        if (next) {
          saveGameState(next);
          set({ gameState: next, selectedUnit: null, selectedHex: hex, validMoves: [], airActionMode: null });
        }
        return;
      }
      if (airActionMode === "strike" && unitOnHex && unitOnHex.type === "air" && unitOnHex.side !== selectedUnit.side) {
        const next = resolveAirStrike(gameState, selectedUnit.id, unitOnHex.id);
        if (next) {
          saveGameState(next);
          set({ gameState: next, selectedUnit: null, selectedHex: hex, validMoves: [], airActionMode: null });
        }
        return;
      }
      return; // ignora click che non sono validi per l'azione corrente
    }

    // 4.1 Strategic Movement Phase
    if (gameState.phase === GamePhase.STRATEGIC_MOVEMENT) {
      if (selectedUnit) {
        const selectedStillCurrent = gameState.units.get(selectedUnit.id);
        if (!selectedStillCurrent || !canStrategicMove(gameState, selectedStillCurrent)) {
          get().resetSelection();
          return;
        }
        if (validMoves.some((move) => sameCoord(move.coord, hex))) {
          const nextState = executeStrategicMove(gameState, selectedStillCurrent.id, hex);
          if (nextState) {
            saveGameState(nextState);
            set({ gameState: nextState, selectedUnit: null, selectedHex: hex, validMoves: [] });
          }
          return;
        }
      }

      if (unitOnHex && canStrategicMove(gameState, unitOnHex)) {
        const reachable = calculateStrategicReachableHexes(gameState, unitOnHex);
        set({
          selectedUnit: unitOnHex,
          selectedHex: hex,
          validMoves: reachable.map((coord) => ({ coord, cost: 0 }))
        });
        return;
      }

      set({ selectedHex: hex, selectedUnit: null, validMoves: [] });
      return;
    }

    if (selectedUnit) {
      const selectedStillCurrent = gameState.units.get(selectedUnit.id);

      if (!selectedStillCurrent || !canCommandUnit(gameState, selectedStillCurrent)) {
        get().resetSelection();
        return;
      }

      if (unitOnHex && unitOnHex.side !== selectedStillCurrent.side && hexDistance(selectedStillCurrent.position, hex) === 1) {
        // 5.3.1: Mobile vietato vs fort o in Poor/Severe → forza Assault
        const weatherForcesAssault = gameState.weather === "poor" || gameState.weather === "severe";
        const fortForcesAssault = Array.from(gameState.units.values()).some(
          (u) => u.type === "fort" && u.status !== "destroyed" && sameCoord(u.position, hex)
        );
        const userMode = get().attackMode;
        const useAssault = weatherForcesAssault || fortForcesAssault || userMode === "assault";
        // 5.3.1: se il giocatore aveva scelto Mobile ma la regola impone l'Assalto,
        // dillo — altrimenti vede l'unità fermarsi senza capire perché.
        if (useAssault && userMode !== "assault") {
          const because = fortForcesAssault
            ? "il difensore occupa un forte"
            : `il meteo è ${gameState.weather === "severe" ? "Severe" : "Poor"}`;
          set({
            notice: `Attacco Mobile non consentito perché ${because} (5.3.1): designato un Assalto. L'attivazione di ${selectedStillCurrent.name} termina qui.`
          });
        }
        const nextState = useAssault
          ? designateAssault(gameState, selectedStillCurrent.id, hex)
          : initiateMobileAttack(gameState, selectedStillCurrent.id, unitOnHex.id);
        if (!nextState) {
          // Diagnostica: stampa i motivi possibili del rifiuto
          // eslint-disable-next-line no-console
          console.warn("[USWC] attack rejected", {
            attackType: useAssault ? "assault" : "mobile",
            attackerId: selectedStillCurrent.id,
            defenderId: unitOnHex.id,
            attackerActivated: selectedStillCurrent.activated,
            attackerStrategicMove: selectedStillCurrent.strategicMove,
            attackerAssaultTarget: selectedStillCurrent.assaultTarget,
            phase: gameState.phase,
            subPhase: gameState.subPhase,
            currentSide: gameState.currentSide,
            attackerSide: selectedStillCurrent.side,
            weather: gameState.weather,
            distance: hexDistance(selectedStillCurrent.position, hex),
            movementRemaining: movementRemainingFor(selectedStillCurrent),
            movementSpent: selectedStillCurrent.movementSpent
          });
          if (adjacentMovesOnly(gameState, selectedStillCurrent).length === 0) {
            const endedState = endUnitActivation(gameState, selectedStillCurrent.id);
            saveGameState(endedState);
            set({
              gameState: endedState,
              selectedUnit: null,
              selectedHex: hex,
              validMoves: [],
              notice: `${selectedStillCurrent.name} non può attaccare né muovere: attivazione conclusa.`
            });
            return;
          }
          set({
            selectedHex: hex,
            notice: `Attacco non consentito con ${selectedStillCurrent.name}: punti movimento insufficienti o attacco vietato dalle regole.`
          });
          return;
        }
        const nextStateAfterAutoEnd = finishUnitIfNoActionOptions(nextState, selectedStillCurrent.id);
        saveGameState(nextStateAfterAutoEnd);
        // Se è scattato un pendingCombat di tipo retreat, mostra opzioni come validMoves
        if (nextStateAfterAutoEnd.pendingCombat?.kind === "retreat") {
          set({
            gameState: nextStateAfterAutoEnd,
            selectedUnit: null,
            selectedHex: hex,
            validMoves: retreatMovesFor(nextStateAfterAutoEnd)
          });
          return;
        }
        const updatedAttacker = nextStateAfterAutoEnd.units.get(selectedStillCurrent.id) || null;
        const nextValidMoves = updatedAttacker && !updatedAttacker.activated ? adjacentMovesOnly(nextStateAfterAutoEnd, updatedAttacker) : [];
        const stillCanMove = updatedAttacker && !updatedAttacker.activated && nextValidMoves.length > 0;
        set({
          gameState: nextStateAfterAutoEnd,
          selectedUnit: stillCanMove ? updatedAttacker : null,
          selectedHex: hex,
          validMoves: nextValidMoves,
          combatRollbackState: nextStateAfterAutoEnd.pendingCombat?.kind === "commit" ? gameState : null
        });
        return;
      }

      if (validMoves.some((move) => sameCoord(move.coord, hex))) {
        const movedState = moveUnit(gameState, selectedStillCurrent.id, hex);
        const nextState = finishUnitIfNoActionOptions(movedState, selectedStillCurrent.id);
        saveGameState(nextState);
        const movedUnit = nextState.units.get(selectedStillCurrent.id) || null;
        const nextValidMoves = movedUnit && !movedUnit.activated ? adjacentMovesOnly(nextState, movedUnit) : [];
        const keepSelected = movedUnit && !movedUnit.activated && movedUnit.status !== "destroyed" && nextValidMoves.length > 0;
        set({
          gameState: nextState,
          selectedUnit: keepSelected ? movedUnit : null,
          selectedHex: hex,
          validMoves: nextValidMoves
        });
        return;
      }
    }

    // Selezione/ciclo unità sull'hex (incluse air): se ci sono più unità amiche
    // eleggibili (ground + air, o stack ground), il click ripetuto cicla tra loro.
    const commandableSide = gameState.sovietCounterattackActive ? Side.ALLIED : gameState.currentSide;
    const friendlyOnHex = getUnitsOnHex(gameState, hex).filter(
      (u) => u.side === commandableSide && canCommandUnit(gameState, u)
    );
    if (friendlyOnHex.length > 0) {
      const previousIdx = selectedUnit && sameCoord(selectedUnit.position, hex)
        ? friendlyOnHex.findIndex((u) => u.id === selectedUnit.id)
        : -1;
      const nextIdx = (previousIdx + 1) % friendlyOnHex.length;
      const candidate = friendlyOnHex[nextIdx];

      if (!candidate.moved) {
        // Prima attivazione: paga PP e marca moved
        const nextState = activateUnitForAction(gameState, candidate.id);
        if (!nextState) {
          set({ selectedHex: hex, selectedUnit: null, validMoves: [] });
          return;
        }
        const activatedUnit = nextState.units.get(candidate.id);
        if (!activatedUnit) return;
        const nextValidMoves = activatedUnit.type === "air" ? [] : adjacentMovesOnly(nextState, activatedUnit);
        if (activatedUnit.type !== "air" && nextValidMoves.length === 0) {
          const endedState = endUnitActivation(nextState, activatedUnit.id);
          saveGameState(endedState);
          set({
            gameState: endedState,
            selectedUnit: null,
            selectedHex: hex,
            validMoves: [],
            airActionMode: null,
            amphibiousMode: false
          });
          return;
        }
        saveGameState(nextState);
        set({
          gameState: nextState,
          selectedUnit: activatedUnit,
          selectedHex: hex,
          validMoves: nextValidMoves,
          airActionMode: null,
          amphibiousMode: false
        });
        return;
      }

      // Riselezione di unità già mossa ma attivazione non terminata
      if (!candidate.activated) {
        const nextValidMoves = candidate.type === "air" ? [] : adjacentMovesOnly(gameState, candidate);
        if (candidate.type !== "air" && nextValidMoves.length === 0) {
          const endedState = endUnitActivation(gameState, candidate.id);
          saveGameState(endedState);
          set({ gameState: endedState, selectedUnit: null, selectedHex: hex, validMoves: [], airActionMode: null });
          return;
        }
        set({
          selectedUnit: candidate,
          selectedHex: hex,
          validMoves: nextValidMoves,
          airActionMode: null
        });
        return;
      }

      // Tutte attivate o non comandabili: deseleziona
      set({ selectedHex: hex, selectedUnit: null, validMoves: [] });
      return;
    }

    // Fuori dalle fasi in cui una pedina e' comandabile, il click deve comunque
    // servire da ispezione: mostra i dati della prima pedina nello stack senza
    // attivarla e senza spendere PP.
    const unitsForInspection = getUnitsOnHex(gameState, hex).filter((u) => u.status !== "destroyed");
    if (unitsForInspection.length > 0) {
      const previousIdx = selectedUnit && sameCoord(selectedUnit.position, hex)
        ? unitsForInspection.findIndex((u) => u.id === selectedUnit.id)
        : -1;
      const nextIdx = (previousIdx + 1) % unitsForInspection.length;
      set({
        selectedHex: hex,
        selectedUnit: unitsForInspection[nextIdx],
        validMoves: [],
        airActionMode: null
      });
      return;
    }

    set({ selectedHex: hex, selectedUnit: null, validMoves: [] });
  },
  chooseRetreat: (target) => {
    const { gameState } = get();
    if (!gameState) return;
    const next = resolveRetreatChoice(gameState, target);
    if (!next) return;
    saveGameState(next);
    // Se segue un pending advance non ci sono validMoves da mostrare (è un button choice)
    set({ gameState: next, combatRollbackState: null, selectedUnit: null, selectedHex: null, validMoves: [] });
  },
  chooseDefenderCannotRetreat: () => {
    const { gameState } = get();
    if (!gameState) return;
    const next = resolveDefenderCannotRetreatChoice(gameState);
    if (!next) return;
    saveGameState(next);
    set({ gameState: next, combatRollbackState: null, selectedUnit: null, selectedHex: null, validMoves: [] });
  },
  chooseAdvance: (advance, attackerId) => {
    const { gameState } = get();
    if (!gameState) return;
    const next = resolveAdvanceChoice(gameState, advance, attackerId);
    if (!next) return;
    saveGameState(next);
    set({ gameState: next, combatRollbackState: null, selectedUnit: null, selectedHex: null, validMoves: [] });
  },
  cancelPendingCombat: () => {
    const { gameState, combatRollbackState } = get();
    if (!gameState?.pendingCombat || gameState.pendingCombat.kind !== "commit") return;
    const next = combatRollbackState || { ...gameState, pendingCombat: undefined, timestamp: new Date() };
    saveGameState(next);
    set({ gameState: next, combatRollbackState: null, selectedUnit: null, selectedHex: null, validMoves: [], amphibiousMode: false });
  },
  chooseAirCommit: (airUnitId) => {
    const { gameState } = get();
    if (!gameState) return;
    const next = confirmAirCommit(gameState, airUnitId);
    if (!next) return;
    saveGameState(next);
    // Se dopo il commit il combat ha generato un pendingCombat di tipo retreat, evidenzia hex
    if (next.pendingCombat?.kind === "retreat") {
      set({
        gameState: next,
        combatRollbackState: null,
        selectedUnit: null,
        selectedHex: null,
        validMoves: retreatMovesFor(next)
      });
      return;
    }
    set({ gameState: next, combatRollbackState: next.pendingCombat?.kind === "commit" ? get().combatRollbackState : null, validMoves: next.pendingCombat?.kind === "commit" ? commitAirMovesFor(next) : [] });
  },
  chooseEventCommit: (markerId) => {
    const { gameState } = get();
    if (!gameState) return;
    const next = commitCombatEventMarker(gameState, markerId);
    if (!next) return;
    saveGameState(next);
    set({ gameState: next, validMoves: [] });
  },
  playEventMarker: (side, markerId) => {
    const { gameState, selectedUnit, mapEventPlacement } = get();
    if (!gameState) return;

    if (markerId.toLowerCase().includes("naval evacuation")) {
      if (!selectedUnit) {
        if (typeof window !== "undefined") {
          window.alert("Naval Evacuation: seleziona prima un'unita terrestre UK in un esagono costiero, poi clicca l'evento.");
        }
        return;
      }
      if (
        mapEventPlacement?.mode === "naval-evacuation" &&
        mapEventPlacement.side === side &&
        mapEventPlacement.markerId === markerId &&
        mapEventPlacement.unitId === selectedUnit.id
      ) {
        set({ mapEventPlacement: null, validMoves: [] });
        return;
      }
      const targets = calculateNavalEvacuationTargets(gameState, selectedUnit);
      if (targets.length === 0) {
        if (typeof window !== "undefined") {
          const reasons: string[] = [];
          if (selectedUnit.country !== "UK") reasons.push("unita non UK");
          else if (selectedUnit.type === "air" || selectedUnit.type === "fort") reasons.push("deve essere un'unita di terra");
          else reasons.push("l'esagono corrente non e costiero oppure nessun porto amico disponibile come destinazione");
          window.alert(`Naval Evacuation non applicabile a ${selectedUnit.name}: ${reasons.join(", ")}.`);
        }
        return;
      }
      set({
        mapEventPlacement: { side, markerId, mode: "naval-evacuation", unitId: selectedUnit.id },
        validMoves: targets.map((coord) => ({ coord, cost: 0 })),
        selectedHex: null,
        mobilizingUnitId: null,
        airActionMode: null
      });
      return;
    }

    if (markerId.toLowerCase().includes("strategic move")) {
      if (gameState.phase !== GamePhase.STRATEGIC_MOVEMENT) return;
      if (gameState.currentSide !== side) return;
      const next = playStrategicMoveEvent(gameState, side, markerId);
      if (!next) return;
      saveGameState(next);
      set({
        gameState: next,
        mapEventPlacement: null,
        selectedUnit: null,
        selectedHex: null,
        validMoves: strategicMoveSelectableUnits(next),
        mobilizingUnitId: null,
        airActionMode: null,
        amphibiousMode: false
      });
      return;
    }

    if (isMapPlacementEvent(markerId)) {
      if (mapEventPlacement?.side === side && mapEventPlacement.markerId === markerId) {
        set({ mapEventPlacement: null, validMoves: [], selectedUnit: null });
        return;
      }
      const targets = mapEventTargets(gameState, side, markerId);
      set({
        mapEventPlacement: { side, markerId, mode: "map" },
        selectedUnit: null,
        selectedHex: null,
        mobilizingUnitId: null,
        airActionMode: null,
        validMoves: targets
      });
      return;
    }

    return;
  },
  cancelMapEventPlacement: () => {
    set({ mapEventPlacement: null, validMoves: [], selectedUnit: null });
  },

  playSovietCounterattack: (markerId) => {
    const { gameState } = get();
    if (!gameState) return;
    const next = playSovietCounterattackEvent(gameState, markerId);
    if (!next) return;
    saveGameState(next);
    set({ gameState: next, selectedUnit: null, validMoves: [] });
  },

  endSovietCounterattackAction: () => {
    const { gameState } = get();
    if (!gameState) return;
    const next = endSovietCounterattack(gameState);
    if (!next) return;
    saveGameState(next);
    set({ gameState: next, selectedUnit: null, validMoves: [] });
  },

  playRasputitsa: (markerId) => {
    const { gameState } = get();
    if (!gameState) return;
    const next = playRasputitsaEvent(gameState, markerId);
    if (!next) return;
    saveGameState(next);
    set({ gameState: next, selectedUnit: null, validMoves: [] });
  },

  applyReplacementAction: (unitId) => {
    const { gameState } = get();
    if (!gameState) return;
    const next = applyReplacement(gameState, unitId);
    if (!next) return;
    saveGameState(next);
    set({ gameState: next });
  },
  startMobilizingUnit: (unitId) => {
    const { gameState } = get();
    if (!gameState) return;
    const unit = gameState.units.get(unitId);
    if (!unit) return;
    if (get().mobilizingUnitId === unitId) {
      set({ mobilizingUnitId: null, validMoves: [] });
      return;
    }
    const hexes = legalMobilizationHexes(gameState, unit);
    if (hexes.length === 0) {
      // Niente hex valide: non entrare in modalità (l'utente non potrebbe fare nulla)
      // Mostriamo un alert come feedback temporaneo.
      if (typeof window !== "undefined") {
        window.alert(`No legal mobilization location for ${unit.name}. Possible reasons: no friendly city of ${unit.country || "country"} found, all are enemy controlled, or all are stacked.`);
      }
      return;
    }
    set({
      mobilizingUnitId: unitId,
      validMoves: hexes.map((coord) => ({ coord, cost: 0 })),
      selectedUnit: null,
      selectedHex: null,
      mapEventPlacement: null,
      airActionMode: null,
      amphibiousMode: false
    });
  },
  mobilizeUnitToCentralMed: (unitId) => {
    const { gameState, mobilizingUnitId } = get();
    if (!gameState) return;
    if (mobilizingUnitId && mobilizingUnitId !== unitId) return;
    const next = mobilizeUnitToCentralMedBox(gameState, unitId);
    if (!next) {
      if (mobilizingUnitId === unitId) {
        set({ mobilizingUnitId: null, validMoves: [] });
      }
      return;
    }
    saveGameState(next);
    set({
      gameState: next,
      mobilizingUnitId: null,
      validMoves: [],
      selectedUnit: null,
      selectedHex: null,
      mapEventPlacement: null,
      airActionMode: null,
      amphibiousMode: false
    });
  },
  cancelMobilizing: () => {
    set({ mobilizingUnitId: null, validMoves: [] });
  },
  runAiStep: () => {
    const { gameState } = get();
    if (!gameState) return null;
    const result = runAiOperationStep(gameState, gameState.currentSide);
    saveGameState(result.state);
    set({
      gameState: result.state,
      selectedUnit: null,
      selectedHex: result.decision.target || null,
      validMoves: result.state.pendingCombat?.kind === "retreat" ? retreatMovesFor(result.state) : [],
      airActionMode: null,
      amphibiousMode: false,
      mobilizingUnitId: null,
      mapEventPlacement: null,
      combatRollbackState: null
    });
    return result.decision.note;
  },
  endSelectedActivation: () => {
    const { gameState, selectedUnit } = get();
    if (!gameState || !selectedUnit) return;
    let nextState = endUnitActivation(gameState, selectedUnit.id);
    // Se il contrattacco sovietico era attivo, resettalo dopo l'attivazione
    if (nextState.sovietCounterattackActive) {
      const resetCA = endSovietCounterattack(nextState);
      if (resetCA) nextState = resetCA;
    }
    saveGameState(nextState);
    set({ gameState: nextState, selectedUnit: null, selectedHex: null, validMoves: [] });
  },
  resolvePendingAssaults: () => {
    const { gameState } = get();
    if (!gameState) return;
    // Se c'è già una decisione di combat in corso, non far partire un nuovo Assault
    if (gameState.pendingCombat) return;
    // 5.3.3: risolvi UN solo Assault designato (il primo trovato della fazione corrente).
    // Il commit/retreat/advance può richiedere più passi: l'utente cliccherà di nuovo
    // questo bottone per risolvere il prossimo.
    let firstHexKey: string | null = null;
    let firstPrimaryId: string | null = null;
    for (const u of gameState.units.values()) {
      if (u.side === gameState.currentSide && u.assaultTarget && u.status !== "destroyed") {
        firstHexKey = `${u.assaultTarget.q},${u.assaultTarget.r}`;
        firstPrimaryId = u.id;
        break;
      }
    }
    if (!firstHexKey || !firstPrimaryId) return;
    const [q, r] = firstHexKey.split(",").map(Number);
    const next = resolvePendingForHex(gameState, { q, r }, firstPrimaryId);
    if (!next) return;
    saveGameState(next);
    // Se è scattato un pendingCombat retreat, mostra le opzioni
    if (next.pendingCombat?.kind === "retreat") {
      set({
        gameState: next,
        combatRollbackState: null,
        selectedUnit: null,
        selectedHex: null,
        validMoves: retreatMovesFor(next)
      });
      return;
    }
    set({
      gameState: next,
      combatRollbackState: next.pendingCombat?.kind === "commit" ? gameState : null,
      selectedUnit: null,
      selectedHex: null,
      validMoves: []
    });
  },
  advanceGameSequence: (force = false) => {
    const { gameState } = get();
    if (!gameState) return;
    // Un combattimento a metà non può essere abbandonato: va risolto o annullato.
    if (gameState.pendingCombat) return;
    const hasPendingAssaults = Array.from(gameState.units.values()).some(
      (unit) => unit.side === gameState.currentSide && unit.assaultTarget
    );
    if (
      !force &&
      gameState.phase === GamePhase.OPERATIONS &&
      gameState.subPhase === GameSubPhase.ACTIONS &&
      hasPendingAssaults
    ) {
      return;
    }
    // 5.3.3: alla fine della Actions Sub-Phase rimuovi marker Assault non risolti.
    let preState = gameState;
    if (gameState.phase === GamePhase.OPERATIONS && gameState.subPhase === GameSubPhase.ACTIONS) {
      const units = new Map(preState.units);
      preState.units.forEach((u, id) => {
        if (u.assaultTarget) units.set(id, { ...u, assaultTarget: undefined });
      });
      preState = { ...preState, units };
    }
    const nextState = advanceSequenceStep(preState);
    saveGameState(nextState);
    const initialValidMoves = nextState.phase === GamePhase.STRATEGIC_MOVEMENT
      ? strategicMoveSelectableUnits(nextState)
      : [];
    set({
      gameState: nextState,
      selectedUnit: null,
      selectedHex: null,
      validMoves: initialValidMoves,
      mobilizingUnitId: null,
      airActionMode: null,
      amphibiousMode: false,
      attackMode: "mobile"
    });
  },
  setPrivateMapImage: (imageDataUrl) => {
    const mapId = currentMapIdForState(get().gameState);
    const privateMapLayer = { ...get().privateMapLayer, imageDataUrl, showProceduralTerrain: false };
    savePrivateMapLayer(mapId, privateMapLayer);
    set({ privateMapLayer });
  },
  updatePrivateMapLayer: (settings) => {
    const scenarioId = (get().gameState?.scenarioId as ScenarioId | undefined) || "france1940";
    const mapId = mapIdForScenario(scenarioId);
    const privateMapLayer = { ...get().privateMapLayer, ...settings };
    savePrivateMapLayer(mapId, privateMapLayer);
    const dimensionsChanged =
      settings.gridColumns !== undefined ||
      settings.gridRows !== undefined ||
      settings.gridShortRowColumns !== undefined ||
      settings.shortRowsStart !== undefined;

    if (dimensionsChanged) {
      const gameState = createGameForLayer(privateMapLayer, scenarioId);
      saveGameState(gameState);
      set({
        privateMapLayer,
        gameState,
        selectedUnit: null,
        selectedHex: null,
        validMoves: [],
        mobilizingUnitId: null,
        mapEventPlacement: null,
        airActionMode: null,
        amphibiousMode: false
      });
      return;
    }

    set({ privateMapLayer });
  },
  saveCurrentCalibration: (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const existing = get().savedCalibrations;
    const currentGameState = get().gameState;
    const mapId = currentMapIdForState(currentGameState);
    const savedCalibration: SavedCalibration = {
      id: `cal_${Date.now()}`,
      name: trimmedName,
      calibration: toCalibration(get().privateMapLayer),
      gameState: currentGameState ? serializeGameState(currentGameState) : undefined,
      updatedAt: new Date().toISOString()
    };
    const savedCalibrations = [savedCalibration, ...existing.filter((item) => item.name !== trimmedName)];
    saveSavedCalibrations(mapId, savedCalibrations);
    set({ savedCalibrations });
  },
  loadCalibration: (id) => {
    const saved = get().savedCalibrations.find((item) => item.id === id);
    if (!saved) return;

    const privateMapLayer = {
      ...get().privateMapLayer,
      ...saved.calibration,
      imageDataUrl: get().privateMapLayer.imageDataUrl
    };
    const gameState = saved.gameState ? deserializeGameState(saved.gameState) : get().gameState;
    const mapId = currentMapIdForState(gameState);
    if (gameState) saveGameState(gameState);
    savePrivateMapLayer(mapId, privateMapLayer);
    set({
      privateMapLayer,
      gameState,
      selectedUnit: null,
      selectedHex: null,
      validMoves: [],
      mobilizingUnitId: null,
      mapEventPlacement: null,
      airActionMode: null,
      amphibiousMode: false
    });
  },
  deleteCalibration: (id) => {
    const savedCalibrations = get().savedCalibrations.filter((item) => item.id !== id);
    saveSavedCalibrations(currentMapIdForState(get().gameState), savedCalibrations);
    set({ savedCalibrations });
  },
  exportScenario: () => serializeScenario(get().privateMapLayer, get().gameState),
  importScenario: (contents) => {
    try {
      const imported = deserializeScenario(contents);
      const gameState = withScenarioSetup(imported.gameState || createGameForLayer(imported.privateMapLayer));
      const mapId = currentMapIdForState(gameState);
      savePrivateMapLayer(mapId, imported.privateMapLayer);
      saveGameState(gameState);
      saveScenarioToIndexedDb(imported.privateMapLayer, gameState);
      set({
        privateMapLayer: imported.privateMapLayer,
        gameState,
        selectedUnit: null,
        selectedHex: null,
        validMoves: [],
        mobilizingUnitId: null,
        mapEventPlacement: null,
        airActionMode: null,
        amphibiousMode: false,
        savedCalibrations: loadSavedCalibrations(mapId)
      });
      return true;
    } catch {
      return false;
    }
  },
  updateProductionPoints: (side, country, points) => {
    const { gameState } = get();
    if (!gameState) return;

    const card = gameState.factionCards[side];
    const nextState = {
      ...gameState,
      factionCards: {
        ...gameState.factionCards,
        [side]: {
          ...card,
          productionPoints: {
            ...card.productionPoints,
            [country]: Math.max(0, points)
          }
        }
      },
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  assignDefaultFrenchHexes: () => {
    const { gameState } = get();
    if (!gameState) return;

    const nextMap = new Map(gameState.map);
    nextMap.forEach((hex, key) => {
      const terrainTags = hex.terrainTags || [];
      const isSeaOnly = hex.terrain === TerrainType.SEA || (terrainTags.includes("sea") && !terrainTags.includes("coast"));
      if (hex.features.country || hex.features.prohibited || isSeaOnly) return;

      nextMap.set(key, {
        ...hex,
        features: {
          ...hex.features,
          country: "France",
          controller: hex.features.controller || Side.ALLIED
        }
      });
    });

    const nextState = {
      ...gameState,
      map: nextMap,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  assignScenarioControl: () => {
    const { gameState } = get();
    if (!gameState) return;

    const nextMap = new Map(gameState.map);
    nextMap.forEach((hex, key) => {
      const terrainTags = hex.terrainTags || [];
      const isSeaOnly = hex.terrain === TerrainType.SEA || (terrainTags.includes("sea") && !terrainTags.includes("coast"));
      const country = hex.features.country;
      let controller = hex.features.controller;

      if (hex.features.prohibited || isSeaOnly) {
        controller = undefined;
      } else {
        controller = initialControllerForEditorCountry(country, (gameState.scenarioId as ScenarioId | undefined) || "procedural") || hex.features.controller;
      }

      nextMap.set(key, {
        ...hex,
        features: {
          ...hex.features,
          controller
        }
      });
    });

    const nextState = {
      ...gameState,
      map: nextMap,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  updateHexTerrain: (hex, terrain) => {
    const { gameState } = get();
    if (!gameState) return;

    const hexKey = `${hex.q},${hex.r}`;
    const currentHex = gameState.map.get(hexKey);
    if (!currentHex) return;

    const nextMap = new Map(gameState.map);
    nextMap.set(hexKey, {
      ...currentHex,
      terrain,
      terrainTags: currentHex.terrainTags?.length ? currentHex.terrainTags : [terrain as unknown as TerrainTag],
      features: {
        ...currentHex.features,
        city: terrain === TerrainType.CITY ? true : currentHex.features.city
      }
    });
    const nextState = {
      ...gameState,
      map: nextMap,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  toggleHexTerrainTag: (hex, terrainTag) => {
    const { gameState } = get();
    if (!gameState) return;

    const hexKey = `${hex.q},${hex.r}`;
    const currentHex = gameState.map.get(hexKey);
    if (!currentHex) return;

    const currentTags = currentHex.terrainTags || [];
    const terrainTags = currentTags.includes(terrainTag)
      ? currentTags.filter((tag) => tag !== terrainTag)
      : [...currentTags, terrainTag];
    const primaryTerrain =
      terrainTags.includes("sea") ? TerrainType.SEA :
      terrainTags.includes("swamp") ? TerrainType.SWAMP :
      terrainTags.includes("mountain") ? TerrainType.MOUNTAIN :
      terrainTags.includes("forest") ? TerrainType.FOREST :
      terrainTags.includes("coast") ? TerrainType.COASTAL :
      TerrainType.PLAIN;

    const nextMap = new Map(gameState.map);
    nextMap.set(hexKey, {
      ...currentHex,
      terrain: primaryTerrain,
      terrainTags
    });
    const nextState = {
      ...gameState,
      map: nextMap,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  updateHexFeatures: (hex, features) => {
    const { gameState } = get();
    if (!gameState) return;

    const hexKey = `${hex.q},${hex.r}`;
    const currentHex = gameState.map.get(hexKey);
    if (!currentHex) return;

    const nextMap = new Map(gameState.map);
    nextMap.set(hexKey, {
      ...currentHex,
      features: {
        ...currentHex.features,
        ...features
      }
    });
    const nextState = {
      ...gameState,
      map: nextMap,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  toggleRailSide: (hex, side) => {
    const { gameState } = get();
    if (!gameState) return;

    const hexKey = `${hex.q},${hex.r}`;
    const currentHex = gameState.map.get(hexKey);
    if (!currentHex) return;

    const currentRailEdges = currentHex.railEdges || [];
    const railEdges = currentRailEdges.includes(side)
      ? currentRailEdges.filter((railSide) => railSide !== side)
      : [...currentRailEdges, side];

    const nextMap = new Map(gameState.map);
    nextMap.set(hexKey, { ...currentHex, railEdges });
    const nextState = {
      ...gameState,
      map: nextMap,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  toggleRiverEdge: (from, to) => {
    const { gameState } = get();
    if (!gameState) return;

    const key = edgeKey(from, to);
    const riverEdges = new Set(gameState.riverEdges);
    if (riverEdges.has(key)) riverEdges.delete(key);
    else riverEdges.add(key);

    const nextState = {
      ...gameState,
      riverEdges,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  toggleMountainEdge: (from, to) => {
    const { gameState } = get();
    if (!gameState) return;

    const key = edgeKey(from, to);
    const mountainEdges = new Set(gameState.mountainEdges);
    if (mountainEdges.has(key)) mountainEdges.delete(key);
    else mountainEdges.add(key);

    const nextState = {
      ...gameState,
      mountainEdges,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  toggleStraitEdge: (from, to) => {
    const { gameState } = get();
    if (!gameState) return;

    const key = edgeKey(from, to);
    const straitEdges = new Set(gameState.straitEdges);
    if (straitEdges.has(key)) straitEdges.delete(key);
    else straitEdges.add(key);

    const nextState = {
      ...gameState,
      straitEdges,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  },
  toggleImpassableEdge: (from, to) => {
    const { gameState } = get();
    if (!gameState) return;

    const key = edgeKey(from, to);
    const impassableEdges = new Set(gameState.impassableEdges);
    if (impassableEdges.has(key)) impassableEdges.delete(key);
    else impassableEdges.add(key);

    const nextState = {
      ...gameState,
      impassableEdges,
      timestamp: new Date()
    };
    saveGameState(nextState);
    set({ gameState: nextState });
  }
}));

// Espone lo store in window per ispezione da DevTools (utile per debug e prove rapide)
if (typeof window !== "undefined") {
  (window as unknown as { useGameStore?: typeof useGameStore }).useGameStore = useGameStore;
}

let persistentScenarioSaveTimer: number | undefined;
let lastPendingRetreatRef: object | null = null;

useGameStore.subscribe((state) => {
  if (persistentScenarioSaveTimer) {
    window.clearTimeout(persistentScenarioSaveTimer);
  }
  persistentScenarioSaveTimer = window.setTimeout(() => {
    saveScenarioToIndexedDb(state.privateMapLayer, state.gameState);
  }, 300);

  // Quando pendingCombat={retreat} appare in seguito a una transizione, popola
  // validMoves con le opzioni così l'UI le evidenzia (5.3.5).
  const pending = state.gameState?.pendingCombat;
  const ref = pending?.kind === "retreat" ? pending : null;
  if (ref !== lastPendingRetreatRef) {
    lastPendingRetreatRef = ref;
    if (ref) {
      const moves = state.gameState ? retreatMovesFor(state.gameState) : [];
      // setState non triggera re-fire di questo stesso subscribe ricorsivamente
      // perché lastPendingRetreatRef è già stato aggiornato.
      useGameStore.setState({ validMoves: moves });
    }
  }
});
