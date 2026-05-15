import { describe, expect, it } from "vitest";
import { GROUND_CRT, lookupGroundCrtResult, lookupAirCrtResult } from "../rules";

// Snapshot esplicito della Combat Results Table (Tabelle US.pdf / Player Aid Sheet).
// Righe = defender final (1..16), Colonne = attacker final (1..16).
// Sintassi: "CODE+BONUS" dove CODE ∈ {NE, DR, DD, DE, AS, AA} e BONUS è il
// numero di sortie/step extra. Se questa tabella va modificata, è quasi
// certamente perché stai sbagliando: ricontrolla il PDF prima di toccare il
// test o GROUND_CRT.
const EXPECTED_CRT: string[][] = [
  // def\att      1     2     3     4     5     6     7     8     9    10    11    12    13    14    15    16
  /*  1 */ ["NE+0","NE+0","DR+2","DR+2","DR+2","DD+3","DD+3","DD+3","DE+4","DE+4","DE+4","DE+4","DE+4","DE+4","DE+4","DE+4"],
  /*  2 */ ["NE+0","NE+0","NE+0","DR+2","DR+2","DR+2","DD+3","DD+3","DD+3","DE+4","DE+4","DE+4","DE+4","DE+4","DE+4","DE+4"],
  /*  3 */ ["AS+2","NE+0","NE+0","NE+0","DR+2","DR+2","DR+2","DD+3","DD+3","DD+3","DE+4","DE+4","DE+4","DE+4","DE+4","DE+4"],
  /*  4 */ ["AS+2","AS+2","NE+0","NE+0","NE+0","DR+2","DR+2","DR+2","DR+2","DD+3","DD+3","DD+3","DD+3","DD+3","DE+4","DE+4"],
  /*  5 */ ["AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0","DR+2","DR+2","DR+2","DD+3","DD+3","DD+3","DD+3","DD+3","DD+3"],
  /*  6 */ ["AA+3","AS+2","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","DR+2","DR+2","DR+2","DR+2","DR+2","DR+2","DD+3","DD+3"],
  /*  7 */ ["AA+3","AA+3","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0","DR+2","DR+2","DR+2","DR+2","DR+2","DR+2","DD+3"],
  /*  8 */ ["AA+3","AA+3","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0","NE+0","DR+2","DR+2","DR+2","DR+2","DR+2","DR+2"],
  /*  9 */ ["AA+3","AA+3","AS+2","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0","NE+0","DR+2","DR+2","DR+2","DR+2","DR+2"],
  /* 10 */ ["AA+3","AA+3","AA+3","AS+2","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0","NE+0","DR+2","DR+2","DR+2","DR+2"],
  /* 11 */ ["AA+3","AA+3","AA+3","AS+2","AS+2","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0","NE+0","DR+2","DR+2","DR+2"],
  /* 12 */ ["AA+3","AA+3","AA+3","AA+3","AS+2","AS+2","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0","NE+0","DR+2","DR+2"],
  /* 13 */ ["AA+3","AA+3","AA+3","AA+3","AS+2","AS+2","AS+2","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0","DR+2","DR+2"],
  /* 14 */ ["AA+3","AA+3","AA+3","AA+3","AA+3","AS+2","AS+2","AS+2","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0","NE+0"],
  /* 15 */ ["AA+3","AA+3","AA+3","AA+3","AA+3","AA+3","AS+2","AS+2","AS+2","AS+2","AS+2","NE+0","NE+0","NE+0","NE+0","NE+0"],
  /* 16 */ ["AA+3","AA+3","AA+3","AA+3","AA+3","AA+3","AA+3","AS+2","AS+2","AS+2","AS+2","AS+2","AS+2","NE+0","NE+0","NE+0"]
];

describe("GROUND_CRT shape", () => {
  it("ha esattamente 16 righe", () => {
    expect(GROUND_CRT).toHaveLength(16);
  });

  it("ogni riga ha esattamente 16 colonne", () => {
    GROUND_CRT.forEach((row, idx) => {
      expect(row, `row def=${idx + 1}`).toHaveLength(16);
    });
  });

  it("ogni cella è nella forma CODE+BONUS con CODE valido", () => {
    const valid = new Set(["NE", "DR", "DD", "DE", "AS", "AA"]);
    for (let def = 0; def < 16; def++) {
      for (let att = 0; att < 16; att++) {
        const cell = GROUND_CRT[def][att];
        const [code, bonusStr] = cell.split("+");
        expect(valid.has(code), `def=${def + 1} att=${att + 1} cell=${cell}`).toBe(true);
        expect(Number.isFinite(Number(bonusStr)), `def=${def + 1} att=${att + 1} cell=${cell}`).toBe(true);
      }
    }
  });
});

describe("GROUND_CRT contenuto (Player Aid Sheet)", () => {
  for (let def = 1; def <= 16; def++) {
    for (let att = 1; att <= 16; att++) {
      it(`cella def=${def} att=${att}`, () => {
        expect(GROUND_CRT[def - 1][att - 1]).toBe(EXPECTED_CRT[def - 1][att - 1]);
      });
    }
  }
});

describe("lookupGroundCrtResult", () => {
  it("ritorna il codice corretto per celle d'angolo", () => {
    expect(lookupGroundCrtResult(1, 1).code).toBe("NE");
    expect(lookupGroundCrtResult(16, 1).code).toBe("DE");
    expect(lookupGroundCrtResult(1, 16).code).toBe("AA");
    expect(lookupGroundCrtResult(16, 16).code).toBe("NE");
  });

  it("clamp a 1 per attacker/defender < 1 (regola 5.1 step 5)", () => {
    expect(lookupGroundCrtResult(0, 5).code).toBe(lookupGroundCrtResult(1, 5).code);
    expect(lookupGroundCrtResult(-3, 5).code).toBe(lookupGroundCrtResult(1, 5).code);
    expect(lookupGroundCrtResult(5, 0).code).toBe(lookupGroundCrtResult(5, 1).code);
  });

  it("clamp a 16 per valori > 16", () => {
    expect(lookupGroundCrtResult(20, 8).code).toBe(lookupGroundCrtResult(16, 8).code);
    expect(lookupGroundCrtResult(8, 99).code).toBe(lookupGroundCrtResult(8, 16).code);
  });
});

describe("lookupAirCrtResult", () => {
  it("ritorna code + bonus separati", () => {
    // attacker=9, defender=1 → riga 1, colonna 9 → DE+4
    const r = lookupAirCrtResult(9, 1);
    expect(r.code).toBe("DE");
    expect(r.bonus).toBe(4);
  });

  it("clamp simmetrico a quello ground", () => {
    expect(lookupAirCrtResult(0, 0).code).toBe(lookupAirCrtResult(1, 1).code);
    expect(lookupAirCrtResult(99, 99).code).toBe(lookupAirCrtResult(16, 16).code);
  });
});
