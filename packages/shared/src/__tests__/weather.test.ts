import { describe, expect, it } from "vitest";
import { resolveWeatherRoll, weatherTableRowKey } from "../engine";
import { WeatherMapCategory, WeatherType } from "../types";

// Snapshot esplicito della tabella Weather (10.0) del Player Aid Sheet
// (Tabelle US.pdf, p.3). Per ogni riga sono elencati i 6 risultati del d6.
// ATTENZIONE: diverse righe NON hanno alcun risultato Fair (trattino "–" sulla
// tabella cartacea). In particolare, sulle mappe diverse da Balcani/FNA/Italia
// l'inverno non può mai essere Fair. Se un test qui fallisce, ricontrolla il
// PDF prima di toccare la tabella.
const F = WeatherType.FAIR;
const P = WeatherType.POOR;
const S = WeatherType.SEVERE;

type Row = { key: string; turn: string; prev: WeatherType; expected: WeatherType[] };

// Turni scelti in modo da colpire ogni riga della tabella.
const OTHER_MAPS: Row[] = [
  { key: "Dec-Feb", turn: "Jan-42", prev: F, expected: [P, P, P, P, S, S] },
  { key: "Mar", turn: "Mar-42", prev: F, expected: [F, P, P, S, S, S] },
  { key: "Apr (Mar Fair)", turn: "Apr-42", prev: F, expected: [P, P, P, S, S, S] },
  { key: "Apr (Mar Poor)", turn: "Apr-42", prev: P, expected: [F, P, P, P, S, S] },
  { key: "Apr (Mar Sev)", turn: "Apr-42", prev: S, expected: [F, P, P, P, P, S] },
  { key: "May", turn: "May-40", prev: F, expected: [F, F, F, P, P, P] },
  { key: "Jun", turn: "Jun-40", prev: F, expected: [F, F, F, F, P, P] },
  { key: "Jul-Sep", turn: "Aug-40", prev: P, expected: [F, F, F, F, F, F] },
  { key: "Oct", turn: "Oct-44", prev: F, expected: [F, F, P, P, S, S] },
  { key: "Nov (Oct Fair)", turn: "Nov-44", prev: F, expected: [P, P, P, P, S, S] },
  { key: "Nov (Oct Poor)", turn: "Nov-44", prev: P, expected: [F, F, P, P, S, S] },
  { key: "Nov (Oct Sev)", turn: "Nov-44", prev: S, expected: [F, F, P, P, P, P] }
];

const BALKANS: Row[] = [
  { key: "Dec-Feb", turn: "Jan-43", prev: F, expected: [F, P, P, P, S, S] },
  { key: "Mar", turn: "Mar-43", prev: F, expected: [F, F, P, P, S, S] },
  { key: "Apr (Mar Fair)", turn: "Apr-41", prev: F, expected: [F, P, P, P, S, S] },
  { key: "Apr (Mar Poor)", turn: "Apr-41", prev: P, expected: [F, F, P, P, P, S] },
  { key: "Apr (Mar Sev)", turn: "Apr-41", prev: S, expected: [F, F, P, P, P, P] },
  { key: "May", turn: "May-41", prev: F, expected: [F, F, F, F, P, P] },
  { key: "Jun", turn: "Jun-43", prev: F, expected: [F, F, F, F, P, P] },
  { key: "Jul-Sep", turn: "Sep-43", prev: S, expected: [F, F, F, F, F, F] },
  { key: "Oct", turn: "Oct-43", prev: F, expected: [F, F, P, P, P, S] },
  { key: "Nov (Oct Fair)", turn: "Nov-42", prev: F, expected: [P, P, P, P, S, S] },
  { key: "Nov (Oct Poor)", turn: "Nov-42", prev: P, expected: [F, F, P, P, P, P] },
  { key: "Nov (Oct Sev)", turn: "Nov-42", prev: S, expected: [F, F, F, P, P, P] }
];

const suites: Array<{ name: string; category: WeatherMapCategory; rows: Row[] }> = [
  { name: "All Other Maps", category: WeatherMapCategory.OTHER_MAPS, rows: OTHER_MAPS },
  { name: "Balkans / FNA / Italy", category: WeatherMapCategory.BALKANS_FNA_ITALY, rows: BALKANS }
];

suites.forEach(({ name, category, rows }) => {
  describe(`Tabella meteo — ${name}`, () => {
    rows.forEach((row) => {
      it(`riga "${row.key}" (${row.turn}, mese prec. ${row.prev})`, () => {
        expect(weatherTableRowKey(row.turn, row.prev)).toBe(row.key);
        for (let roll = 1; roll <= 6; roll++) {
          expect(
            resolveWeatherRoll(roll, row.turn, row.prev, category),
            `${row.key} con tiro ${roll}`
          ).toBe(row.expected[roll - 1]);
        }
      });
    });
  });
});

describe("Tabella meteo — regressioni note", () => {
  it("sulle mappe diverse da Balcani/FNA/Italia l'inverno non è mai Fair", () => {
    for (const turn of ["Dec-41", "Jan-42", "Feb-42"]) {
      for (let roll = 1; roll <= 6; roll++) {
        expect(
          resolveWeatherRoll(roll, turn, WeatherType.FAIR, WeatherMapCategory.OTHER_MAPS),
          `${turn} con tiro ${roll}`
        ).not.toBe(WeatherType.FAIR);
      }
    }
  });

  it("sulle mappe diverse da Balcani/FNA/Italia l'inverno può essere Severe", () => {
    expect(resolveWeatherRoll(5, "Jan-42", WeatherType.FAIR, WeatherMapCategory.OTHER_MAPS)).toBe(WeatherType.SEVERE);
    expect(resolveWeatherRoll(6, "Jan-42", WeatherType.FAIR, WeatherMapCategory.OTHER_MAPS)).toBe(WeatherType.SEVERE);
  });

  it("Nov dopo un Ottobre Fair non è mai Fair su nessuna mappa", () => {
    for (const category of [WeatherMapCategory.OTHER_MAPS, WeatherMapCategory.BALKANS_FNA_ITALY]) {
      for (let roll = 1; roll <= 6; roll++) {
        expect(resolveWeatherRoll(roll, "Nov-43", WeatherType.FAIR, category), `tiro ${roll}`).not.toBe(WeatherType.FAIR);
      }
    }
  });

  it("Jul-Sep è sempre Fair su entrambe le tabelle", () => {
    for (const category of [WeatherMapCategory.OTHER_MAPS, WeatherMapCategory.BALKANS_FNA_ITALY]) {
      for (const turn of ["Jul-43", "Aug-43", "Sep-43"]) {
        for (let roll = 1; roll <= 6; roll++) {
          expect(resolveWeatherRoll(roll, turn, WeatherType.SEVERE, category)).toBe(WeatherType.FAIR);
        }
      }
    }
  });
});
