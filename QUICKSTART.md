# 🚀 QUICKSTART - USWC Digital

## 30 secondi di Setup

```bash
# 1. Installa dipendenze
yarn install

# 2. Build TypeScript
yarn build

# 3. Avvia dev servers (in parallelo)
yarn dev
```

**Accedi a:**
- 🎮 UI Gioco: http://localhost:5173
- 🔌 API Backend: http://localhost:3001/health

---

## Primo Gioco

1. Apri browser → http://localhost:5173
2. Click "New Game"
3. Osserva stato iniziale su API

---

## Sviluppare

### Modificare una Regola
Edita `packages/shared/src/rules.ts` → tutti i package vedono il cambio

### Aggiungere Endpoint API
Edita `packages/backend/src/index.ts` → ricarica automaticamente

### Implementare Logica IA
Edita `packages/ai-engine/src/minimax_engine.py` → generare mosse

---

## Prossimi Passi (FASE 2)

1. **Implementare movimento unità**
   - File: `packages/backend/src/movement.ts`
   - Usare `GAME_RULES.MOVEMENT` da shared

2. **Generare mappa hex**
   - Creare hex grid 12x16
   - Applicare terreno casuale

3. **Risoluzione combattimento**
   - File: `packages/backend/src/combat.ts`
   - Usare `GAME_RULES.COMBAT` e tiri d6

---

## Debugging Quick

```bash
# Vedi package tree
yarn workspaces list

# Tipo check tutto
yarn type-check

# Build solo backend
yarn workspace @uswc/backend build

# Test AI
python packages/ai-engine/tests/test_minimax.py
```

---

## 💡 Tips

- Usa VSCode REST Client per testare API
- Chrome DevTools per React debugging
- Python Poetry per AI development isolato

---

**Ready? Let's build! ⚔️**
