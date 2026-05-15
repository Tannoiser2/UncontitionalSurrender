/**
 * Configurazione del gioco
 * Parametri MVP per Western Campaign
 */

export const GAME_CONFIG = {
  // ============ MVP SETUP ============
  MVP: {
    // Mappe piccole per test veloce (6x8 hex)
    MAP_WIDTH: 12,
    MAP_HEIGHT: 16,
    STARTING_UNITS: 8,
    TURNS_PER_GAME: 20,
    REAL_WORLD_SCALE: "1 hex = ~5km"
  },

  // ============ AI PARAMETERS ============
  AI: {
    MINIMAX_DEPTH: 5, // Profondità albero ricerca (scalabile)
    TIMEOUT_MS: 3000, // Timeout per mossa IA
    ALPHA_BETA_PRUNING: true,
    TRANSPOSITION_TABLE: true,
    EVALUATION_WEIGHTS: {
      territorial_control: 0.3,
      unit_strength: 0.25,
      supply_lines: 0.2,
      morale: 0.15,
      casualties_ratio: 0.1
    }
  },

  // ============ DISPLAY ============
  DISPLAY: {
    HEX_SIZE: 40, // Pixel per hex
    GRID_TYPE: "offset", // "cube" o "offset"
    ANIMATION_SPEED_MS: 300,
    SHOW_ZOC: true,
    SHOW_SUPPLY_LINES: true
  },

  // ============ DIFFICULTY ============
  DIFFICULTY_LEVELS: {
    EASY: { depth: 3, evaluation_variance: 0.2 },
    NORMAL: { depth: 5, evaluation_variance: 0.1 },
    HARD: { depth: 7, evaluation_variance: 0.05 }
  }
};

// Unità di test per MVP
export const TEST_UNITS = [
  // Asse (Rosso)
  {
    id: "axis_inf_1",
    name: "Deutsche Infanterie I",
    type: "infantry",
    side: "axis",
    strength: 8,
    leadership: 3
  },
  {
    id: "axis_armor_1",
    name: "Panzer Kompanie I",
    type: "armor",
    side: "axis",
    strength: 6,
    leadership: 2
  },

  // Alleati (Blu)
  {
    id: "allied_inf_1",
    name: "US Infantry Company A",
    type: "infantry",
    side: "allied",
    strength: 7,
    leadership: 2
  },
  {
    id: "allied_armor_1",
    name: "Sherman Platoon 1",
    type: "armor",
    side: "allied",
    strength: 5,
    leadership: 2
  }
];

export const API_CONFIG = {
  BASE_URL: "http://localhost:3001",
  WEBSOCKET_URL: "ws://localhost:3001",
  API_TIMEOUT: 10000
};
