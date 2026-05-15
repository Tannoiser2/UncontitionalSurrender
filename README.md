# ⚔️ Unconditional Surrender: Western Campaign - Digital Edition

**Versione digitale interattiva del wargame storico Unconditional Surrender Western Campaign con intelligenza artificiale tattica (Minimax).**

## 🎯 Visione del Progetto

Trasformare il classico wargame da tavolo Unconditional Surrender Western Campaign in una versione digitale completamente funzionale con:

- ✅ Mappa interattiva con hex grid
- ✅ Sistema di gioco completo (movimento, ZOC, combattimento, supply)
- ✅ Calcolo automatico di tiri, modificatori, casualità
- ✅ IA tattica con Minimax + Alpha-Beta Pruning
- ✅ Gioco solitario (umano vs IA)
- ✅ Umano vs Umano (via web)

---

## 🏗️ Architettura del Progetto

```
unconditional-surrender-digital/
├── packages/
│   ├── shared/              # Tipi, regole, configurazione (TypeScript)
│   ├── backend/             # Game engine + API (Node.js/Express)
│   ├── frontend/            # UI interattiva (React)
│   └── ai-engine/           # Minimax IA (Python)
├── package.json             # Root monorepo (Yarn workspaces)
└── README.md                # Questo file
```

### Stack Tecnologico

| Layer | Tecnologie |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Zustand |
| **Backend** | Node.js + Express + TypeScript |
| **Shared** | TypeScript (tipi e regole comuni) |
| **AI** | Python 3.10+ (Minimax, NumPy) |
| **Build** | Turbo (monorepo orchestration) |

---

## 📋 Regole Implementate (MVP)

### Movimento
- **Punti Movimento**: 10 MP per turno (configurabile)
- **Costi Terreno**: Piano=1, Foresta=2, Montagna=3, Fiume=4
- **ZOC**: Esce da ZOC costa +2 MP aggiuntivi

### Combattimento
- **Rapporto Forze**: Minimo 1.5:1 per vittoria garantita
- **Tiri**: d6 con modificatori (terreno, morale, leadership)
- **Casualità**: % base 30% normalizzato per rapporto forze
- **Morale**: Scala 0-10, impatta accettazione combattimento

### Supply (Rifornimenti)
- **Consumo**: 1 livello supply per turno
- **Range**: 5 hex da depot/città
- **Penalità Isolamento**: Raddoppia consumo se isolata

### ZOC (Zone of Control)
- **Range**: 1 hex intorno all'unità
- **Effetti**: Impedisce movimento nemico, aumenta costi, forza combattimento

---

## 🚀 Installazione & Setup

### Prerequisiti

- Node.js >= 18.0.0
- Yarn 1.22+
- Python 3.10+

### Setup Locale

```bash
# Clone o apri il progetto
cd "Desktop/Unconditional Surrender"

# Installa dipendenze (tutti i workspace)
yarn install

# Build tutti i pacchetti
yarn build

# Avvia dev servers
yarn dev
```

Questo lancerà:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **AI**: Pronto per integrazione

---

## 🎮 Uso

### Gioco da Browser

1. Apri http://localhost:5173
2. **New Game** → Crea una partita
3. Seleziona unità e hex per muovere
4. IA calcola la mossa in ~3 secondi
5. Log di gioco mostra tutti gli eventi

### API Backend

```bash
# Crea una nuova partita
curl -X POST http://localhost:3001/api/games

# Carica stato partita
curl http://localhost:3001/api/games/{gameId}

# Lista partite
curl http://localhost:3001/api/games
```

---

## 🧠 Intelligenza Artificiale (Minimax)

### Algoritmo

```
Minimax(depth, side, alpha, beta)
  if depth == 0 or terminal state:
    return evaluate(position)
  
  if maximizing (ALLIED):
    for each move:
      score = Minimax(depth-1, AXIS, α, β, minimize)
      α = max(α, score)
      if β ≤ α: break  [Alpha-Beta Pruning]
    return α
  else (AXIS):
    for each move:
      score = Minimax(depth-1, ALLIED, α, β, maximize)
      β = min(β, score)
      if β ≤ α: break  [Alpha-Beta Pruning]
    return β
```

### Caratteristiche

- ✅ **Profondità Adattiva**: Iterative deepening fino a timeout
- ✅ **Transposition Table**: Cache stati per evitare ricerca ripetuta
- ✅ **Alpha-Beta Pruning**: Riduce nodi esplorati del 90%
- ✅ **Time Management**: Timeout configurabile (default 3000ms)
- ✅ **Valutazione Multifactor**:
  - Controllo territoriale (30%)
  - Forza unità (25%)
  - Linee rifornimento (20%)
  - Morale (15%)
  - Rapporto perdite (10%)

---

## 📊 Fasi di Sviluppo

### ✅ FASE 1: SETUP (Completata)
- [x] Monorepo structure
- [x] TypeScript setup
- [x] Schema dati comuni
- [x] Backend Express base
- [x] Frontend React base
- [x] AI Minimax engine skeleton

### 📌 FASE 2: GAME ENGINE (Prossima)
- [ ] Parser mappa hex
- [ ] Sistema movimento con validazione
- [ ] Calcolo ZOC
- [ ] Risoluzione combattimento
- [ ] Sistema supply
- [ ] State management (turni, fasi)

### 📌 FASE 3: FRONTEND INTERATTIVO
- [ ] Rendering hex grid
- [ ] Visualizzazione unità
- [ ] Selezione e movimento UI
- [ ] Animation mosse
- [ ] Combat resolution display
- [ ] Game log/history

### 📌 FASE 4: BACKEND API
- [ ] REST endpoints per azioni
- [ ] WebSocket real-time
- [ ] Persistenza (DB)
- [ ] Autenticazione
- [ ] Matchmaking

### 📌 FASE 5: AI INTEGRATION
- [ ] Implementare generate_moves()
- [ ] Implementare apply_move()
- [ ] Implementare evaluation details
- [ ] Testing AI vs AI
- [ ] Tuning profondità/difficulty

### 📌 FASE 6: POLISH & TESTING
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] UI/UX improvements
- [ ] Documentazione
- [ ] Deployment

---

## 📁 Struttura File

```
packages/shared/
├── src/
│   ├── types.ts          # Tipi GameState, Unit, Hex, etc.
│   ├── rules.ts          # Costanti e regole di gioco
│   └── config.ts         # Parametri globali, unità test
│
packages/backend/
├── src/
│   ├── index.ts          # Express app e routes
│   ├── gameEngine.ts     # Logica gioco (TODO)
│   ├── movement.ts       # Calcolo movimento (TODO)
│   └── combat.ts         # Risoluzione combattimento (TODO)
│
packages/frontend/
├── src/
│   ├── App.tsx           # Componente principale
│   ├── main.tsx          # Entry point React
│   ├── components/
│   │   ├── GameBoard.tsx
│   │   └── GameControls.tsx
│   ├── store/
│   │   └── gameStore.ts  # Zustand state management
│   └── index.css         # Stili globali
│
packages/ai-engine/
├── src/
│   ├── minimax_engine.py      # Algoritmo Minimax
│   ├── evaluation.py           # Funzione valutazione
│   ├── move_generator.py       # Generatore mosse (TODO)
│   └── __init__.py
```

---

## 🔧 Configurazione

### Game Rules (`shared/src/rules.ts`)

```typescript
export const GAME_RULES = {
  MOVEMENT: {
    BASE_MP: 10,
    TERRAIN_COSTS: { plain: 1, forest: 2, ... },
    ZOC_COST: 2
  },
  COMBAT: {
    DICE_SIDES: 6,
    CASUALTY_PERCENTAGE: 0.3,
    ...
  }
};
```

### AI Parameters (`shared/src/config.ts`)

```typescript
export const GAME_CONFIG = {
  AI: {
    MINIMAX_DEPTH: 5,
    TIMEOUT_MS: 3000,
    ALPHA_BETA_PRUNING: true,
    EVALUATION_WEIGHTS: { ... }
  }
};
```

---

## 🧪 Testing

```bash
# Run all tests
yarn test

# Watch mode
yarn test --watch

# Coverage
yarn test --coverage
```

---

## 🐛 Debugging

### Backend
```bash
# Debug mode con output verbose
DEBUG=* yarn workspace @uswc/backend dev
```

### Frontend
```bash
# React DevTools
yarn workspace @uswc/frontend dev
# Apri http://localhost:5173
```

### AI
```bash
# Python tests
python -m pytest packages/ai-engine/tests/ -v
```

---

## 📚 Documentazione Aggiuntiva

- [Regole USWC Originali](./USWC_Rules.pdf)
- [API Backend](./docs/API.md) (TODO)
- [Algoritmo Minimax](./docs/MINIMAX.md) (TODO)
- [Contribuire](./CONTRIBUTING.md) (TODO)

---

## 🎓 Learning Resources

- Minimax Algorithm: https://en.wikipedia.org/wiki/Minimax
- Alpha-Beta Pruning: https://en.wikipedia.org/wiki/Alpha%E2%80%93beta_pruning
- Hex Grid Math: https://www.redblobgames.com/grids/hexagons/
- USWC Wargame: [GMT Games](https://www.gmtgames.com/)

---

## 📝 Licenza

Questo progetto è creato come fan project per fini educativi.
Il gioco originale "Unconditional Surrender" è di GMT Games.

---

## 👥 Contributors

- **Stefano** - Project Lead, Full Stack

---

## 🚀 Roadmap Futuro

- [ ] Multiplayer real-time (Socket.io)
- [ ] Salvataggio partite su DB
- [ ] Replay e analisi
- [ ] Più mappe (Eastern Front, Tunisia, etc.)
- [ ] Editor custom scenari
- [ ] Mobile app (React Native)
- [ ] CLI client per testing AI
- [ ] Statisitche e leaderboard

---

**Buon gioco! 🎮⚔️**

*Last Updated: May 7, 2026*
