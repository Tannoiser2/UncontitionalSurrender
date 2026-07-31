/**
 * Regole di gioco USWC
 * Movimenti, ZOC, combattimento, supply
 */

export const GAME_RULES = {
  // ============ MOVIMENTO ============
  MOVEMENT: {
    LEG_FULL_SUPPLY_MP: 8,
    LEG_REDUCED_SUPPLY_MP: 4,
    MOBILE_FULL_SUPPLY_MP: 10,
    MOBILE_REDUCED_SUPPLY_MP: 5,
    BASE_MP: 10, // Fallback legacy per unità mobili/full supply
    TERRAIN_COSTS: {
      plain: 1,
      forest: 2,
      mountain: 2,
      swamp: 2,
      river: 1,
      city: 1,
      coastal: 1,
      sea: 99
    },
    ZOC_EXIT_COST: 0, // USWC limita il movimento in EZOC invece di applicare un costo fisso.
    ZOC_COST: 0, // Legacy alias
    ZOC_RANGE: 1 // Hex di distanza per ZOC
  },

  AIR: {
    AIR_STRIKE_RANGE: 7,
    AIR_SUPPORT_RANGE: 5,
    MAX_SORTIES: 6
  },

  // ============ COMBATTIMENTO ============
  COMBAT: {
    BASE_STRENGTH_RATIO: 1.5, // Rapporto forze richiesto per vittoria
    DICE_SIDES: 6,
    CASUALTY_PERCENTAGE: 0.3, // % di perdite base
    MORALE_DAMAGE_LOSS: 2, // Danno morale per perdita
    MORALE_DAMAGE_WIN: -1 // Miglioramento morale per vittoria
  },

  // ============ MORALE ============
  MORALE: {
    MAX: 10,
    MIN: 0,
    ROUTE_THRESHOLD: 2, // Morale minimo prima di ritirata
    RALLY_RATE: 1, // Recupero morale per turno
    LEADERSHIP_BONUS_PER_LEVEL: 0.5 // Bonus per leadership
  },

  // ============ SUPPLY ============
  SUPPLY: {
    MAX: 10,
    CONSUMPTION_PER_TURN: 1,
    ISOLATED_PENALTY: 0.5, // Moltiplicatore consumo quando isolate
    SUPPLY_RANGE: 5 // Hex di distanza da depot
  },

  // ============ ZOC (ZONE OF CONTROL) ============
  ZOC: {
    ACTIVE_AT_STRENGTH: 1, // Forza minima per ZOC attiva
    AFFECTS_MOVEMENT: true,
    AFFECTS_RETREAT: true,
    AFFECTS_COMBAT: true
  }
};

export const MODIFIERS = {
  TERRAIN_BONUS: {
    defender_forest: 1,
    defender_mountain: 2,
    defender_city: 1,
    defender_river: 1,
    attacker_open_ground: -1
  },
  
  MORALE_EFFECT: {
    10: 2, // Morale massimo = +2
    7: 1,
    5: 0,
    3: -1,
    0: -3 // Morale minimo = -3
  },

  LEADERSHIP_LEVELS: {
    1: -1,
    2: 0,
    3: 1
  },

  SURPRISE: 3 // Bonus se attacco sorpresa
};

export function getTerrainMovementCost(terrain: string): number {
  return GAME_RULES.MOVEMENT.TERRAIN_COSTS[terrain as keyof typeof GAME_RULES.MOVEMENT.TERRAIN_COSTS] || 1;
}

export function calculateCombatModifier(morale: number, leadership: number): number {
  const moraleModifier = MODIFIERS.MORALE_EFFECT[Math.min(morale, 10) as keyof typeof MODIFIERS.MORALE_EFFECT] || 0;
  const leadershipModifier = MODIFIERS.LEADERSHIP_LEVELS[Math.min(leadership, 3) as keyof typeof MODIFIERS.LEADERSHIP_LEVELS] || 0;
  return moraleModifier + leadershipModifier;
}

// 5.0 Combat Results Table (USWC Player Aid Sheet)
// Righe = defender final value (1-16+), Colonne = attacker final value (1-16+)
// Valori finali < 1 vengono trattati come 1 (5.1 step 5)
// NB: usiamo stringhe letterali invece di importare CombatResultCode da ./types
// per evitare ciclo (types.ts re-esporta rules.ts).

const NE = "NE+0";
const DR = "DR+2";
const DD = "DD+3";
const DE = "DE+4";
const AS = "AS+2";
const AA = "AA+3";

// Indici: GROUND_CRT[defender-1][attacker-1]
// Trascritto dal Player Aid Sheet (Tabelle US.pdf, Combat Results Table).
// Tabella 16x16. Per def/att > 16 si usa la riga/colonna 16.
export const GROUND_CRT: string[][] = [
  //     att:1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16
  /* def  1 */ [NE, NE, DR, DR, DR, DD, DD, DD, DE, DE, DE, DE, DE, DE, DE, DE],
  /* def  2 */ [NE, NE, NE, DR, DR, DR, DD, DD, DD, DE, DE, DE, DE, DE, DE, DE],
  /* def  3 */ [AS, NE, NE, NE, DR, DR, DR, DD, DD, DD, DD, DD, DE, DE, DE, DE],
  /* def  4 */ [AS, AS, NE, NE, NE, DR, DR, DR, DR, DD, DD, DD, DD, DD, DD, DE],
  /* def  5 */ [AS, AS, AS, NE, NE, NE, NE, DR, DR, DR, DD, DD, DD, DD, DD, DD],
  /* def  6 */ [AA, AS, AS, AS, NE, NE, NE, NE, DR, DR, DR, DR, DR, DR, DD, DD],
  /* def  7 */ [AA, AA, AS, AS, NE, NE, NE, NE, NE, DR, DR, DR, DR, DR, DR, DD],
  /* def  8 */ [AA, AA, AA, AS, AS, NE, NE, NE, NE, NE, DR, DR, DR, DR, DR, DR],
  /* def  9 */ [AA, AA, AA, AS, AS, AS, NE, NE, NE, NE, NE, DR, DR, DR, DR, DR],
  /* def 10 */ [AA, AA, AA, AA, AS, AS, AS, NE, NE, NE, NE, NE, DR, DR, DR, DR],
  /* def 11 */ [AA, AA, AA, AA, AS, AS, AS, AS, NE, NE, NE, NE, NE, DR, DR, DR],
  /* def 12 */ [AA, AA, AA, AA, AA, AS, AS, AS, AS, NE, NE, NE, NE, NE, NE, DR],
  /* def 13 */ [AA, AA, AA, AA, AA, AS, AS, AS, AS, AS, NE, NE, NE, NE, NE, DR],
  /* def 14 */ [AA, AA, AA, AA, AA, AA, AS, AS, AS, AS, AS, NE, NE, NE, NE, NE],
  /* def 15 */ [AA, AA, AA, AA, AA, AA, AS, AS, AS, AS, AS, NE, NE, NE, NE, NE],
  /* def 16 */ [AA, AA, AA, AA, AA, AA, AA, AS, AS, AS, AS, AS, AS, NE, NE, NE]
];

// Ritorna codice come stringa ("NE"|"DR"|"DD"|"DE"|"AS"|"AA"); il caller lo casta a CombatResultCode.
export const lookupAirCrtResult = (attackerFinal: number, defenderFinal: number): { code: string; bonus: number } => {
  const att = Math.max(1, Math.min(16, attackerFinal));
  const def = Math.max(1, Math.min(16, defenderFinal));
  const cell = GROUND_CRT[def - 1][att - 1];
  const [codeStr, bonusStr] = cell.split("+");
  return { code: codeStr, bonus: Number(bonusStr) };
};

export const lookupGroundCrtResult = (attackerFinal: number, defenderFinal: number): { code: string } => {
  const { code } = lookupAirCrtResult(attackerFinal, defenderFinal);
  return { code };
};
