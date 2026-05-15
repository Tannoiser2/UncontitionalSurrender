# Session Report — Combat Engine Test Coverage

**Data:** 2026-05-11
**Progetto:** Unconditional Surrender (USWC Digital)

---

## Obiettivo della sessione

Audit e blindatura del combat engine con test automatici, seguendo le priorità indicate da Codex:

1. Installare vitest e creare infrastruttura di test
2. Test CRT terrestre (tutte le 256 celle)
3. Implementare `straitEdges` end-to-end
4. Test Ground DRM
5. Test Air Combat DRM e risultati
6. Test DCR/fort end-to-end

---

## Stato prima della sessione

- Nessun framework di test installato
- Nessun file `*.test.ts` nel repo
- `attackerCrossingStrait` presente nel breakdown DRM ma **sempre 0** (nessun dato mappa)
- `straitEdges` non esisteva in `GameState`
- Logica DCR/fort presente ma non verificata

---

## Cosa è stato fatto

### 1. Infrastruttura test

- Installato `vitest ^1.6` in `packages/shared`
- Aggiunti script `test` e `test:watch` in `packages/shared/package.json`

### 2. Test CRT terrestre

**File:** `packages/shared/src/__tests__/groundCrt.test.ts`

264 test che verificano:
- Forma 16×16 di `GROUND_CRT`
- Validità di ogni cella (formato `CODE+BONUS`, codice ∈ {NE, DR, DD, DE, AS, AA})
- Snapshot esplicito di tutte le 256 celle trascritto dal Player Aid Sheet
- `lookupGroundCrtResult`: celle d'angolo, clamp <1 e >16
- `lookupAirCrtResult`: code + bonus separati, clamp simmetrico

> Se la matrice viene modificata a caso, il test scatta immediatamente.

### 3. `straitEdges` — implementazione end-to-end

**Problema:** il campo `attackerCrossingStrait` (-2) era sempre 0 perché non esisteva alcun dato mappa.

**Modifiche:**

| File | Modifica |
|---|---|
| `packages/shared/src/types.ts` | Aggiunto `straitEdges: Set<string>` a `GameState` |
| `packages/shared/src/engine.ts` | Aggiunto nei 4 seed loader (balkans, france1940, italy, fna), nell'init procedurale, in `SerializedGameState`, `serializeGameState`, `deserializeGameState` |
| `packages/shared/src/engine.ts:2325` | DRM -2 cablato in `computeAttackerDrm`, escluso in amphibious (coerente con river/mountain) |
| `packages/frontend/src/store/gameStore.ts` | Aggiornata copia locale di `SerializedGameState`, `serializeGameState`, `normalizeGameState`, `deserializeGameState` |
| `packages/frontend/src/store/gameStore.ts` | Aggiunto `toggleStraitEdge` (pronto per editor UI, non ancora wired a un pulsante) |

**Retrocompatibilità:** tutti i seed esistenti che non hanno `straitEdges` ricevono `new Set<string>()` automaticamente. Nessuna migrazione necessaria.

### 4. Test Ground DRM

**File:** `packages/shared/src/__tests__/groundDrm.test.ts`

22 test su `computeAttackerDrm` (ora esportata):

| Modificatore | Testato |
|---|---|
| Germany +2 | ✅ |
| France/UK/USA +1 | ✅ |
| Elite +1 | ✅ |
| Reduced -2 | ✅ |
| Low Supply -2 | ✅ |
| Tank Fair +2 / Poor +1 | ✅ |
| Tank Severe: nessun bonus + halving | ✅ |
| Attacking Poor Weather -1 | ✅ |
| River edge -1 | ✅ |
| Mountain edge -1 | ✅ |
| **Strait edge -2 (nuovo)** | ✅ |
| **Strait escluso in amphibious** | ✅ |
| Senza strait: DRM = 0 | ✅ |
| City/Rough -1 | ✅ |
| Amphibious -1 | ✅ |
| Amphibious: no malus river/mountain | ✅ |
| No Supply halving | ✅ |
| Severe Weather halving | ✅ |
| Isolated +2 | ✅ |
| Totale combinato river+strait | ✅ |

### 5. Test Air Combat

**File:** `packages/shared/src/__tests__/airCombat.test.ts`

16 test su `getAirCombatPreview`:

| Caso | Testato |
|---|---|
| Germany attacker +2 | ✅ |
| UK/USA attacker +1 | ✅ |
| Defender Germany +2 | ✅ |
| Bomber -2 | ✅ |
| Low Supply -2 | ✅ |
| No Supply: halving (roll 4 → final 2) | ✅ |
| Poor Weather -2 sia att che def | ✅ |
| Severe Weather: halving sia att che def | ✅ |
| Sortite -N | ✅ |
| Jets +2 | ✅ |
| Britain Defense +2 (isAirStrike, def in UK, att non in UK) | ✅ |
| Britain Defense: no se att è in UK | ✅ |
| Britain Defense: no se isAirStrike=false | ✅ |
| CRT result corretto (Germany +2 → DR+2) | ✅ |
| Clamp a 1 su final negativo | ✅ |

### 6. Test DCR/fort

**File:** `packages/shared/src/__tests__/fortDcr.test.ts`

20 test su `applyCombatResult`, `resolveDefenderCannotRetreatChoice`, `resolveAdvanceChoice` (le ultime due già esportate, `applyCombatResult` ora esportata):

| Caso | Testato |
|---|---|
| DR + 1 retreat hex → retreat automatica + pendingAdvance | ✅ |
| DR senza retreat hex, full-strength → ridotto | ✅ |
| DR senza retreat hex, reduced → eliminato | ✅ |
| DR vs fort → `allowDefenderCannotRetreat=true` | ✅ |
| DCR su full-strength → ridotto in place (non eliminato) | ✅ |
| DCR su reduced → eliminato | ✅ |
| DCR su reduced Mobile → marker noEzoc piazzato | ✅ |
| DCR su reduced Assault → nessun marker noEzoc | ✅ |
| DCR non applicabile senza pendingCombat | ✅ |
| DCR non applicabile senza `allowDefenderCannotRetreat` | ✅ |
| Advance post-DCR: pendingAdvance verso ex-hex defender | ✅ |
| Advance accettato → attaccante si sposta sul hex | ✅ |
| Advance rifiutato → attaccante rimane sul suo hex | ✅ |
| DD full-strength → reduced + retreat | ✅ |
| DD reduced → eliminato | ✅ |
| DE full e reduced → eliminato | ✅ |
| DE Mobile → noEzoc; DE Assault → no noEzoc | ✅ |
| AA full-strength → ridotto | ✅ |
| AA reduced → eliminato | ✅ |

> Il codice DCR/fort era già corretto. I test lo blindano contro regressioni future.

---

## Totale test

| File | Test |
|---|---|
| `groundCrt.test.ts` | 264 |
| `groundDrm.test.ts` | 22 |
| `airCombat.test.ts` | 16 |
| `fortDcr.test.ts` | 20 |
| **Totale** | **322** |

Tutti 322/322 verdi. `tsc` su `packages/shared` e `packages/backend` pulito.

---

## Funzioni ora esportate da `engine.ts`

| Funzione | Motivo |
|---|---|
| `computeAttackerDrm` | Test ground DRM |
| `applyCombatResult` | Test fort/DCR |

Entrambe erano già usate internamente; esportarle non cambia il comportamento runtime.

---

## Cosa NON è stato fatto (per scelta)

| Area | Nota |
|---|---|
| **Editor UI per straitEdges** | `toggleStraitEdge` esiste nello store ma non è wired a un pulsante in GameControls |
| **Strategic Move** | Lasciato congelato come da indicazioni Codex |
| **Map Box / Transport / Rebase** | Area separata, non toccata |
| **Scenari** (Italy 1943, FNA 1942) | Area separata |
| **Eventi** (Naval Evacuation, Mulberry, Rockets) | Area separata |
| **AI engine** | Non priorità |

---

## Prossimi passi consigliati

1. **Editor UI straitEdges** — wiring di `toggleStraitEdge` in `GameControls.tsx` accanto a toggleMountainEdge/toggleImpassableEdge, poi popolare i dati negli scenari (Italy: Stretto di Messina; FNA/Balkans: punti di attraversamento mare).
2. **Strategic Move** — trattare come problema di stato frontend (selezione unità, evidenziazione destinazioni, banner) non di regole.
3. **Italy 1943 / FNA 1942** — audit scenario per scenario: regole speciali, setup, eventi, supply e box.
4. **Map Box / Rebase / Amphibious** — consolidare Air Rebase, Naval Transport, Amphibious per scenario.
