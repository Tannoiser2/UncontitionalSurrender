import React, { useEffect, useState } from "react";
import {
  activationCostFor,
  activationProductionCountry,
  coordKey,
  GamePhase,
  GameSubPhase,
  hexCodeForMap,
  movementAllowanceFor,
  movementRemainingFor,
  scenarioById,
  TerrainType
} from "@uswc/shared";
import { useGameStore } from "../store/gameStore";
import { UnitCounter } from "./UnitCounter";
import styles from "./FactionCardPanel.module.css";

const terrainLabel: Record<TerrainType, string> = {
  [TerrainType.PLAIN]: "Plain",
  [TerrainType.FOREST]: "Forest",
  [TerrainType.MOUNTAIN]: "Rough/Hill",
  [TerrainType.SWAMP]: "Swamp",
  [TerrainType.RIVER]: "River",
  [TerrainType.CITY]: "City",
  [TerrainType.COASTAL]: "Coast",
  [TerrainType.SEA]: "Sea"
};

const controllerLabel = (controller?: string): string => {
  if (!controller) return "Originale";
  if (controller === "axis") return "Asse";
  if (controller === "allied") return "Alleati";
  if (controller === "neutral") return "Neutrale";
  return controller;
};

const boolLabel = (value: boolean): string => value ? "si" : "no";
type PanelTab = "inspector" | "timeline";

const monthLabel: Record<string, string> = {
  Jan: "Gennaio",
  Feb: "Febbraio",
  Mar: "Marzo",
  Apr: "Aprile",
  May: "Maggio",
  Jun: "Giugno",
  Jul: "Luglio",
  Aug: "Agosto",
  Sep: "Settembre",
  Oct: "Ottobre",
  Nov: "Novembre",
  Dec: "Dicembre"
};

const turnLabelFor = (code: string): string => {
  const [month, year] = code.split("-");
  const fullYear = year ? `19${year}` : "";
  return `${monthLabel[month] || month} ${fullYear}`.trim();
};

const tabForPhase = (_phase: GamePhase, _subPhase?: GameSubPhase): PanelTab => {
  return "inspector";
};

const sideLabel = (side: string): string => {
  if (side === "axis") return "Asse";
  if (side === "allied") return "Alleati";
  return side;
};


export const FactionCardPanel: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const selectedUnit = useGameStore((state) => state.selectedUnit);
  const selectedHex = useGameStore((state) => state.selectedHex);
  const validMoves = useGameStore((state) => state.validMoves);
  const [tab, setTab] = useState<PanelTab>("inspector");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!gameState) return;
    setTab(tabForPhase(gameState.phase, gameState.subPhase));
    setExpanded(true);
  }, [gameState?.phase, gameState?.subPhase]);

  useEffect(() => {
    if (gameState?.pendingCombat) {
      setTab("inspector");
      setExpanded(true);
    }
  }, [gameState?.pendingCombat]);

  if (!gameState) return null;

  const inspectedCoord = selectedHex || ((selectedUnit?.mapPresence || "france") === "france" ? selectedUnit?.position : null) || null;
  const inspectedHex = inspectedCoord ? gameState.map.get(coordKey(inspectedCoord)) : null;
  const stack = inspectedCoord
    ? Array.from(gameState.units.values()).filter((unit) =>
      unit.status !== "destroyed" &&
      unit.position.q === inspectedCoord.q &&
      unit.position.r === inspectedCoord.r
    )
    : [];

  const selectedProductionCountry = selectedUnit ? activationProductionCountry(gameState.scenarioId, selectedUnit) : null;
  const selectedProduction = selectedUnit && selectedProductionCountry
    ? gameState.factionCards[selectedUnit.side]?.productionPoints?.[selectedProductionCountry]
    : undefined;
  const scenario = scenarioById(gameState.scenarioId);
  const hexLabel = (coord: { q: number; r: number }) => hexCodeForMap(coord, scenario.mapId);
  const tabClass = (target: PanelTab): string =>
    tab === target ? styles.activeTab : "";

  const renderTimeline = () => {
    const turnCodes = scenario.turnCodes || Array.from({ length: scenario.endTurn }, (_, index) => `T${index + 1}`);
    const eventEntries = gameState.eventTurnTrack || [];
    const mobilizationItems = (["axis", "allied"] as const).flatMap((side) =>
      gameState.factionCards[side].mobilizationBox.map((id) => ({
        side,
        unit: gameState.units.get(id),
        label: gameState.units.get(id)?.name || id
      }))
    );
    const eliminatedItems = (["axis", "allied"] as const).flatMap((side) =>
      gameState.factionCards[side].eliminatedBox.map((id) => ({
        side,
        unit: gameState.units.get(id),
        label: gameState.units.get(id)?.name || id
      }))
    );
    const scenarioReinforcements = (turnNumber: number): string[] => {
      if (gameState.scenarioId === "france1940" && turnNumber === 1) return ["France 2 Air alla fine Operazioni Asse"];
      if (gameState.scenarioId === "france1941" && turnNumber === 1) return ["France 2 Air alla fine Operazioni Asse"];
      if (gameState.scenarioId === "italy1943" || gameState.scenarioId === "italy1943Include") {
        const offset = gameState.scenarioId === "italy1943Include" ? 1 : 0;
        if (turnNumber === 3 + offset) return ["Germany 4 in Mobilitazione"];
        if (turnNumber === 5 + offset) return ["USA 12 AAF in Mobilitazione"];
        if (turnNumber === 10 + offset) return ["USA 7 in Mobilitazione"];
      }
      return [];
    };

    const eventIconSrc = (id: string): string | undefined => {
      const n = id.toLowerCase();
      if (n.includes("airdrop")) return "/event-icons/Airdrop.png";
      if (n.includes("ground support")) return "/event-icons/Ground_Support.png";
      if (n.includes("tanks")) return "/event-icons/Tanks.png";
      if (n.includes("jets")) return "/event-icons/Jets.png";
      if (n.includes("rockets")) return "/event-icons/Rockets.png";
      if (n.includes("ultra")) return "/event-icons/Ultra.png";
      if (n.includes("free force")) return "/event-icons/Free_Force.png";
      if (n.includes("mulberry")) return "/event-icons/Mulberry.png";
      if (n.includes("naval")) return "/event-icons/Naval_evacuation.png";
      if (n.includes("partisans")) return "/event-icons/Partisans.png";
      if (n.includes("surprise")) return "/event-icons/Surprise_attack.png";
      if (n.includes("snafu")) return "/event-icons/SNAFU.png";
      if (n.includes("strategic")) return "/event-icons/Strategic_move.png";
      return undefined;
    };

    return (
      <div className={styles.timelineGrid}>
        {turnCodes.map((code, index) => {
          const turnNumber = index + 1;
          const isCurrent = turnNumber === gameState.turn;
          const returningEvents = eventEntries.filter((entry) => entry.returnTurn === turnNumber);
          const isPast = turnNumber < gameState.turn;
          const reinforcements = scenarioReinforcements(turnNumber);
          const isEmpty = returningEvents.length === 0 && reinforcements.length === 0 &&
            (!isCurrent || (mobilizationItems.length === 0 && eliminatedItems.length === 0));
          return (
            <section
              key={`${scenario.id}-${turnNumber}`}
              className={`${styles.timelineCell} ${isCurrent ? styles.currentTimelineCell : ""} ${isPast ? styles.pastTimelineCell : ""}`}
            >
              <header>
                <strong>{turnLabelFor(code)}</strong>
                <span>T{turnNumber}</span>
              </header>
              <div className={styles.timelineItems}>
                {(gameState.scenarioEndsTurn === turnNumber || scenario.endTurn === turnNumber) && (
                  <span className={styles.timelineEnd}>Fine scenario</span>
                )}
                {returningEvents.map((entry) => {
                  const icon = eventIconSrc(entry.markerId);
                  return (
                    <span
                      key={`${entry.side}-${entry.markerId}-${entry.returnTurn}`}
                      className={styles.timelineEvent}
                      title={`${entry.markerId} (${sideLabel(entry.side)})`}
                      aria-label={`${entry.markerId} (${sideLabel(entry.side)})`}
                    >
                      {icon
                        ? <img src={icon} alt="" className={styles.timelineEventIcon} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        : <span className={styles.timelineEventFallback}>EV</span>}
                    </span>
                  );
                })}
                {reinforcements.map((item) => (
                  <span key={item} className={styles.timelineReinf}>{item}</span>
                ))}
                {isCurrent && mobilizationItems.map((item) => (
                  <span key={`mob-${item.side}-${item.label}`} className={styles.timelineUnit}>
                    {item.unit && <UnitCounter unit={item.unit} size={28} />}
                    <span>{item.label}</span>
                  </span>
                ))}
                {isCurrent && eliminatedItems.map((item) => (
                  <span key={`elim-${item.side}-${item.label}`} className={styles.timelineUnit}>
                    {item.unit && <UnitCounter unit={item.unit} size={28} />}
                    <span>{item.label}</span>
                  </span>
                ))}
                {isEmpty && <em>—</em>}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const renderInspector = () => (
    <div className={styles.inspectorGrid}>
      <section className={styles.infoCard}>
        <header>
          <span>Unita selezionata</span>
          {selectedUnit && <strong>{selectedUnit.name}</strong>}
        </header>
        {selectedUnit ? (
          <>
            <div className={styles.dataGrid}>
              <span>Nazione</span><strong>{selectedUnit.country || "-"}</strong>
              <span>Tipo</span><strong>{selectedUnit.type}</strong>
              <span>Forza</span><strong>{selectedUnit.reduced ? "Ridotta" : "Piena"} ({selectedUnit.strength}/{selectedUnit.maxStrength})</strong>
              <span>Movimento</span><strong>{movementRemainingFor(selectedUnit)}/{movementAllowanceFor(selectedUnit)}</strong>
              <span>Supply</span><strong>{["west_med", "central_med", "east_na"].includes(selectedUnit.mapPresence || "") ? "full" : selectedUnit.supplyState || "full"}</strong>
              <span>PP</span><strong>{selectedProductionCountry}: {selectedProduction === null || selectedProduction === undefined ? "NA" : selectedProduction}</strong>
              <span>Attivazione</span><strong>{activationCostFor(selectedUnit)} PP</strong>
              <span>Posizione</span><strong>{selectedUnit.mapPresence === "west_med" ? "Western Mediterranean Box" : selectedUnit.mapPresence === "central_med" ? "Central Mediterranean Box" : selectedUnit.mapPresence === "east_na" ? "Eastern North America Box" : selectedUnit.mapPresence === "off_map" ? "Off-map" : hexLabel(selectedUnit.position)}</strong>
            </div>
            {["west_med", "central_med"].includes(selectedUnit.mapPresence || "") && (
              <div className={styles.contextBox}>
                <strong>{selectedUnit.mapPresence === "central_med" ? "Central Med Box" : "Western Med Box"}</strong>
                {selectedUnit.type === "air" ? (
                  <span>Disponibile per Air Support nei combattimenti costieri consentiti dallo scenario.</span>
                ) : selectedUnit.mapPresence === "central_med" ? (
                  <span>Clicca uno degli esagoni evidenziati per tentare l'Amphibious Invasion dall'area Mediterraneo Centrale ({validMoves.length} opzioni).</span>
                ) : (
                  <span>Clicca uno degli esagoni evidenziati per tentare l'Amphibious Invasion verso Marsiglia o adiacenti ({validMoves.length} opzioni).</span>
                )}
              </div>
            )}
          </>
        ) : (
          <p>Clicca una pedina per leggerne i dati.</p>
        )}
      </section>

      <section className={styles.infoCard}>
        <header>
          <span>Esagono</span>
          {inspectedCoord && <strong>{hexLabel(inspectedCoord)}</strong>}
        </header>
        {inspectedCoord && inspectedHex ? (
          <>
            <div className={styles.dataGrid}>
              <span>Coordinate</span><strong>{inspectedCoord.q}, {inspectedCoord.r}</strong>
              <span>Nome</span><strong>{inspectedHex.features.name || "-"}</strong>
              <span>Paese</span><strong>{inspectedHex.features.country || "-"}</strong>
              <span>Controllo</span><strong>{controllerLabel(inspectedHex.features.controller)}</strong>
              <span>Terreno</span><strong>{terrainLabel[inspectedHex.terrain]}</strong>
              <span>Tag</span><strong>{(inspectedHex.terrainTags || []).join(", ") || "-"}</strong>
              <span>Citta</span><strong>{boolLabel(inspectedHex.features.city)}</strong>
              <span>Porto</span><strong>{boolLabel(inspectedHex.features.port)}</strong>
              <span>Produzione</span><strong>{boolLabel(inspectedHex.features.productionCenter)}</strong>
              <span>Capitale</span><strong>{boolLabel(inspectedHex.features.capital)}</strong>
            </div>
            <div className={styles.stackLine}>
              <span>Stack</span>
              <strong>{stack.length > 0 ? stack.map((unit) => unit.name).join(", ") : "-"}</strong>
            </div>
          </>
        ) : (
          <p>Clicca un esagono o una pedina per leggere i dati dell'esagono.</p>
        )}
      </section>
    </div>
  );

  return (
    <section className={`${styles.panel} ${!expanded ? styles.collapsedPanel : ""}`} aria-label="Schede inferiori">
      <div className={styles.panelHeader}>
        <div className={styles.tabBar}>
          <button type="button" className={tabClass("inspector")} onClick={() => setTab("inspector")}>
            Ispettore
          </button>
          <button type="button" className={tabClass("timeline")} onClick={() => setTab("timeline")}>
            Turn Track
          </button>
        </div>
        <button type="button" className={styles.collapseButton} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Riduci" : "Espandi"}
        </button>
      </div>

      {expanded && (
        <div className={styles.panelBody}>
          {tab === "inspector" && renderInspector()}
          {tab === "timeline" && renderTimeline()}
        </div>
      )}
    </section>
  );
};
