/**
 * App principale per USWC Digital
 */

import React, { useEffect, useMemo, useState } from "react";
import { FactionCardPanel } from "./components/FactionCardPanel";
import { GameBoard } from "./components/GameBoard";
import { GameControls } from "./components/GameControls";
import { ContextBar } from "./components/ContextBar";
import { useGameStore } from "./store/gameStore";
import { GamePhase, ScenarioId, SCENARIOS, sequenceStepLabel } from "@uswc/shared";
import styles from "./App.module.css";

const phaseLabel = (phase?: string, subPhase?: string): string => {
  if (!phase) return "Caricamento";
  if (phase === "weather") return "Meteo";
  if (phase === "economy") return "Economia";
  if (phase === "strategic_movement") return "Movimento Strategico";
  if (phase === "operations" && subPhase === "actions") return "Operazioni: Azioni";
  if (phase === "operations" && subPhase === "supply_check") return "Operazioni: Rifornimento";
  if (phase === "no_supply") return "No Supply";
  if (phase === "replacements") return "Rimpiazzi";
  if (phase === "mobilization") return "Mobilitazione";
  if (phase === "victory_check") return "Controllo Vittoria";
  if (phase === "end_turn") return "Fine Turno";
  return phase;
};

const sideLabel = (side?: string): string => {
  if (side === "axis") return "Asse";
  if (side === "allied") return "Alleati";
  return "-";
};

const phaseTrack = [
  { key: "weather", label: "Meteo" },
  { key: "economy", label: "Economia" },
  { key: "strategic_movement", label: "Mov. Strategico" },
  { key: "operations", label: "Operazioni" },
  { key: "no_supply", label: "No Supply" },
  { key: "replacements", label: "Rimpiazzi" },
  { key: "mobilization", label: "Mobilitazione" },
  { key: "victory_check", label: "Vittoria" },
  { key: "end_turn", label: "Fine Turno" }
] as const;

const splashCards: Array<{ id: ScenarioId; label: string; className: string }> = [
  { id: "france1940", label: "Francia 1940", className: styles.splashCardOne },
  { id: "france1941", label: "Francia 1941", className: styles.splashCardTwo },
  { id: "france1944", label: "Francia 1944", className: styles.splashCardThree },
  { id: "balkans1941", label: "Balcani 1941", className: styles.splashCardFour },
  { id: "italy1943", label: "Italia 1943", className: styles.splashCardFive },
  { id: "barbarossa1941", label: "Barbarossa 1941", className: styles.splashCardSix },
  { id: "russia19411944", label: "Barbarossa 1941-1944", className: styles.splashCardSeven }
];

export const App: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const hydratePersistentScenario = useGameStore((state) => state.hydratePersistentScenario);
  const newLocalGame = useGameStore((state) => state.newLocalGame);
  const advanceGameSequence = useGameStore((state) => state.advanceGameSequence);
  const notice = useGameStore((state) => state.notice);
  const setNotice = useGameStore((state) => state.setNotice);
  const [showSplash, setShowSplash] = useState(true);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  // L'avviso sparisce da solo: informa senza bloccare come farebbe un alert.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  useEffect(() => {
    hydratePersistentScenario();
  }, [hydratePersistentScenario]);

  const implementedScenarios = useMemo(
    () => SCENARIOS.filter((scenario) => scenario.status === "implemented"),
    []
  );

  const startScenario = (scenarioId: ScenarioId) => {
    newLocalGame(scenarioId);
    setShowSplash(false);
    setControlsCollapsed(false);
  };

  const openSplash = () => {
    setShowSplash(true);
    setControlsCollapsed(false);
  };

  const stepLabel = gameState ? sequenceStepLabel(gameState) : null;

  // Perché l'avanzamento di fase è bloccato, se lo è. Serve a non lasciare
  // l'utente davanti a un pulsante che non fa nulla senza spiegazioni.
  const pendingAssaultNames = useMemo(() => {
    if (!gameState) return [];
    if (gameState.phase !== GamePhase.OPERATIONS || gameState.subPhase !== "actions") return [];
    return Array.from(gameState.units.values())
      .filter((unit) => unit.side === gameState.currentSide && unit.assaultTarget)
      .map((unit) => unit.name);
  }, [gameState]);

  const combatBlockReason = gameState?.pendingCombat
    ? "C'è un combattimento in corso: completalo o annullalo prima di cambiare fase."
    : null;

  const assaultCount = pendingAssaultNames.length;
  const assaultLabel = assaultCount === 1 ? "1 assalto designato" : `${assaultCount} assalti designati`;

  const handleAdvance = () => {
    if (combatBlockReason) return;
    if (assaultCount > 0) {
      const confirmed = window.confirm(
        `${assaultLabel} non ancora risolto/i: ${pendingAssaultNames.join(", ")}.\n\n` +
          'Puoi risolverli con "Risolvi Assault" nella barra in alto.\n\n' +
          "Proseguire comunque? I marker Assalto verranno rimossi senza combattere."
      );
      if (!confirmed) return;
      advanceGameSequence(true);
      return;
    }
    advanceGameSequence();
  };

  const advanceTitle = combatBlockReason
    ?? (assaultCount > 0 ? `${assaultLabel} da risolvere: ${pendingAssaultNames.join(", ")}` : undefined);

  if (showSplash) {
    return (
      <main className={styles.splashScreen}>
        <div className={styles.splashStage} aria-label="Selezione scenario">
          <img
            className={styles.splashImage}
            src="/splash/scenario-select.png"
            alt="Selezione scenari Unconditional Surrender"
          />
          {splashCards.map((card) => {
            const scenario = SCENARIOS.find((item) => item.id === card.id);
            const disabled = scenario?.status !== "implemented";
            return (
              <button
                key={card.id}
                type="button"
                className={`${styles.splashHotspot} ${card.className}`}
                disabled={disabled}
                onClick={() => startScenario(card.id)}
                aria-label={`Avvia ${card.label}`}
                title={scenario?.turnRange || card.label}
              >
                <span>{card.label}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.splashFooter}>
          {gameState && (
            <button type="button" className={styles.splashFooterButton} onClick={() => setShowSplash(false)}>
              Continua partita
            </button>
          )}
          {implementedScenarios
            .filter((scenario) => !splashCards.some((card) => card.id === scenario.id))
            .map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className={styles.splashFooterButton}
                onClick={() => startScenario(scenario.id)}
              >
                {scenario.title}
              </button>
            ))}
        </div>
      </main>
    );
  }

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <div className={styles.phaseTrack} aria-label="Traccia delle fasi">
          {phaseTrack.map((entry) => {
            const active = gameState?.phase === entry.key ||
              (entry.key === "operations" && gameState?.phase === GamePhase.OPERATIONS);
            return (
              <span key={entry.key} className={`${styles.phaseStep} ${active ? styles.phaseStepActive : ""}`}>
                {entry.label}
              </span>
            );
          })}
          {stepLabel && (
            <button
              type="button"
              className={styles.advanceBtn}
              onClick={handleAdvance}
              disabled={Boolean(combatBlockReason)}
              title={advanceTitle}
            >
              {stepLabel} ▶
            </button>
          )}
          {(combatBlockReason || assaultCount > 0) && (
            <span className={styles.advanceHint} role="status">
              {combatBlockReason ?? `${assaultLabel} da risolvere`}
            </span>
          )}
        </div>
      </header>
      <ContextBar />

      <main className={styles.mainContent}>
        <div className={styles.playArea}>
          <section className={styles.boardSection}>
            <GameBoard />
          </section>

          {notice && (
            <div className={styles.notice} role="status" aria-live="polite">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Chiudi avviso">×</button>
            </div>
          )}

          <button
            type="button"
            className={`${styles.sidebarToggle} ${controlsCollapsed ? styles.sidebarToggleClosed : ""}`}
            onClick={() => setControlsCollapsed((value) => !value)}
            aria-label={controlsCollapsed ? "Apri controlli" : "Chiudi controlli"}
            title={controlsCollapsed ? "Apri controlli" : "Chiudi controlli"}
          >
            {controlsCollapsed ? "<" : ">"}
          </button>

          <aside className={`${styles.controlsSection} ${controlsCollapsed ? styles.controlsSectionCollapsed : ""}`} aria-hidden={controlsCollapsed}>
            <GameControls onNewGame={openSplash} />
          </aside>
        </div>

        <FactionCardPanel />
      </main>

      <footer className={styles.footer}>
        <p>
          Turno <strong>{gameState?.turnCode || "-"}</strong> | Fase <strong>{phaseLabel(gameState?.phase, gameState?.subPhase)}</strong> | Giocatore <strong>{sideLabel(gameState?.currentSide)}</strong>
        </p>
      </footer>
    </div>
  );
};

export default App;
