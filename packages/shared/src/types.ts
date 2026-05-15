/**
 * Schemi dati comuni per USWC Digital
 * Tipi di base per unità, mappa, gioco
 */

// ============ ENUM E COSTANTI ============

export enum Side {
  AXIS = "axis",
  ALLIED = "allied"
}

export enum UnitType {
  INFANTRY = "infantry",
  ARMOR = "armor",
  AIR = "air",
  CAVALRY = "cavalry",
  ARTILLERY = "artillery",
  SUPPORT = "support",
  FORT = "fort"
}

export enum UnitStatus {
  READY = "ready",
  DEMORALISED = "demoralised",
  DISRUPTED = "disrupted",
  DESTROYED = "destroyed"
}

// 7.1: Supply State (Full / Low / No). Le unità nuove sono Full Supply.
export enum SupplyState {
  FULL = "full",
  LOW = "low",
  NO = "no"
}

// ============ UNITÀ MILITARI ============

export interface Unit {
  id: string;
  name: string;
  side: Side;
  country?: string;
  type: UnitType;
  strength: number; // Mantenuto per retro-compatibilità ma USWC è a due stati: full vs reduced
  maxStrength: number;
  reduced?: boolean; // 5.3.6 / 8.1: unità a reduced strength (flip side). Se true e subisce passo perdita, viene eliminata.
  elite?: boolean; // DRM list: +1 Elite unit (stella sul counter)
  occupyingFort?: boolean; // 4.2.3.5 / 1.7: ground unit inside a friendly fort; it does not exert ZOC
  status: UnitStatus;
  morale: number; // 0-10
  position: HexCoord;
  mapPresence?: "france" | "off_map" | "west_med" | "central_med" | "east_na";
  moved: boolean;
  activated?: boolean; // 6.0/6.3: l'unità ha completato la sua attivazione in questo turno?
  movementSpent?: number;
  sorties?: number;
  combat: boolean;
  leadership: number;
  strategicMove?: boolean; // 4.1
  assaultTarget?: HexCoord; // 5.3.3: marker Assault designato verso questo hex
  hasMobileAttacked?: boolean; // 4.2.3.1: una volta attaccato in mobile, le restrizioni cambiano
  supplyState?: SupplyState; // 7.1: undefined = Full
  supplySourceType?: "unlimited" | "limited";
  supplySourceCoord?: HexCoord;
  supplyPath?: HexCoord[];
  supplyCheckedTurn?: number;
  bomber?: boolean; // distinzione fighter/bomber (8.1: replacement cost differente)
  entryTurn?: number; // Turno minimo in cui l'unità può entrare in mobilizationBox (scheduled reinforcement)
  freeMobilization?: boolean; // Se true, la mobilizzazione non costa PP (Emergency Mobilization, ecc.)
  improvedThisTurn?: boolean; // 8.1: una sola replacement per turno per unità
}

// ============ MAPPA E COORDINATE ============

export interface HexCoord {
  q: number; // Coordinate cubiche
  r: number;
}

export interface Hex {
  coord: HexCoord;
  terrain: TerrainType;
  terrainTags: TerrainTag[];
  features: HexFeatures;
  railEdges: HexSide[];
  zoc: Set<string>; // ID unità che controllano questa hex
  units: string[]; // ID unità presenti
  supply: number; // 0-10 livello rifornimenti
  noEzocMarker?: boolean; // 14.8: marker No EZOC presente
}

export type TerrainTag = "plain" | "mountain" | "forest" | "swamp" | "sea" | "coast";
export type HexSide = "N" | "NE" | "SE" | "S" | "SW" | "NW";
export type HexController = Side | "neutral";

export interface HexFeatures {
  name?: string;
  country?: string;
  controller?: HexController;
  disputedArea?: string;
  city: boolean;
  port: boolean;
  productionCenter: boolean;
  capital: boolean;
  prohibited: boolean;
  fadedDot: boolean;
}

export enum TerrainType {
  PLAIN = "plain",
  FOREST = "forest",
  MOUNTAIN = "mountain",
  SWAMP = "swamp",
  RIVER = "river",
  CITY = "city",
  COASTAL = "coastal",
  SEA = "sea"
}

export type GameMap = Map<string, Hex>; // Key: "q,r"

// ============ STATO DI GIOCO ============

// 2.1.1 / 12.1: stato di un paese
export type CountryStatus = "active" | "collapsed" | "conquered";

export interface FactionCardState {
  side: Side;
  productionPoints: Record<string, number | null>; // null = NA (illimitato, 9.1.1)
  nationalWill: Record<string, number | null>;
  countryStatus?: Record<string, CountryStatus>; // 12.1: tracking active/collapsed/conquered
  countryInitialNationalWill?: Record<string, number | null>; // 12.1.1 step 2: per reset NW a metà al collapse
  eventsBox: string[];
  eliminatedBox: string[];
  mobilizationBox: string[];
}

export interface EventTurnTrackEntry {
  markerId: string;
  side: Side;
  returnTurn: number;
}

export interface MapEventMarkerDetail {
  markerId: string;
  side: Side;
  kind: "airdrop" | "partisans" | "surprise" | "mulberry";
  coordKey: string;
}

export interface GameState {
  id: string;
  scenarioId?: string;
  turn: number;
  turnCode: string;
  phase: GamePhase;
  subPhase: GameSubPhase;
  currentSide: Side;
  weather: WeatherType;
  previousWeather?: WeatherType;
  weatherRoll?: number;
  weatherMap: WeatherMapCategory;
  factionCards: Record<Side, FactionCardState>;
  strategicMoveUsed?: Partial<Record<Side, boolean>>; // 4.1: marker già piazzato in questo turno?
  centralMedInvasionUsed?: Partial<Record<Side, boolean>>; // 21.7.3: una invasione per turno dalla Central Mediterranean Box
  fnaAxisAirSortiesUsed?: number; // 21.6: 2 free German fighter sorties/turn from 4526
  pendingCombat?: PendingCombatDecision; // 5.3.5/5.3.7
  surpriseAttackMarkers?: Partial<Record<Side, string[]>>; // 6.1/13.9: hex codes con marker
  airdropMarkers?: Partial<Record<Side, string[]>>; // 13.x: hex codes con marker Airdrop
  mulberryMarkers?: Partial<Record<Side, string[]>>; // 13.x: hex codes con marker Mulberry
  partisansMarkers?: Partial<Record<Side, string[]>>; // 13.6: hex codes con marker
  mapEventMarkerDetails?: MapEventMarkerDetail[];
  eventTurnTrack?: EventTurnTrackEntry[];
  blitzkriegActive?: boolean; // Barbarossa Jun-41: Panzer tedeschi hanno movimento doppio
  sovietCounterattackActive?: boolean; // Barbarossa: URSS può attivare un'unità durante Operazioni Asse
  rasputitsaAvailable?: boolean; // Barbarossa: URSS può annullare un attacco Asse (usato prima della risoluzione)
  victory?: { winner: Side | "draw"; reason: string }; // 11.1: settato quando viene determinata la vittoria
  scenarioEndsTurn?: number; // 14.2: turno entro cui dichiarare la vittoria
  units: Map<string, Unit>;
  map: GameMap;
  riverEdges: Set<string>; // Key: sorted "q,r|q,r" between adjacent hexes
  mountainEdges: Set<string>; // Key: sorted "q,r|q,r" between adjacent hexes
  straitEdges: Set<string>; // 5.3.4: attacker crossing a strait gets -1...-2 DRM
  impassableEdges: Set<string>; // Key: sorted "q,r|q,r" between adjacent hexes
  history: GameAction[];
  timestamp: Date;
}

export enum GamePhase {
  WEATHER = "weather",
  ECONOMY = "economy",
  STRATEGIC_MOVEMENT = "strategic_movement",
  OPERATIONS = "operations",
  NO_SUPPLY = "no_supply",
  REPLACEMENTS = "replacements",
  MOBILIZATION = "mobilization",
  VICTORY_CHECK = "victory_check",
  PLANNING = "planning", // Decisioni
  MOVEMENT = "movement", // Movimento unità
  COMBAT = "combat", // Risoluzione combattimenti
  SUPPLY = "supply", // Controllo rifornimenti
  END_TURN = "end_turn" // Fine turno
}

export enum GameSubPhase {
  NONE = "none",
  WEATHER_ROLL = "weather_roll",
  FACTION_STEP = "faction_step",
  ACTIONS = "actions",
  SUPPLY_CHECK = "supply_check",
  CHECK = "check"
}

export enum WeatherType {
  FAIR = "fair",
  POOR = "poor",
  SEVERE = "severe"
}

export enum WeatherMapCategory {
  BALKANS_FNA_ITALY = "balkans_fna_italy",
  OTHER_MAPS = "other_maps"
}

// ============ AZIONI E TURNI ============

export interface GameAction {
  type: ActionType;
  side: Side;
  unitId?: string;
  fromPos?: HexCoord;
  toPos?: HexCoord;
  targetUnitId?: string;
  note?: string;
  result?: CombatResult;
  timestamp: Date;
}

export enum ActionType {
  MOVE = "move",
  ATTACK = "attack",
  HOLD = "hold",
  RETREAT = "retreat",
  REORGANIZE = "reorganize",
  DESIGNATE_ASSAULT = "designate_assault",
  END_ACTIVATION = "end_activation"
}

// 5.x Combat Results Table
export enum CombatResultCode {
  NO_EFFECT = "NE", // ♦
  DR = "DR", // Defender Retreat
  DD = "DD", // Defender Disrupted
  DE = "DE", // Defender Eliminated
  AS = "AS", // Attacker Stopped
  AA = "AA"  // Attacker Attrition
}

export interface CombatResultEntry {
  code: CombatResultCode;
  bonus: number; // il "+#" sortie/morale (ignorato per combat di terra)
}

export enum AttackType {
  MOBILE = "mobile",
  ASSAULT = "assault"
}

export type PendingCombatKind = "commit" | "retreat" | "advance";

export interface PendingCommitState {
  kind: "commit";
  attackerId: string;
  defenderId: string;
  attackType: AttackType;
  isAmphibious?: boolean;
  additionalAttackerIds: string[];
  eventMarkerAttackerIds?: string[];
  eventMarkerDefenderIds?: string[];
  // Stage del Will Commit step (5.1 step 2): prima sceglie l'attaccante, poi il difensore.
  stage: "attacker" | "defender";
  airSupportAttackerId?: string;
  airSupportDefenderId?: string;
}

export interface PendingRetreatOrAdvance {
  kind: "retreat" | "advance";
  attackerId: string;
  advanceAttackerIds?: string[];
  defenderId: string;
  attackType: AttackType;
  options: HexCoord[];
  defenderHex: HexCoord;
  resultCode: CombatResultCode;
  followUpAdvance?: boolean;
  forceAdvance?: boolean;
  allowDefenderCannotRetreat?: boolean;
}

export type PendingCombatDecision = PendingCommitState | PendingRetreatOrAdvance;

// ============ COMBATTIMENTO ============

export interface CombatResolution {
  attackerUnits: Unit[];
  defenderUnits: Unit[];
  rolls: DiceRoll[];
  modifiers: CombatModifiers;
  casualties: CasualtiesResult;
}

export interface DiceRoll {
  sides: number;
  result: number;
  modifier: number;
  finalResult: number;
}

export interface CombatModifiers {
  terrain: number;
  morale: number;
  leadership: number;
  surprise: number;
  total: number;
}

export interface CasualtiesResult {
  attackerLosses: number;
  defenderLosses: number;
  winner: Side | "draw";
  moraleDamage: number;
}

export type CombatResult = CasualtiesResult;

// ============ MOVIMENTO ============

export interface MovementCost {
  baseCost: number;
  terrainCost: number;
  zocCost: number;
  totalCost: number;
}

export interface MovePath {
  start: HexCoord;
  end: HexCoord;
  hexes: HexCoord[];
  movementPoints: number;
  isLegal: boolean;
}

// ============ EXPORT INDEX ============

export * from "./rules";
export * from "./config";
