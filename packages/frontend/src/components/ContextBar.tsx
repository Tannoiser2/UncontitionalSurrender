import React from "react";
import {
  ActionType,
  amphibiousTargetsFor,
  calculateNavalEvacuationTargets,
  canNavalTransport,
  canReceiveReplacement,
  canStrategicMove,
  GameState,
  GamePhase,
  GameSubPhase,
  getAirCombatPreview,
  getCombatPreview,
  getEligibleAirSupporters,
  getEligibleCombatEventMarkers,
  hexCodeForMap,
  mobilizationCostFor,
  productionCountryFor,
  replacementCostFor,
  replacementProductionCountry,
  scenarioById,
  Side,
  Unit,
  UnitType,
  playMapEventMarker,
} from "@uswc/shared";
import { useGameStore } from "../store/gameStore";
import { UnitCounter } from "./UnitCounter";
import styles from "./ContextBar.module.css";

const weatherLabel = (w?: string) => {
  if (w === "fair") return "Buono";
  if (w === "poor") return "Cattivo";
  if (w === "severe") return "Estremo";
  return "-";
};

const eventIcon = (id: string): string | undefined => {
  const n = id.toLowerCase();
  if (n.includes("airdrop")) return "/event-icons/Airdrop.png";
  if (n.includes("ground support")) return "/event-icons/Ground_Support.png";
  if (n.includes("tanks")) return "/event-icons/Tanks.png";
  if (n.includes("jets")) return "/event-icons/Jets.png";
  if (n.includes("rockets")) return "/event-icons/Rockets.png";
  if (n.includes("ultra")) return "/event-icons/Ultra.png";
  if (n.includes("free force")) return "/event-icons/Free_Force.png";
  if (n.includes("mulberry")) return "/event-icons/Mulberry.png";
  if (n.includes("naval evacuation")) return "/event-icons/Naval_evacuation.png";
  if (n.includes("naval")) return "/event-icons/Naval_evacuation.png";
  if (n.includes("partisans")) return "/event-icons/Partisans.png";
  if (n.includes("surprise")) return "/event-icons/Surprise_attack.png";
  if (n.includes("snafu")) return "/event-icons/SNAFU.png";
  if (n.includes("strategic")) return "/event-icons/Strategic_move.png";
  return undefined;
};

const sideLabel = (s?: string) => (s === "axis" ? "Asse" : "Alleati");

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

const countryFlagStyle = (country: string): React.CSSProperties => {
  const flags: Record<string, string> = {
    Belgium: "linear-gradient(90deg, #050505 0 33%, #f3d33b 33% 66%, #d21f2f 66% 100%)",
    Bulgaria: "linear-gradient(#ffffff 0 33%, #22966a 33% 66%, #d62612 66% 100%)",
    Finland: "linear-gradient(90deg, transparent 0 30%, #174a9c 30% 42%, transparent 42% 100%), linear-gradient(transparent 0 38%, #174a9c 38% 56%, transparent 56% 100%), #ffffff",
    France: "linear-gradient(90deg, #1f4fa3 0 33%, #f4f4f0 33% 66%, #d21f2f 66% 100%)",
    "Fr.N.Africa": "linear-gradient(90deg, #1f4fa3 0 33%, #f4f4f0 33% 66%, #d21f2f 66% 100%)",
    Germany: "linear-gradient(#111111 0 33%, #dd1f26 33% 66%, #f4d04c 66% 100%)",
    Greece: "repeating-linear-gradient(#2b62ad 0 8px, #f4f4f0 8px 16px)",
    Hungary: "linear-gradient(#c91f37 0 33%, #f4f4f0 33% 66%, #2e8b57 66% 100%)",
    Italy: "linear-gradient(90deg, #16834a 0 33%, #f4f4f0 33% 66%, #c9252d 66% 100%)",
    Netherlands: "linear-gradient(#ae1c28 0 33%, #f4f4f0 33% 66%, #21468b 66% 100%)",
    Romania: "linear-gradient(90deg, #224aa8 0 33%, #f3d33b 33% 66%, #ce2029 66% 100%)",
    UK: "linear-gradient(135deg, transparent 0 42%, #ffffff 42% 47%, #c8102e 47% 53%, #ffffff 53% 58%, transparent 58% 100%), linear-gradient(45deg, transparent 0 42%, #ffffff 42% 47%, #c8102e 47% 53%, #ffffff 53% 58%, transparent 58% 100%), linear-gradient(90deg, transparent 0 42%, #ffffff 42% 46%, #c8102e 46% 54%, #ffffff 54% 58%, transparent 58% 100%), linear-gradient(transparent 0 38%, #ffffff 38% 44%, #c8102e 44% 56%, #ffffff 56% 62%, transparent 62% 100%), #012169",
    USA: "repeating-linear-gradient(#b22234 0 7px, #ffffff 7px 14px)",
    USSR: "linear-gradient(#b31922, #b31922)",
    Yugoslavia: "linear-gradient(#1f4fa3 0 33%, #f4f4f0 33% 66%, #d21f2f 66% 100%)"
  };
  return { background: flags[country] || "linear-gradient(135deg, #314047, #0b1114)" };
};

const countryFlagCode = (country: string): string => {
  const codes: Record<string, string> = {
    Belgium: "BEL",
    Bulgaria: "BUL",
    Finland: "FIN",
    France: "FRA",
    "Fr.N.Africa": "FNA",
    Germany: "GER",
    Greece: "GRE",
    Hungary: "HUN",
    Italy: "ITA",
    Netherlands: "NED",
    Romania: "ROM",
    UK: "UK",
    USA: "USA",
    USSR: "USSR",
    Yugoslavia: "YUG"
  };
  return codes[country] || country.slice(0, 3).toUpperCase();
};

const hasMapEventTargets = (state: GameState, side: Side, markerId: string): boolean =>
  Array.from(state.map.values()).some((hex) => playMapEventMarker(state, side, markerId, hex.coord) !== null);

const canPlayVisibleOpsEvent = (state: GameState, side: Side, markerId: string, selectedUnit: Unit | null): boolean => {
  const normalized = markerId.toLowerCase();
  if (normalized.includes("naval evacuation")) {
    return Boolean(selectedUnit && selectedUnit.side === side && calculateNavalEvacuationTargets(state, selectedUnit).length > 0);
  }
  if (
    normalized.includes("airdrop") ||
    normalized.includes("mulberry") ||
    normalized.includes("partisans") ||
    normalized.includes("surprise attack")
  ) {
    return hasMapEventTargets(state, side, markerId);
  }
  return true;
};

const combatResultLabel = (code?: string): string => {
  if (code === "NE") return "NE – nessun effetto";
  if (code === "DR") return "DR – difensore in ritirata";
  if (code === "DD") return "DD – difensore ridotto";
  if (code === "DE") return "DE – difensore eliminato";
  if (code === "AS") return "AS – attaccante fermato";
  if (code === "AA") return "AA – attrito attaccante";
  return code || "-";
};

const resultCodeFromNote = (note?: string): string | undefined => note?.match(/→\s*([A-Z]{2})/)?.[1];

const btn = (
  label: string,
  onClick: () => void,
  opts: { active?: boolean; disabled?: boolean; color?: string; title?: string } = {}
) => (
  <button
    key={label}
    type="button"
    title={opts.title}
    disabled={opts.disabled}
    onClick={onClick}
    className={`${styles.btn} ${opts.active ? styles.btnActive : ""} ${opts.disabled ? styles.btnDisabled : ""}`}
    style={opts.color ? { background: opts.color } : undefined}
  >
    {label}
  </button>
);

const iconBtn = (
  key: string,
  label: string,
  icon: string,
  onClick: () => void,
  opts: { active?: boolean; disabled?: boolean; color?: string; title?: string } = {}
) => (
  <button
    key={key}
    type="button"
    title={opts.title ?? label}
    aria-label={label}
    disabled={opts.disabled}
    onClick={onClick}
    className={`${styles.btn} ${styles.iconBtn} ${opts.active ? styles.btnActive : ""} ${opts.disabled ? styles.btnDisabled : ""}`}
    style={opts.color ? { background: opts.color } : undefined}
  >
    <img src={icon} alt="" className={styles.iconBtnImg} />
  </button>
);

export const ContextBar: React.FC = () => {
  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const validMoves = useGameStore((s) => s.validMoves);
  const attackMode = useGameStore((s) => s.attackMode);
  const setAttackMode = useGameStore((s) => s.setAttackMode);
  const airActionMode = useGameStore((s) => s.airActionMode);
  const setAirActionMode = useGameStore((s) => s.setAirActionMode);
  const amphibiousMode = useGameStore((s) => s.amphibiousMode);
  const toggleAmphibiousMode = useGameStore((s) => s.toggleAmphibiousMode);
  const mobilizingUnitId = useGameStore((s) => s.mobilizingUnitId);
  const mapEventPlacement = useGameStore((s) => s.mapEventPlacement);
  const cancelMobilizing = useGameStore((s) => s.cancelMobilizing);
  const cancelMapEventPlacement = useGameStore((s) => s.cancelMapEventPlacement);
  const endSelectedActivation = useGameStore((s) => s.endSelectedActivation);
  const resolvePendingAssaults = useGameStore((s) => s.resolvePendingAssaults);
  const chooseAdvance = useGameStore((s) => s.chooseAdvance);
  const chooseDefenderCannotRetreat = useGameStore((s) => s.chooseDefenderCannotRetreat);
  const cancelPendingCombat = useGameStore((s) => s.cancelPendingCombat);
  const chooseAirCommit = useGameStore((s) => s.chooseAirCommit);
  const chooseEventCommit = useGameStore((s) => s.chooseEventCommit);
  const applyReplacementAction = useGameStore((s) => s.applyReplacementAction);
  const startMobilizingUnit = useGameStore((s) => s.startMobilizingUnit);
  const playEventMarker = useGameStore((s) => s.playEventMarker);
  const playSovietCounterattack = useGameStore((s) => s.playSovietCounterattack);
  const endSovietCounterattackAction = useGameStore((s) => s.endSovietCounterattackAction);
  const playRasputitsa = useGameStore((s) => s.playRasputitsa);

  if (!gameState) return null;

  const currentMapEventPlacement = mapEventPlacement;
  const weather = gameState.weather;
  const weatherIcon = weather ? `/weather-icons/${weather}.png` : null;
  const phase = gameState.phase;
  const subPhase = gameState.subPhase;
  const pending = gameState.pendingCombat;
  const currentMapId = scenarioById(gameState.scenarioId).mapId;
  const inActions = phase === GamePhase.OPERATIONS && subPhase === GameSubPhase.ACTIONS;
  const weatherBad = weather === "poor" || weather === "severe";
  const hasPendingAssaults = Array.from(gameState.units.values()).some(
    (u) => u.assaultTarget && u.side === gameState.currentSide
  );
  const blockedByPending = Boolean(pending);
  const isGroundSelected = selectedUnit && selectedUnit.type !== "air" && selectedUnit.type !== "fort";
  const isAirSelected = selectedUnit?.type === "air";

  // ── Weather box (always shown) ──────────────────────────────────────────────
  const weatherBox = (
    <div className={styles.weatherBox}>
      {weatherIcon ? (
        <img
          src={weatherIcon}
          alt={weatherLabel(weather)}
          className={styles.weatherIcon}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : <span className={styles.weatherIconPlaceholder}>☁</span>}
    </div>
  );

  // ── Context content ─────────────────────────────────────────────────────────
  let content: React.ReactNode = null;

  // Priority 1: pending combat states
  if (pending?.kind === "retreat") {
    const defender = gameState.units.get(pending.defenderId);
    const retreatSide = defender?.side ?? gameState.currentSide;
    const navalEvacEvents = defender && selectedUnit?.id === defender.id
      ? gameState.factionCards[retreatSide as Side].eventsBox.filter((id) =>
        id.toLowerCase().includes("naval evacuation") && canPlayVisibleOpsEvent(gameState, retreatSide as Side, id, selectedUnit)
      )
      : [];
    const latestAttack = gameState.history.find((a) => a.type === ActionType.ATTACK);
    content = (
      <div className={`${styles.context} ${styles.danger}`}>
        <div className={styles.contextMain}>
          <span>Ritirata difensore: scegli uno dei {pending.options.length} esagoni evidenziati.</span>
          {pending.allowDefenderCannotRetreat && btn("Applica DCR", chooseDefenderCannotRetreat, { color: "#7f1d1d" })}
          {navalEvacEvents.map((id) => {
            const icon = eventIcon(id);
            const active = currentMapEventPlacement?.markerId === id;
            return (
              <button
                key={id}
                type="button"
                className={`${styles.eventBtn} ${active ? styles.eventBtnActive : ""}`}
                onClick={() => playEventMarker(retreatSide as Side, id)}
                title={id}
                aria-label={id}
              >
                {icon && <img src={icon} alt="" className={styles.eventBtnImg} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
              </button>
            );
          })}
        </div>
        {latestAttack && (
          <div className={styles.contextSide}>
            <div className={styles.combatResultInline}>
              <strong>{combatResultLabel(resultCodeFromNote(latestAttack.note))}</strong>
              <span>{latestAttack.note}</span>
            </div>
          </div>
        )}
      </div>
    );
  } else if (pending?.kind === "advance") {
    const advanceAttackers = (pending.advanceAttackerIds || [pending.attackerId])
      .map((id) => gameState.units.get(id)).filter(Boolean);
    const latestAttack = gameState.history.find((a) => a.type === ActionType.ATTACK);
    // Naval Evacuation: mostra se il difensore è ora su hex costiero dopo la ritirata
    const defender = gameState.units.get(pending.defenderId);
    const defenderHex = defender ? gameState.map.get(`${defender.position.q},${defender.position.r}`) : null;
    const defenderIsCoastal = defenderHex && (defenderHex.terrain === "coastal" || (defenderHex.terrainTags || []).includes("coast"));
    const navalEvacSide = defender?.side ?? gameState.currentSide;
    const navalEvacEvents = defenderIsCoastal && defender && selectedUnit?.id === defender.id
      ? gameState.factionCards[navalEvacSide as Side].eventsBox.filter((id) =>
        id.toLowerCase().includes("naval evacuation") && canPlayVisibleOpsEvent(gameState, navalEvacSide as Side, id, selectedUnit)
      )
      : [];
    content = (
      <div className={`${styles.context} ${styles.info}`}>
        <div className={styles.contextMain}>
          <span>Avanzata dopo il combattimento?</span>
          {advanceAttackers.length > 1
            ? advanceAttackers.map((u) => iconBtn(`advance-${u!.id}`, `Avanza con ${u!.name}`, "/actions/Avanza.png", () => chooseAdvance(true, u!.id), { title: `Avanza con ${u!.name}` }))
            : iconBtn("advance", pending.forceAdvance ? "Sbarca" : "Avanza", "/actions/Avanza.png", () => chooseAdvance(true, pending.attackerId), { title: pending.forceAdvance ? "Sbarca" : "Avanza" })}
          {!pending.forceAdvance && iconBtn("stay", "Resta", "/actions/Resta.png", () => chooseAdvance(false), { title: "Resta" })}
          {navalEvacEvents.map((id) => {
            const icon = eventIcon(id);
            const active = currentMapEventPlacement?.markerId === id;
            return (
              <button key={id} type="button"
                className={`${styles.eventBtn} ${active ? styles.eventBtnActive : ""}`}
                onClick={() => playEventMarker(navalEvacSide as Side, id)}
                title={`${id}: evacua ${defender?.name} via mare`}
                aria-label={`${id}: evacua ${defender?.name} via mare`}
              >
                {icon && <img src={icon} alt="" className={styles.eventBtnImg} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
              </button>
            );
          })}
        </div>
        {latestAttack && (
          <div className={styles.contextSide}>
            <div className={styles.combatResultInline}>
              <strong>{combatResultLabel(resultCodeFromNote(latestAttack.note))}</strong>
              <span>{latestAttack.note}</span>
            </div>
          </div>
        )}
      </div>
    );
  } else if (pending?.kind === "commit") {
    const attacker = gameState.units.get(pending.attackerId);
    const defender = gameState.units.get(pending.defenderId);
    const committingSide = pending.stage === "attacker"
      ? attacker?.side
      : defender?.side;
    const committedAirId = pending.stage === "attacker" ? pending.airSupportAttackerId : pending.airSupportDefenderId;
    const eligible = committingSide
      ? getEligibleAirSupporters(gameState, pending.attackerId, pending.defenderId, pending.additionalAttackerIds, committingSide)
        .filter((u) => !committedAirId || u.id === committedAirId)
      : [];
    const committedEvents = committingSide === attacker?.side
      ? pending.eventMarkerAttackerIds || []
      : pending.eventMarkerDefenderIds || [];
    const eligibleEvents = committingSide
      ? getEligibleCombatEventMarkers(gameState, pending.attackerId, pending.defenderId, pending.additionalAttackerIds, committingSide, committedEvents)
      : [];
    const allEventIds = [...(pending.eventMarkerAttackerIds || []), ...(pending.eventMarkerDefenderIds || [])];
    const preview = attacker && defender ? getCombatPreview(gameState, attacker, defender, {
      attackType: pending.attackType,
      isAmphibious: pending.isAmphibious,
      additionalAttackerIds: pending.additionalAttackerIds,
      airSupportAttackerId: pending.airSupportAttackerId,
      airSupportDefenderId: pending.airSupportDefenderId,
      eventMarkerIds: allEventIds
    }) : null;
    const airAtt = pending.airSupportAttackerId ? gameState.units.get(pending.airSupportAttackerId) : null;
    const airDef = pending.airSupportDefenderId ? gameState.units.get(pending.airSupportDefenderId) : null;
    const airPreview = airAtt && airDef ? getAirCombatPreview(gameState, airAtt, airDef, {
      attackerJets: allEventIds.some((id) => id.toLowerCase().includes("jets")) && airAtt.side === Side.AXIS,
      defenderJets: allEventIds.some((id) => id.toLowerCase().includes("jets")) && airDef.side === Side.AXIS
    }) : null;
    const commitSideIcon = committingSide === Side.ALLIED ? "/actions/allied-turn.png" : "/actions/axis-turn.png";
    const commitSideLabel = `Commit: ${committingSide === "axis" ? "Asse" : "Alleati"}`;
    content = (
      <div className={`${styles.context} ${styles.commit}`}>
        <div className={styles.contextMain}>
          <span className={styles.sideChip} title={commitSideLabel} aria-label={commitSideLabel}>
            <img src={commitSideIcon} alt="" className={styles.sideChipImg} />
          </span>
          {eligible.length > 0 && (
            <div className={styles.actionGroup}>
              {eligible.map((u) => iconBtn(
                `air-${u.id}`,
                committedAirId === u.id ? `Supporto aereo: ${u.name}` : u.name,
                "/actions/air-support.png",
                () => chooseAirCommit(u.id),
                {
                  active: committedAirId === u.id,
                  color: committedAirId === u.id ? "#166534" : "#0e7490",
                  title: `${u.name} @${hexCodeForMap(u.position, currentMapId)} sortie ${u.sorties ?? 0}/6`,
                }
              ))}
            </div>
          )}
          {eligibleEvents.length > 0 && (
            <div className={styles.eventGroup}>
              {eligibleEvents.map((ev) => {
                const icon = eventIcon(ev.id);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className={styles.eventBtn}
                    onClick={() => chooseEventCommit(ev.id)}
                    title={ev.id}
                    aria-label={ev.id}
                  >
                    {icon && <img src={icon} alt="" className={styles.eventBtnImg} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                  </button>
                );
              })}
            </div>
          )}
          {committedEvents.length > 0 && <span className={styles.committed}>✓ {committedEvents.join(", ")}</span>}
          <div className={styles.serviceGroup}>
            {pending.stage === "attacker"
              ? iconBtn("pass-defender", "Passa al difensore", "/actions/Passa_difensore.png", () => chooseAirCommit(null), { title: "Passa al difensore" })
              : iconBtn("pass-resolve", "Passa e risolvi", "/actions/Passa_risolvi.png", () => chooseAirCommit(null), { title: "Passa e risolvi" })}
            {iconBtn("cancel-combat", pending.isAmphibious ? "Annulla invasione" : "Annulla combattimento", "/actions/Annulla.png", cancelPendingCombat, { title: pending.isAmphibious ? "Annulla invasione" : "Annulla combattimento" })}
          </div>
        </div>
        {preview && (
          <div className={styles.contextSide}>
            <div className={styles.combatPreviewInline}>
              <div className={styles.combatPreviewSide}>
                <span>ATT</span>
                <strong>DRM {signed(preview.attackerModifier)} + d6</strong>
                <em>{preview.attackerDrmText}</em>
              </div>
              <div className={styles.combatPreviewSide}>
                <span>DIF</span>
                <strong>DRM {signed(preview.defenderModifier)} + d6</strong>
                <em>{preview.defenderDrmText}</em>
              </div>
              {airPreview && (
                <div className={styles.combatPreviewSide}>
                  <span>AEREO</span>
                  <strong>{airPreview.attackerName} vs {airPreview.defenderName}</strong>
                  <em>ATT {signed(airPreview.attackerModifier)} / DIF {signed(airPreview.defenderModifier)}</em>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  } else if (mapEventPlacement) {
    const label = mapEventPlacement.mode === "strategic-move"
      ? selectedUnit
        ? `Strategic Move: muovi ${selectedUnit.name} (${validMoves.length} dest.)`
        : `Strategic Move: scegli unita (${validMoves.length} eleggibili)`
      : `Piazza ${mapEventPlacement.markerId}: scegli esagono evidenziato`;
    content = (
      <div className={`${styles.context} ${styles.info}`}>
        <span>{label}</span>
        {iconBtn("cancel-map-event", "Annulla", "/actions/Annulla.png", cancelMapEventPlacement)}
      </div>
    );
  } else if (mobilizingUnitId) {
    const unit = gameState.units.get(mobilizingUnitId);
    content = (
      <div className={`${styles.context} ${styles.mobilize}`}>
        <span>Piazza <strong>{unit?.name}</strong>: scegli una città evidenziata.</span>
        {iconBtn("cancel-mobilize", "Annulla", "/actions/Annulla.png", cancelMobilizing)}
      </div>
    );
  } else if (airActionMode === "rebase") {
    content = (
      <div className={`${styles.context} ${styles.info}`}>
        <span>{selectedUnit ? `${selectedUnit.name} — Riposizionamento aereo (${validMoves.length} dest.)` : `Riposizionamento aereo (${validMoves.length} dest.)`}</span>
        {iconBtn("cancel-rebase", "Annulla", "/actions/Annulla.png", () => setAirActionMode(null))}
      </div>
    );
  } else if (airActionMode === "strike") {
    content = (
      <div className={`${styles.context} ${styles.danger}`}>
        <span>Attacco aereo: scegli unita aerea nemica evidenziata.</span>
        {iconBtn("cancel-air-strike", "Annulla", "/actions/Annulla.png", () => setAirActionMode(null))}
      </div>
    );
  } else if (airActionMode === "naval") {
    content = (
      <div className={`${styles.context} ${styles.info}`}>
        <span>Trasporto Navale: scegli un porto amico ({validMoves.length} dest.).</span>
        {iconBtn("cancel-naval", "Annulla", "/actions/Annulla.png", () => setAirActionMode(null))}
      </div>
    );
  } else if (amphibiousMode) {
    content = (
      <div className={`${styles.context} ${styles.info}`}>
        <span>Invasione Anfibia: scegli esagono costiero evidenziato ({validMoves.length} opzioni).</span>
        {iconBtn("cancel-amphibious", "Annulla", "/actions/Annulla.png", toggleAmphibiousMode)}
      </div>
    );
  } else if (gameState.victory) {
    const colors: Record<string, string> = { axis: "#7f1d1d", allied: "#1e3a8a", draw: "#374151" };
    content = (
      <div className={`${styles.context}`} style={{ background: colors[gameState.victory.winner] || "#374151" }}>
        <span>{gameState.victory.winner.toUpperCase()} VICTORY — {gameState.victory.reason}</span>
      </div>
    );
  } else if (phase === GamePhase.WEATHER) {
    content = (
      <div className={styles.context}>
        <span>Turno <strong>{gameState.turnCode}</strong> — Tiro: {gameState.weatherRoll ?? "-"} — Mappa: {gameState.weatherMap ?? "-"}</span>
      </div>
    );
  } else if (phase === GamePhase.ECONOMY) {
    content = (
      <div className={styles.context}>
        <span>Fine Economia — premi Fine per continuare.</span>
      </div>
    );
  } else if (phase === GamePhase.STRATEGIC_MOVEMENT) {
    const eligibleStratUnits = Array.from(gameState.units.values()).filter(
      (u) => canStrategicMove(gameState, u)
    );
    const extraStrategicState = {
      ...gameState,
      strategicMoveUsed: {
        ...(gameState.strategicMoveUsed || {}),
        [gameState.currentSide as Side]: false
      }
    };
    const extraEligibleStratUnits = Array.from(gameState.units.values()).filter(
      (u) => canStrategicMove(extraStrategicState, u)
    );
    const stratEvents = gameState.factionCards[gameState.currentSide].eventsBox.filter((id) =>
      id.toLowerCase().includes("strategic") && extraEligibleStratUnits.length > 0
    );
    const displayedEligibleStratUnits = eligibleStratUnits.length > 0 ? eligibleStratUnits : extraEligibleStratUnits;
    const turnIcon = gameState.currentSide === Side.ALLIED ? "/actions/allied-turn.png" : "/actions/axis-turn.png";
    const turnLabel = `Movimento strategico: ${sideLabel(gameState.currentSide)}`;
    content = (
      <div className={styles.context}>
        <div className={styles.contextMain}>
          <span className={styles.sideChip} title={turnLabel} aria-label={turnLabel}>
            <img src={turnIcon} alt="" className={styles.sideChipImg} />
          </span>
          <div className={styles.actionGroup}>
            <span
              className={styles.railBadge}
              title={`${displayedEligibleStratUnits.length} unità eleggibili al movimento strategico`}
              aria-label={`${displayedEligibleStratUnits.length} unità eleggibili al movimento strategico`}
            >
              <span className={styles.railBadgeNumber}>{displayedEligibleStratUnits.length}</span>
            </span>
          </div>
          {stratEvents.length > 0 && (
            <div className={styles.eventGroup}>
              {stratEvents.map((id) => {
                const icon = eventIcon(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={styles.eventBtn}
                    onClick={() => playEventMarker(gameState.currentSide as Side, id)}
                    title={`${id}: gioca per un movimento strategico aggiuntivo`}
                    aria-label={`${id}: gioca per un movimento strategico aggiuntivo`}
                  >
                    {icon && <img src={icon} alt="" className={styles.eventBtnImg} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  } else if (inActions) {
    // Soviet Counterattack attivo: l'URSS può muovere una propria unità durante le Operazioni Asse
    const sovietCA = gameState.sovietCounterattackActive;
    const effectiveSide = sovietCA ? Side.ALLIED : (gameState.currentSide as Side);
    const turnIcon = sovietCA || gameState.currentSide === Side.ALLIED ? "/actions/allied-turn.png" : "/actions/axis-turn.png";
    const turnLabel = sovietCA ? "Contrattacco URSS" : `Tocca a ${sideLabel(gameState.currentSide)}`;

    const actionBtns: React.ReactNode[] = [];
    const serviceBtns: React.ReactNode[] = [];
    if (isGroundSelected && (!sovietCA || selectedUnit?.side === Side.ALLIED)) {
      actionBtns.push(iconBtn("mobile", "Mobile", "/actions/mobile.png", () => setAttackMode("mobile"), {
        active: attackMode === "mobile" && !weatherBad,
        disabled: weatherBad || selectedUnit!.hasMobileAttacked || blockedByPending,
        title: weatherBad ? "Meteo: solo Assault" : "Attacco mobile",
      }));
      actionBtns.push(iconBtn("assault", "Assault", "/actions/assault.png", () => setAttackMode("assault"), {
        active: attackMode === "assault" || weatherBad,
        disabled: selectedUnit!.hasMobileAttacked || blockedByPending,
        title: "Designa Assault",
      }));
      const inPort = selectedUnit!.side === Side.ALLIED && (
        selectedUnit!.mapPresence === "west_med" ||
        selectedUnit!.mapPresence === "central_med" ||
        selectedUnit!.mapPresence === "east_na" ||
        Boolean(gameState.map.get(`${selectedUnit!.position.q},${selectedUnit!.position.r}`)?.features.port)
      );
      if (inPort) {
        const targets = amphibiousTargetsFor(gameState, selectedUnit!);
        actionBtns.push(iconBtn("amphibious", "Invasione Anfibia", "/actions/amphibious-invasion.png", toggleAmphibiousMode, {
          active: amphibiousMode,
          disabled: blockedByPending || targets.length === 0,
          title: targets.length === 0 ? "Nessun bersaglio valido" : "Invasione Anfibia",
        }));
      }
    }
    if (selectedUnit && canNavalTransport(gameState, selectedUnit)) {
      actionBtns.push(iconBtn("naval", "Trasporto Navale", "/actions/naval-transport.png", () => setAirActionMode(airActionMode === "naval" ? null : "naval"), {
        active: airActionMode === "naval", disabled: blockedByPending,
      }));
    }
    if (isAirSelected) {
      actionBtns.push(iconBtn("rebase", "Riposiziona", "/actions/Rebase.png", () => setAirActionMode(airActionMode === "rebase" ? null : "rebase"), {
        active: airActionMode === "rebase", disabled: blockedByPending,
      }));
      actionBtns.push(iconBtn("air-strike", "Attacco Aereo", "/actions/air-attack.png", () => setAirActionMode(airActionMode === "strike" ? null : "strike"), {
        active: airActionMode === "strike", disabled: blockedByPending,
      }));
    }
    if (selectedUnit && !blockedByPending) {
      serviceBtns.push(iconBtn("end-activation", "Fine Attivazione", "/actions/Fine_attivazione.png", endSelectedActivation));
    }
    if (sovietCA) {
      serviceBtns.push(iconBtn("end-counterattack", "Fine Contrattacco", "/actions/Contrattacco%20sovietico.png", endSovietCounterattackAction));
    }
    if (hasPendingAssaults && !blockedByPending) {
      serviceBtns.push(iconBtn("resolve-assault", "Risolvi Assault", "/actions/assault.png", resolvePendingAssaults, { title: "Risolvi Assault" }));
    }

    const opsEvents = gameState.factionCards[effectiveSide].eventsBox.filter((id) => {
      const n = id.toLowerCase();
      return (
        n.includes("airdrop") ||
        n.includes("mulberry") ||
        n.includes("partisans") ||
        n.includes("surprise")
      ) && canPlayVisibleOpsEvent(gameState, effectiveSide, id, selectedUnit);
    });
    // Naval Evacuation: disponibile in operazioni se unità UK ground è su hex costiero
    const selectedHex = selectedUnit ? gameState.map.get(`${selectedUnit.position.q},${selectedUnit.position.r}`) : null;
    const selectedIsCoastal = selectedHex && (selectedHex.terrain === "coastal" || (selectedHex.terrainTags || []).includes("coast"));
    const navalEvacOpsEvents = selectedUnit && selectedIsCoastal
      ? gameState.factionCards[effectiveSide].eventsBox.filter((id) =>
        id.toLowerCase().includes("naval evacuation") && canPlayVisibleOpsEvent(gameState, effectiveSide, id, selectedUnit)
      )
      : [];

    // Barbarossa: eventi speciali URSS giocabili durante Operazioni Asse
    const alliedSpecialEvents: React.ReactNode[] = [];
    if ((gameState.scenarioId === "barbarossa1941" || gameState.scenarioId === "russia19411944") && gameState.currentSide === Side.AXIS && !sovietCA) {
      const alliedEvents = gameState.factionCards[Side.ALLIED].eventsBox;
      const counterattackMarker = alliedEvents.find((id) => id.toLowerCase().includes("counterattack"));
      const rasputitsaMarker = pending?.kind === "commit"
        ? alliedEvents.find((id) => id.toLowerCase().includes("rasputitsa"))
        : undefined;
      if (counterattackMarker) {
        alliedSpecialEvents.push(
          <button key={counterattackMarker} type="button" className={styles.eventBtn}
            onClick={() => playSovietCounterattack(counterattackMarker)}
            title="Soviet Counterattack: l'URSS attiva una propria unità durante le Operazioni Asse"
            aria-label="Soviet Counterattack: l'URSS attiva una propria unità durante le Operazioni Asse">
            <img
              src="/actions/Contrattacco%20sovietico.png"
              alt=""
              className={styles.eventBtnImg}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </button>
        );
      }
      if (rasputitsaMarker) {
        alliedSpecialEvents.push(
          <button key={rasputitsaMarker} type="button" className={`${styles.eventBtn} ${styles.eventBtnAllied}`}
            onClick={() => playRasputitsa(rasputitsaMarker)}
            title="Rasputitsa: annulla l'attacco Asse in corso"
            aria-label="Rasputitsa: annulla l'attacco Asse in corso">
            <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>🌧️</span>
          </button>
        );
      }
    }

    const lastCombat = gameState.history[0]?.type === ActionType.ATTACK ? gameState.history[0] : null;
    content = (
      <div className={styles.context}>
        <div className={styles.contextMain}>
          <span className={styles.sideChip} title={turnLabel} aria-label={turnLabel}>
            <img src={turnIcon} alt="" className={styles.sideChipImg} />
          </span>
          {actionBtns.length > 0 && <div className={styles.actionGroup}>{actionBtns}</div>}
          {[...opsEvents, ...navalEvacOpsEvents].length + alliedSpecialEvents.length > 0 && (
            <div className={styles.eventGroup}>
              {[...opsEvents, ...navalEvacOpsEvents].map((id) => {
                const icon = eventIcon(id);
                const active = currentMapEventPlacement?.markerId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.eventBtn} ${active ? styles.eventBtnActive : ""}`}
                    onClick={() => playEventMarker(effectiveSide, id)}
                    title={id}
                    aria-label={id}
                  >
                    {icon && <img src={icon} alt="" className={styles.eventBtnImg} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                  </button>
                );
              })}
              {alliedSpecialEvents}
            </div>
          )}
          {serviceBtns.length > 0 && <div className={styles.serviceGroup}>{serviceBtns}</div>}
        </div>
        {lastCombat && (
          <div className={styles.contextSide}>
            <div className={styles.combatResultInline}>
              <strong>{combatResultLabel(resultCodeFromNote(lastCombat.note))}</strong>
              <span>{lastCombat.note}</span>
            </div>
          </div>
        )}
      </div>
    );
  } else if (phase === GamePhase.REPLACEMENTS) {
    const eligibleUnits = Array.from(gameState.units.values()).filter(
      (u) => u.side === gameState.currentSide && canReceiveReplacement(gameState, u)
    );
    content = (
      <div className={styles.context}>
        <div className={styles.unitRow}>
          {eligibleUnits.map((u) => {
            const cost = replacementCostFor(u);
            const country = replacementProductionCountry(gameState.scenarioId, u);
            const pp = gameState.factionCards[u.side]?.productionPoints?.[country];
            const ppOk = pp === null || (pp !== undefined && pp >= cost);
            const ppText = pp === null ? "∞" : String(pp ?? 0);
            const desc = u.type === UnitType.AIR
              ? `-2 sortite, ora ${u.sorties ?? 0}`
              : `${cost}PP ${country} | disp. ${ppText}`;
            return (
              <button
                key={u.id}
                type="button"
                className={`${styles.unitEntryBtn} ${!ppOk ? styles.unitEntryDisabled : ""}`}
                disabled={!ppOk}
                onClick={() => applyReplacementAction(u.id)}
                title={ppOk ? `Rimpiazza ${u.name}` : `PP insufficienti: servono ${cost}, disponibili ${ppText}`}
              >
                <UnitCounter unit={u} size={54} />
                <span className={styles.unitInfo}>
                  {desc}
                </span>
              </button>
            );
          })}
          {eligibleUnits.length === 0 && <span className={styles.none}>Nessuna unità eleggibile</span>}
        </div>
      </div>
    );
  } else if (phase === GamePhase.MOBILIZATION) {
    const card = gameState.factionCards[gameState.currentSide];
    const mobilizableUnits = card.mobilizationBox
      .map((id) => gameState.units.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u));
    content = (
      <div className={styles.context}>
        <div className={styles.unitRow}>
          {mobilizableUnits.map((u) => {
            const isFree = Boolean(u.freeMobilization);
            const cost = isFree ? 0 : mobilizationCostFor(u);
            const country = productionCountryFor(u);
            const pp = gameState.factionCards[u.side]?.productionPoints?.[country];
            const ppOk = isFree || pp === null || (pp !== undefined && pp >= cost);
            const ppText = pp === null ? "∞" : String(pp ?? 0);
            const isPlacing = mobilizingUnitId === u.id;
            const otherPlacing = Boolean(mobilizingUnitId && !isPlacing);
            return (
              <button
                key={u.id}
                type="button"
                className={`${styles.unitEntryBtn} ${isPlacing ? styles.unitEntryActive : ""} ${(!ppOk || otherPlacing) ? styles.unitEntryDisabled : ""}`}
                disabled={!ppOk || otherPlacing}
                onClick={() => startMobilizingUnit(u.id)}
                title={!ppOk ? `PP insufficienti: servono ${cost}, disponibili ${ppText}` : isPlacing ? "Seleziona una città sulla mappa" : `Mobilizza ${u.name}`}
              >
                <UnitCounter unit={u} size={54} />
                <span className={styles.unitInfo}>
                  {isFree ? "GRATIS" : `${cost}PP ${country}`}
                  {!isFree && <em>disp. {ppText}</em>}
                </span>
              </button>
            );
          })}
          {mobilizableUnits.length === 0 && <span className={styles.none}>Nessuna unità da mobilizzare</span>}
        </div>
      </div>
    );
  } else {
    content = <div className={styles.context} />;
  }

  const economyBox = (
    <>
      {([Side.AXIS, Side.ALLIED] as const).map((side) => {
        const card = gameState.factionCards[side];
        const visibleCountries = Object.entries(card.productionPoints).filter(([country, pp]) => {
          const nw = card.nationalWill[country];
          return pp !== null || nw !== null;
        });
        if (visibleCountries.length === 0) return null;
        return (
          <div key={side} className={`${styles.economyBox} ${side === Side.AXIS ? styles.economyBoxAxis : styles.economyBoxAllied}`}>
            <span className={styles.economyBoxTitle}>{side === Side.AXIS ? "ASSE" : "ALL."}</span>
            <div className={styles.economyGrid}>
              {visibleCountries.map(([country, pp]) => {
                const nw = card.nationalWill[country];
                const conquered = card.countryStatus?.[country] === "conquered";
                return (
                  <div
                    key={country}
                    className={`${styles.countryBox} ${conquered ? styles.countryBoxConquered : ""}`}
                    style={countryFlagStyle(country)}
                    title={`${country}: PP ${pp ?? "NA"} | WILL ${nw ?? "NA"}`}
                  >
                    <span className={styles.countryBoxName}>{countryFlagCode(country)}</span>
                    {conquered
                      ? <span className={styles.conquered}>CONQ.</span>
                      : <>
                          <span className={styles.countryBoxStat}>{pp ?? "NA"}<em>PP</em></span>
                          <span className={styles.countryBoxStat}>{nw ?? "NA"}<em>WILL</em></span>
                        </>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );

  return (
    <div className={styles.bar}>
      {weatherBox}
      <div className={styles.divider} />
      {economyBox}
      <div className={styles.divider} />
      {content}
    </div>
  );
};
