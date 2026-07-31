/**
 * Pannello di controllo del gioco
 */

import React, { useState } from "react";
import { useGameStore } from "../store/gameStore";
import {
  coordKey,
  edgeKey,
  GameState,
  HEX_SIDES,
  hexCodeForMap,
  HexCoord,
  HexSide,
  scenarioById,
  Side,
  TerrainTag
} from "@uswc/shared";
import styles from "./GameControls.module.css";

const TERRAIN_TAGS: Array<{ tag: TerrainTag; label: string }> = [
  { tag: "plain", label: "Plain" },
  { tag: "mountain", label: "Rough/Hill" },
  { tag: "forest", label: "Forest" },
  { tag: "swamp", label: "Swamp" },
  { tag: "sea", label: "Sea" },
  { tag: "coast", label: "Coast" }
];

const COUNTRY_OPTIONS = [
  "Germany",
  "France",
  "Belgium",
  "Netherlands",
  "UK",
  "USA",
  "Switzerland",
  "Italy",
  "Luxembourg",
  "Greece",
  "Albania",
  "Bulgaria",
  "Yugoslavia",
  "Romania",
  "Hungary",
  "USSR",
  "Finland",
  "Estonia",
  "Latvia",
  "Lithuania",
  "Poland"
];
const CONTROLLER_OPTIONS: Array<{ value: "" | Side | "neutral"; label: string }> = [
  { value: "", label: "Original" },
  { value: Side.AXIS, label: "Axis" },
  { value: Side.ALLIED, label: "Western" },
  { value: "neutral", label: "Neutral" }
];

const neighborForSide = (coord: HexCoord, side: HexSide): HexCoord => {
  const isIndentedRow = coord.r % 2 === 0;
  const deltas: Record<HexSide, HexCoord> = {
    N: { q: isIndentedRow ? 0 : -1, r: -1 },
    NE: { q: isIndentedRow ? 1 : 0, r: -1 },
    SE: { q: 1, r: 0 },
    S: { q: isIndentedRow ? 1 : 0, r: 1 },
    SW: { q: isIndentedRow ? 0 : -1, r: 1 },
    NW: { q: -1, r: 0 }
  };
  const delta = deltas[side];
  return { q: coord.q + delta.q, r: coord.r + delta.r };
};

const SIDE_LABELS: Record<HexSide, string> = {
  N: "NW",
  NE: "NE",
  SE: "E",
  S: "SE",
  SW: "SW",
  NW: "W"
};

const COLLAPSE_STORAGE_KEY = "uswc.collapsedSections.v1";

// Sezioni che parte degli utenti vorranno mantenere chiuse di default
const DEFAULT_COLLAPSED: Record<string, boolean> = {
  privateMap: true,
  hexData: false,
  log: true,
  scenarioRules: true
};

const loadCollapsedSections = (): Record<string, boolean> => {
  try {
    const stored = JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY) || "{}");
    return { ...DEFAULT_COLLAPSED, ...stored, hexData: false };
  } catch {
    return { ...DEFAULT_COLLAPSED };
  }
};

const saveCollapsedSections = (sections: Record<string, boolean>) => {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(sections));
  } catch {
    // Collapsed UI state is convenience-only.
  }
};

const scenarioExportSlug = (scenarioId: string | undefined): string =>
  (scenarioId || "scenario")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const createMapSeed = (state: GameState) => ({
  hexes: Array.from(state.map.values())
    .sort((a, b) => a.coord.r - b.coord.r || a.coord.q - b.coord.q)
    .map((hex) => ({
      q: hex.coord.q,
      r: hex.coord.r,
      coord: hex.coord,
      terrain: hex.terrain,
      terrainTags: hex.terrainTags || [],
      features: {
        country: hex.features.country,
        controller: hex.features.controller,
        disputedArea: hex.features.disputedArea,
        name: hex.features.name,
        city: Boolean(hex.features.city),
        port: Boolean(hex.features.port),
        productionCenter: Boolean(hex.features.productionCenter),
        capital: Boolean(hex.features.capital),
        prohibited: Boolean(hex.features.prohibited),
        fadedDot: Boolean(hex.features.fadedDot)
      },
      railEdges: hex.railEdges || []
    })),
  riverEdges: Array.from(state.riverEdges || []).sort(),
  mountainEdges: Array.from(state.mountainEdges || []).sort(),
  impassableEdges: Array.from(state.impassableEdges || []).sort()
});

interface CollapsibleSectionProps {
  id: string;
  title: string;
  collapsedSections: Record<string, boolean>;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  collapsedSections,
  onToggle,
  children
}) => {
  const isCollapsed = Boolean(collapsedSections[id]);

  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} type="button" onClick={() => onToggle(id)} aria-expanded={!isCollapsed}>
        <span>{title}</span>
        <strong>{isCollapsed ? "Open" : "Close"}</strong>
      </button>
      {!isCollapsed && children}
    </div>
  );
};

interface NudgePadProps {
  label: string;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
}

const NudgePad: React.FC<NudgePadProps> = ({ label, onUp, onDown, onLeft, onRight }) => (
  <div className={styles.nudgePad} aria-label={`${label} nudge controls`}>
    <span />
    <button type="button" onClick={onUp} aria-label={`${label} up`}>
      Up
    </button>
    <span />
    <button type="button" onClick={onLeft} aria-label={`${label} left`}>
      Left
    </button>
    <strong>{label}</strong>
    <button type="button" onClick={onRight} aria-label={`${label} right`}>
      Right
    </button>
    <span />
    <button type="button" onClick={onDown} aria-label={`${label} down`}>
      Down
    </button>
    <span />
  </div>
);

interface StepperRowProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const StepperRow: React.FC<StepperRowProps> = ({ label, value, onChange, min = -Infinity, max = Infinity }) => {
  const nextValue = (delta: number) => Math.min(max, Math.max(min, value + delta));

  return (
    <div className={styles.stepperRow}>
      <span>{label}</span>
      <button type="button" onClick={() => onChange(nextValue(-1))} aria-label={`Decrease ${label}`}>
        -
      </button>
      <strong>{value}</strong>
      <button type="button" onClick={() => onChange(nextValue(1))} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
};

type EdgeMode = "rail" | "river" | "mountain" | "strait" | "impassable";

const EDGE_MODES: Array<{ mode: EdgeMode; label: string; color: string }> = [
  { mode: "rail",       label: "Ferrovia",   color: "#111111" },
  { mode: "river",      label: "Fiume",      color: "#1f7fa8" },
  { mode: "mountain",   label: "Montagna",   color: "#6a4c2b" },
  { mode: "strait",     label: "Stretto",    color: "#8b5cf6" },
  { mode: "impassable", label: "Bloccato",   color: "#dc2626" }
];

interface HexEdgeEditorProps {
  gameState: GameState;
  selectedHex: HexCoord;
  railEdges: HexSide[];
  onToggleRail: (side: HexSide) => void;
  onToggleRiver: (neighbor: HexCoord) => void;
  onToggleMountain: (neighbor: HexCoord) => void;
  onToggleStrait: (neighbor: HexCoord) => void;
  onToggleImpassable: (neighbor: HexCoord) => void;
}

// SVG hex editor — pointed-top hex, buttons at side midpoints
// ViewBox 200×220. Hex center (100,110), R=60 (circumradius).
// Pointed-top vertices (angle = 90°+60°*i):
//   0=top(100,50), 1=TR(152,80), 2=BR(152,140), 3=bot(100,170), 4=BL(48,140), 5=TL(48,80)
// Side midpoints (average of adjacent vertices):
//   NW: (74,65)  NE: (126,65)  E: (152,110)  SE: (126,155)  SW: (74,155)  W: (48,110)
const HEX_SVG_CX = 100;
const HEX_SVG_CY = 110;
const HEX_SVG_R = 60;
const hexSvgVertices = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 180) * (90 + 60 * i);
  return { x: HEX_SVG_CX - HEX_SVG_R * Math.cos(angle), y: HEX_SVG_CY - HEX_SVG_R * Math.sin(angle) };
});
const hexSvgMidpoints: Record<HexSide, { x: number; y: number }> = {
  N:  { x: (hexSvgVertices[5].x + hexSvgVertices[0].x) / 2, y: (hexSvgVertices[5].y + hexSvgVertices[0].y) / 2 }, // NW side
  NE: { x: (hexSvgVertices[0].x + hexSvgVertices[1].x) / 2, y: (hexSvgVertices[0].y + hexSvgVertices[1].y) / 2 }, // NE side
  SE: { x: (hexSvgVertices[1].x + hexSvgVertices[2].x) / 2, y: (hexSvgVertices[1].y + hexSvgVertices[2].y) / 2 }, // E side
  S:  { x: (hexSvgVertices[2].x + hexSvgVertices[3].x) / 2, y: (hexSvgVertices[2].y + hexSvgVertices[3].y) / 2 }, // SE side
  SW: { x: (hexSvgVertices[3].x + hexSvgVertices[4].x) / 2, y: (hexSvgVertices[3].y + hexSvgVertices[4].y) / 2 }, // SW side
  NW: { x: (hexSvgVertices[4].x + hexSvgVertices[5].x) / 2, y: (hexSvgVertices[4].y + hexSvgVertices[5].y) / 2 }, // W side
};
const hexSvgPoints = hexSvgVertices.map((v) => `${v.x},${v.y}`).join(" ");

const HexEdgeEditor: React.FC<HexEdgeEditorProps> = ({
  gameState,
  selectedHex,
  railEdges,
  onToggleRail,
  onToggleRiver,
  onToggleMountain,
  onToggleStrait,
  onToggleImpassable
}) => {
  const [activeMode, setActiveMode] = useState<EdgeMode>("rail");
  const modeColor = EDGE_MODES.find((m) => m.mode === activeMode)?.color || "#fff";
  const BTN_R = 18;

  return (
    <div className={styles.edgeEditorWrap}>
      <div className={styles.edgeModeTabs}>
        {EDGE_MODES.map(({ mode, label, color }) => (
          <button
            key={mode}
            type="button"
            className={`${styles.edgeModeTab} ${activeMode === mode ? styles.edgeModeTabActive : ""}`}
            style={activeMode === mode ? { borderBottomColor: color, color } : undefined}
            onClick={() => setActiveMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 200 220" className={styles.edgeHexSvg} aria-label="Editor lati esagono">
        {/* hex fill */}
        <polygon points={hexSvgPoints} fill="#141d22" stroke="#9aa9af" strokeWidth="2" />
        {/* center dot */}
        <circle cx={HEX_SVG_CX} cy={HEX_SVG_CY} r="6" fill="#c54e45" stroke="#f1e7d0" strokeWidth="1.5" />

        {HEX_SIDES.map((side) => {
          const neighbor = neighborForSide(selectedHex, side);
          const riverKey = edgeKey(selectedHex, neighbor);
          const hasNeighbor = gameState.map.has(coordKey(neighbor));
          const isActive =
            activeMode === "rail"       ? railEdges.includes(side) :
            activeMode === "river"      ? hasNeighbor && gameState.riverEdges.has(riverKey) :
            activeMode === "mountain"   ? hasNeighbor && gameState.mountainEdges.has(riverKey) :
            activeMode === "strait"     ? hasNeighbor && gameState.straitEdges.has(riverKey) :
                                          hasNeighbor && gameState.impassableEdges.has(riverKey);
          const disabled = !hasNeighbor && activeMode !== "rail";
          const mp = hexSvgMidpoints[side];
          const label = SIDE_LABELS[side];

          const handleClick = () => {
            if (disabled) return;
            if (activeMode === "rail")           onToggleRail(side);
            else if (activeMode === "river")     onToggleRiver(neighbor);
            else if (activeMode === "mountain")  onToggleMountain(neighbor);
            else if (activeMode === "strait")    onToggleStrait(neighbor);
            else                                 onToggleImpassable(neighbor);
          };

          return (
            <g key={side} onClick={handleClick} style={{ cursor: disabled ? "not-allowed" : "pointer" }} opacity={disabled ? 0.3 : 1}>
              {isActive && <circle cx={mp.x} cy={mp.y} r={BTN_R + 3} fill="none" stroke="#ffffff" strokeWidth="2" />}
              <circle
                cx={mp.x} cy={mp.y} r={BTN_R}
                fill={isActive ? modeColor : "#10181c"}
                stroke={isActive ? modeColor : "#4a6070"}
                strokeWidth="1.5"
              />
              <text
                x={mp.x} y={mp.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize="9" fontWeight="800" fontFamily="system-ui, sans-serif"
                fill={isActive ? "#fff" : "#8a9ba3"}
                style={{ userSelect: "none", pointerEvents: "none" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

interface GameControlsProps {
  onNewGame: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({ onNewGame }) => {
  const gameState = useGameStore((state) => state.gameState);
  const selectedHex = useGameStore((state) => state.selectedHex);
  const privateMapLayer = useGameStore((state) => state.privateMapLayer);
  const savedCalibrations = useGameStore((state) => state.savedCalibrations);
  const resetFrance1940Setup = useGameStore((state) => state.resetFrance1940Setup);
  const setPrivateMapImage = useGameStore((state) => state.setPrivateMapImage);
  const updatePrivateMapLayer = useGameStore((state) => state.updatePrivateMapLayer);
  const saveCurrentCalibration = useGameStore((state) => state.saveCurrentCalibration);
  const loadCalibration = useGameStore((state) => state.loadCalibration);
  const deleteCalibration = useGameStore((state) => state.deleteCalibration);
  const exportScenario = useGameStore((state) => state.exportScenario);
  const importScenario = useGameStore((state) => state.importScenario);
  const runAiStep = useGameStore((state) => state.runAiStep);
  const assignDefaultFrenchHexes = useGameStore((state) => state.assignDefaultFrenchHexes);
  const assignScenarioControl = useGameStore((state) => state.assignScenarioControl);
  const toggleHexTerrainTag = useGameStore((state) => state.toggleHexTerrainTag);
  const updateHexFeatures = useGameStore((state) => state.updateHexFeatures);
  const toggleRailSide = useGameStore((state) => state.toggleRailSide);
  const toggleRiverEdge = useGameStore((state) => state.toggleRiverEdge);
  const toggleMountainEdge = useGameStore((state) => state.toggleMountainEdge);
  const toggleStraitEdge = useGameStore((state) => state.toggleStraitEdge);
  const toggleImpassableEdge = useGameStore((state) => state.toggleImpassableEdge);
  const [calibrationName, setCalibrationName] = useState("France 1940");
  const [scenarioImportStatus, setScenarioImportStatus] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => loadCollapsedSections());

  const selectedMapHex = selectedHex && gameState ? gameState.map.get(coordKey(selectedHex)) : null;
  const currentScenario = scenarioById(gameState?.scenarioId);
  const hexLabel = (coord: HexCoord) => hexCodeForMap(coord, currentScenario.mapId);

  const handlePrivateMapUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPrivateMapImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleScenarioExport = () => {
    const contents = exportScenario();
    const fileName = `uswc-${scenarioExportSlug(gameState?.scenarioId)}-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([contents], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    fetch("http://127.0.0.1:3001/api/scenario-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, contents })
    })
      .then((response) => response.json())
      .then((result) => {
        if (result?.filePath) {
          setScenarioImportStatus(`Scenario saved: ${result.filePath}`);
        }
      })
      .catch(() => {
        // The browser download is still attempted if the local backend is not running.
      });
    setScenarioImportStatus("Scenario exported.");
  };

  const handleMapSeedSave = () => {
    if (!gameState) return;
    const seed = createMapSeed(gameState);
    fetch("http://127.0.0.1:3001/api/dev/map-seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapId: currentScenario.mapId, scenarioId: gameState.scenarioId, seed })
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || "Save failed");
        const written = Array.isArray(result?.written) ? result.written.join(", ") : result?.fileName;
        setScenarioImportStatus(`Seed mappa salvato nel progetto: ${written}`);
      })
      .catch((error: Error) => {
        setScenarioImportStatus(`Seed non salvato: ${error.message}. Avvia il backend locale sulla porta 3001.`);
      });
  };

  const handleScenarioImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setScenarioImportStatus(importScenario(reader.result) ? "Scenario imported." : "Import failed.");
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleAiStep = () => {
    const note = runAiStep();
    setAiStatus(note || "IA non disponibile in questo momento.");
  };

  const handleNewGame = () => {
    const turn = gameState?.turnCode;
    const confirmed = window.confirm(
      turn
        ? `Abbandonare la partita in corso (turno ${turn}) e tornare alla scelta dello scenario?\n\nI progressi non salvati andranno persi.`
        : "Tornare alla scelta dello scenario?"
    );
    if (confirmed) onNewGame();
  };

  const handleResetSetup = () => {
    if (window.confirm("Riportare lo scenario al setup iniziale? La partita in corso verrà persa.")) {
      resetFrance1940Setup();
    }
  };

  const toggleSection = (id: string) => {
    setCollapsedSections((current) => {
      const next = { ...current, [id]: !current[id] };
      saveCollapsedSections(next);
      return next;
    });
  };

  return (
    <div className={styles.controlsPanel}>
      <CollapsibleSection id="log" title="Log azioni" collapsedSections={collapsedSections} onToggle={toggleSection}>
        {gameState && gameState.history.length > 0 ? (
          <div className={styles.logList}>
            {gameState.history.slice(0, 20).map((action, index) => (
              <div key={`${action.timestamp.toString()}-${index}`} className={styles.logRow}>
                <strong>{action.side === "axis" ? "Asse" : "Alleati"}</strong>
                <span>{action.note || action.type}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>Nessuna azione registrata.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection id="scenarioRules" title="Regole scenario" collapsedSections={collapsedSections} onToggle={toggleSection}>
        {currentScenario.specialRules && currentScenario.specialRules.length > 0 ? (
          <div className={styles.logList}>
            {currentScenario.specialRules.map((rule, i) => (
              <div key={i} className={styles.ruleRow}>{rule}</div>
            ))}
          </div>
        ) : (
          <p>Nessuna regola speciale per questo scenario.</p>
        )}
      </CollapsibleSection>

      <div className={styles.actions}>
        <button
          className={styles.btnAi}
          type="button"
          onClick={handleAiStep}
          disabled={!gameState || gameState.phase !== "operations" || gameState.subPhase !== "actions"}
          title="Esegue una singola attivazione IA per il lato corrente"
        >
          Mossa IA
        </button>
        {aiStatus && <p className={styles.actionStatus}>{aiStatus}</p>}
        <button className={styles.btnSecondary} type="button" onClick={handleScenarioExport}>
          Export scenario
        </button>
        <button className={styles.btnSecondary} type="button" onClick={handleMapSeedSave} disabled={!gameState}>
          Salva seed mappa
        </button>
        <label className={styles.actionImportButton}>
          <span>Import scenario</span>
          <input type="file" accept="application/json,.json" onChange={handleScenarioImport} />
        </label>
        {scenarioImportStatus && <p className={styles.actionStatus}>{scenarioImportStatus}</p>}
        <button className={styles.btnSecondary} onClick={handleResetSetup} disabled={!gameState}>
          Reset setup scenario
        </button>
        {/* Azione distruttiva: in fondo alla lista e dietro conferma, per non
            cancellare una partita con un click di troppo. */}
        <button className={styles.btnDanger} onClick={handleNewGame}>
          Nuovo gioco
        </button>
      </div>

      <CollapsibleSection id="hexData" title="Editor esagono" collapsedSections={collapsedSections} onToggle={toggleSection}>
        {selectedHex && selectedMapHex ? (
          <>
            <p>
              Hex: <strong>{hexLabel(selectedHex)}</strong> <span>({selectedHex.q}, {selectedHex.r})</span>
            </p>
            <label className={styles.selectRow}>
              <span>Name</span>
              <input
                type="text"
                value={selectedMapHex.features.name || ""}
                onChange={(event) => updateHexFeatures(selectedHex, { name: event.target.value || undefined })}
                placeholder="Amsterdam"
              />
            </label>
            <label className={styles.selectRow}>
              <span>Country</span>
              <select
                value={selectedMapHex.features.country || ""}
                onChange={(event) => updateHexFeatures(selectedHex, { country: event.target.value || undefined })}
              >
                <option value="">Unassigned</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option value={country} key={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.selectRow}>
              <span>Control</span>
              <select
                value={selectedMapHex.features.controller || ""}
                onChange={(event) =>
                  updateHexFeatures(selectedHex, {
                    controller: event.target.value ? (event.target.value as Side | "neutral") : undefined
                  })
                }
              >
                {CONTROLLER_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value || "original"}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.selectRow}>
              <span>Dispute</span>
              <input
                type="text"
                value={selectedMapHex.features.disputedArea || ""}
                onChange={(event) => updateHexFeatures(selectedHex, { disputedArea: event.target.value || undefined })}
                placeholder="Alsace-Lorraine"
              />
            </label>
            <div className={styles.edgeList}>
              <h4>Terrain</h4>
              <div className={styles.featureGrid}>
                {TERRAIN_TAGS.map(({ tag, label }) => (
                  <label key={tag}>
                    <input
                      type="checkbox"
                      checked={(selectedMapHex.terrainTags || []).includes(tag)}
                      onChange={() => toggleHexTerrainTag(selectedHex, tag)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.edgeList}>
              <h4>Type</h4>
              <div className={styles.featureGrid}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMapHex.features.city}
                    onChange={(event) => updateHexFeatures(selectedHex, { city: event.target.checked })}
                  />
                  <span>City</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMapHex.features.port}
                    onChange={(event) => updateHexFeatures(selectedHex, { port: event.target.checked })}
                  />
                  <span>Port</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMapHex.features.productionCenter}
                    onChange={(event) => updateHexFeatures(selectedHex, { productionCenter: event.target.checked })}
                  />
                  <span>Production</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMapHex.features.capital}
                    onChange={(event) => updateHexFeatures(selectedHex, { capital: event.target.checked })}
                  />
                  <span>Capital</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMapHex.features.prohibited}
                    onChange={(event) => updateHexFeatures(selectedHex, { prohibited: event.target.checked })}
                  />
                  <span>Prohibited</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMapHex.features.fadedDot}
                    onChange={(event) => updateHexFeatures(selectedHex, { fadedDot: event.target.checked })}
                  />
                  <span>Faded dot</span>
                </label>
              </div>
            </div>
            <div className={styles.edgeList}>
              <h4>Hexsides</h4>
              <HexEdgeEditor
                gameState={gameState!}
                selectedHex={selectedHex}
                railEdges={selectedMapHex.railEdges || []}
                onToggleRail={(side) => toggleRailSide(selectedHex, side)}
                onToggleRiver={(neighbor) => toggleRiverEdge(selectedHex, neighbor)}
                onToggleMountain={(neighbor) => toggleMountainEdge(selectedHex, neighbor)}
                onToggleStrait={(neighbor) => toggleStraitEdge(selectedHex, neighbor)}
                onToggleImpassable={(neighbor) => toggleImpassableEdge(selectedHex, neighbor)}
              />
            </div>
            <p>
              Supply: <strong>{selectedMapHex.supply}</strong>
            </p>
          </>
        ) : (
          <p>Clicca un esagono sulla mappa per vedere o modificare i dati.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection id="privateMap" title="Private Map" collapsedSections={collapsedSections} onToggle={toggleSection}>
        <label className={styles.filePicker}>
          <span>{privateMapLayer.imageDataUrl ? "Replace map image" : "Load map image"}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePrivateMapUpload} />
        </label>
        <label className={styles.rangeRow}>
          <span>Opacity</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={privateMapLayer.opacity}
            onChange={(event) => updatePrivateMapLayer({ opacity: Number(event.target.value) })}
          />
        </label>
        <label className={styles.rangeRow}>
          <span>Scale</span>
          <input
            type="range"
            min="0.25"
            max="2.5"
            step="0.05"
            value={privateMapLayer.scale}
            onChange={(event) => updatePrivateMapLayer({ scale: Number(event.target.value) })}
          />
        </label>
        <label className={styles.rangeRow}>
          <span>Width</span>
          <input
            type="range"
            min="24"
            max="140"
            step="1"
            value={privateMapLayer.gridHexWidth}
            onChange={(event) => updatePrivateMapLayer({ gridHexWidth: Number(event.target.value) })}
          />
        </label>
        <StepperRow
          label="Width"
          value={privateMapLayer.gridHexWidth}
          min={24}
          max={140}
          onChange={(value) => updatePrivateMapLayer({ gridHexWidth: value })}
        />
        <label className={styles.rangeRow}>
          <span>Height</span>
          <input
            type="range"
            min="24"
            max="160"
            step="1"
            value={privateMapLayer.gridHexHeight}
            onChange={(event) => updatePrivateMapLayer({ gridHexHeight: Number(event.target.value) })}
          />
        </label>
        <StepperRow
          label="Height"
          value={privateMapLayer.gridHexHeight}
          min={24}
          max={160}
          onChange={(value) => updatePrivateMapLayer({ gridHexHeight: value })}
        />
        <label className={styles.rangeRow}>
          <span>X step</span>
          <input
            type="range"
            min="20"
            max="150"
            step="1"
            value={privateMapLayer.gridColumnStep}
            onChange={(event) => updatePrivateMapLayer({ gridColumnStep: Number(event.target.value) })}
          />
        </label>
        <StepperRow
          label="X step"
          value={privateMapLayer.gridColumnStep}
          min={20}
          max={150}
          onChange={(value) => updatePrivateMapLayer({ gridColumnStep: value })}
        />
        <label className={styles.rangeRow}>
          <span>Y step</span>
          <input
            type="range"
            min="20"
            max="150"
            step="1"
            value={privateMapLayer.gridRowStep}
            onChange={(event) => updatePrivateMapLayer({ gridRowStep: Number(event.target.value) })}
          />
        </label>
        <StepperRow
          label="Y step"
          value={privateMapLayer.gridRowStep}
          min={20}
          max={150}
          onChange={(value) => updatePrivateMapLayer({ gridRowStep: value })}
        />
        <label className={styles.rangeRow}>
          <span>Shift</span>
          <input
            type="range"
            min="-120"
            max="120"
            step="1"
            value={privateMapLayer.gridRowShift}
            onChange={(event) => updatePrivateMapLayer({ gridRowShift: Number(event.target.value) })}
          />
        </label>
        <StepperRow
          label="Shift"
          value={privateMapLayer.gridRowShift}
          min={-120}
          max={120}
          onChange={(value) => updatePrivateMapLayer({ gridRowShift: value })}
        />
        <div className={styles.gridSummary}>
          Grid: <strong>{privateMapLayer.gridRows} rows x {privateMapLayer.gridColumns} hexes</strong>
        </div>
        <div className={styles.dimensionGrid}>
          <label>
            <span>Grid X</span>
            <input
              type="number"
              value={privateMapLayer.gridOffsetX}
              onChange={(event) => updatePrivateMapLayer({ gridOffsetX: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Grid Y</span>
            <input
              type="number"
              value={privateMapLayer.gridOffsetY}
              onChange={(event) => updatePrivateMapLayer({ gridOffsetY: Number(event.target.value) })}
            />
          </label>
        </div>
        <NudgePad
          label="Grid"
          onUp={() => updatePrivateMapLayer({ gridOffsetY: privateMapLayer.gridOffsetY - 1 })}
          onDown={() => updatePrivateMapLayer({ gridOffsetY: privateMapLayer.gridOffsetY + 1 })}
          onLeft={() => updatePrivateMapLayer({ gridOffsetX: privateMapLayer.gridOffsetX - 1 })}
          onRight={() => updatePrivateMapLayer({ gridOffsetX: privateMapLayer.gridOffsetX + 1 })}
        />
        <NudgePad
          label="Map"
          onUp={() => updatePrivateMapLayer({ offsetY: privateMapLayer.offsetY - 1 })}
          onDown={() => updatePrivateMapLayer({ offsetY: privateMapLayer.offsetY + 1 })}
          onLeft={() => updatePrivateMapLayer({ offsetX: privateMapLayer.offsetX - 1 })}
          onRight={() => updatePrivateMapLayer({ offsetX: privateMapLayer.offsetX + 1 })}
        />
        <div className={styles.mapTools}>
          <button type="button" onClick={assignDefaultFrenchHexes}>
            Assign France to unassigned land
          </button>
          <button type="button" onClick={assignScenarioControl}>
            Assign scenario control
          </button>
        </div>
        <div className={styles.saveRow}>
          <input
            type="text"
            value={calibrationName}
            onChange={(event) => setCalibrationName(event.target.value)}
            aria-label="Calibration name"
          />
          <button type="button" onClick={() => saveCurrentCalibration(calibrationName)}>
            Save All
          </button>
        </div>
        {savedCalibrations.length > 0 && (
          <div className={styles.calibrationList}>
            {savedCalibrations.map((calibration) => (
              <div className={styles.calibrationRow} key={calibration.id}>
                <span>{calibration.name}</span>
                <button type="button" onClick={() => loadCalibration(calibration.id)}>
                  Load
                </button>
                <button type="button" onClick={() => deleteCalibration(calibration.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={privateMapLayer.showGrid}
            onChange={(event) => updatePrivateMapLayer({ showGrid: event.target.checked })}
          />
          <span>Show hex grid</span>
        </label>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={privateMapLayer.showCountryColors}
            onChange={(event) => updatePrivateMapLayer({ showCountryColors: event.target.checked })}
          />
          <span>Show country colors</span>
        </label>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={privateMapLayer.showProceduralTerrain}
            onChange={(event) => updatePrivateMapLayer({ showProceduralTerrain: event.target.checked })}
          />
          <span>Show generated terrain</span>
        </label>
        {privateMapLayer.showProceduralTerrain && (
          <label className={styles.rangeRow}>
            <span>Terrain</span>
            <input
              type="range"
              min="0.05"
              max="0.85"
              step="0.05"
              value={privateMapLayer.proceduralTerrainOpacity}
              onChange={(event) => updatePrivateMapLayer({ proceduralTerrainOpacity: Number(event.target.value) })}
            />
          </label>
        )}
        <button className={styles.smallButton} type="button" onClick={() => setPrivateMapImage(null)} disabled={!privateMapLayer.imageDataUrl}>
          Clear private map
        </button>
      </CollapsibleSection>

      <div className={styles.footer}>
        <p>MVP v0.2 - movement, ZOC and combat dice online</p>
      </div>
    </div>
  );
};
