import React from "react";
import { useGameStore } from "../store/gameStore";
import { GamePhase, GameSubPhase, getEligibleAirSupporters, getEligibleCombatEventMarkers, hexCodeForMap, scenarioById, Side } from "@uswc/shared";

const actionIcon = (key: "advance" | "stay" | "passDefender" | "passResolve" | "cancel" | "finish" | "rebase" | "airAttack" | "naval" | "amphibious") => {
  const icons = {
    advance: "/actions/Avanza.png",
    stay: "/actions/Resta.png",
    passDefender: "/actions/Passa_difensore.png",
    passResolve: "/actions/Passa_risolvi.png",
    cancel: "/actions/Annulla.png",
    finish: "/actions/Fine_attivazione.png",
    rebase: "/actions/Rebase.png",
    airAttack: "/actions/air-attack.png",
    naval: "/actions/naval-transport.png",
    amphibious: "/actions/amphibious-invasion.png"
  };
  return icons[key];
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
  if (n.includes("partisans")) return "/event-icons/Partisans.png";
  if (n.includes("surprise")) return "/event-icons/Surprise_attack.png";
  if (n.includes("snafu")) return "/event-icons/SNAFU.png";
  if (n.includes("strategic")) return "/event-icons/Strategic_move.png";
  if (n.includes("rasputitsa")) return "/event-icons/Rasputitsa.png";
  if (n.includes("counterattack")) return "/event-icons/Contrattacco.png";
  return undefined;
};

const sideIcon = (side?: Side) => side === Side.ALLIED ? "/actions/allied-turn.png" : "/actions/axis-turn.png";

/**
 * Banner sopra il board che descrive la modalità corrente del giocatore
 * (retreat, advance, commit air, mobilization placing) con un Cancel.
 * Si auto-nasconde quando non c'è alcuna azione richiesta.
 */
export const ActionBanner: React.FC = () => {
  const gameState = useGameStore((s) => s.gameState);
  const mobilizingUnitId = useGameStore((s) => s.mobilizingUnitId);
  const amphibiousMode = useGameStore((s) => s.amphibiousMode);
  const toggleAmphibiousMode = useGameStore((s) => s.toggleAmphibiousMode);
  const airActionMode = useGameStore((s) => s.airActionMode);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const validMoves = useGameStore((s) => s.validMoves);
  const mapEventPlacement = useGameStore((s) => s.mapEventPlacement);
  const cancelMobilizing = useGameStore((s) => s.cancelMobilizing);
  const cancelMapEventPlacement = useGameStore((s) => s.cancelMapEventPlacement);
  const setAirActionMode = useGameStore((s) => s.setAirActionMode);
  const chooseAdvance = useGameStore((s) => s.chooseAdvance);
  const chooseDefenderCannotRetreat = useGameStore((s) => s.chooseDefenderCannotRetreat);
  const cancelPendingCombat = useGameStore((s) => s.cancelPendingCombat);
  const chooseAirCommit = useGameStore((s) => s.chooseAirCommit);
  const chooseEventCommit = useGameStore((s) => s.chooseEventCommit);
  const resetSelection = useGameStore((s) => s.resetSelection);

  if (!gameState) return null;

  const pending = gameState.pendingCombat;
  const currentMapId = scenarioById(gameState.scenarioId).mapId;

  // Priority: retreat > advance > commit > event placement > mobilization > airAction
  if (pending?.kind === "retreat") {
    return (
      <Banner color="#dc2626">
        <span>Ritirata difensore: scegli uno dei {pending.options.length} esagoni evidenziati.</span>
        {pending.allowDefenderCannotRetreat ? (
          <button style={btnStyle("#7f1d1d")} onClick={chooseDefenderCannotRetreat}>
            Applica DCR
          </button>
        ) : null}
      </Banner>
    );
  }

  if (pending?.kind === "advance") {
    const advanceAttackers = (pending.advanceAttackerIds || [pending.attackerId])
      .map((id) => gameState.units.get(id))
      .filter(Boolean);
    return (
      <Banner color="#2563eb">
        <span>Avanzata dopo il combattimento?</span>
        {advanceAttackers.length > 1 ? (
          advanceAttackers.map((unit) => (
            <IconButton key={unit!.id} icon={actionIcon("advance")} label={`Avanza con ${unit!.name}`} onClick={() => chooseAdvance(true, unit!.id)} />
          ))
        ) : (
          <IconButton icon={pending.forceAdvance ? actionIcon("amphibious") : actionIcon("advance")} label={pending.forceAdvance ? "Sbarca" : "Avanza"} onClick={() => chooseAdvance(true, pending.attackerId)} />
        )}
        {!pending.forceAdvance && <IconButton icon={actionIcon("stay")} label="Resta" onClick={() => chooseAdvance(false)} />}
      </Banner>
    );
  }

  if (pending?.kind === "commit") {
    const committingSide = pending.stage === "attacker"
      ? gameState.units.get(pending.attackerId)?.side
      : gameState.units.get(pending.defenderId)?.side;
    const committedAirId = pending.stage === "attacker" ? pending.airSupportAttackerId : pending.airSupportDefenderId;
    const eligible = committingSide
      ? getEligibleAirSupporters(gameState, pending.attackerId, pending.defenderId, pending.additionalAttackerIds, committingSide)
        .filter((unit) => !committedAirId || unit.id === committedAirId)
      : [];
    const committedEvents = committingSide === gameState.units.get(pending.attackerId)?.side
      ? pending.eventMarkerAttackerIds || []
      : pending.eventMarkerDefenderIds || [];
    const eligibleEvents = committingSide
      ? getEligibleCombatEventMarkers(gameState, pending.attackerId, pending.defenderId, pending.additionalAttackerIds, committingSide, committedEvents)
      : [];
    return (
      <Banner color="#0ea5e9">
        <SideChip side={committingSide} />
        {eligible.map((u) => (
          <IconButton
            key={u.id}
            icon="/actions/air-support.png"
            label={committedAirId === u.id ? `Supporto aereo: ${u.name}` : u.name}
            onClick={() => chooseAirCommit(u.id)}
            active={committedAirId === u.id}
            title={`${u.name} @${hexCodeForMap(u.position, currentMapId)} sortie ${u.sorties || 0}/6`}
          />
        ))}
        {eligibleEvents.map((event) => (
          <IconButton key={event.id} icon={eventIcon(event.id)} label={event.id} onClick={() => chooseEventCommit(event.id)} />
        ))}
        {committedEvents.length > 0 && <span>Eventi: {committedEvents.join(", ")}</span>}
        <IconButton icon={pending.stage === "attacker" ? actionIcon("passDefender") : actionIcon("passResolve")} label={pending.stage === "attacker" ? "Passa al difensore" : "Passa e risolvi"} onClick={() => chooseAirCommit(null)} />
        <IconButton icon={actionIcon("cancel")} label={pending.isAmphibious ? "Annulla invasione" : "Annulla combattimento"} onClick={cancelPendingCombat} danger />
      </Banner>
    );
  }

  if (mapEventPlacement) {
    const name = mapEventPlacement.markerId;
    if (mapEventPlacement.mode === "strategic-move") {
      return (
        <Banner color="#2563eb">
          <IconImage src={eventIcon(name)} alt={name} />
          <span>
            Strategic Move: {selectedUnit
              ? <>muovi <strong>{selectedUnit.name}</strong> verso uno degli esagoni evidenziati ({validMoves.length} destinazioni), oppure clicca un'altra unita eleggibile per cambiarla.</>
              : `scegli una unita eleggibile sulla mappa (${validMoves.length} unita eleggibili).`}
          </span>
          <IconButton icon={actionIcon("cancel")} label="Annulla" onClick={cancelMapEventPlacement} />
        </Banner>
      );
    }
    return (
      <Banner color="#2563eb">
        <IconImage src={eventIcon(name)} alt={name} />
        <span>Piazza {name}: scegli uno degli esagoni evidenziati.</span>
        <IconButton icon={actionIcon("cancel")} label="Annulla" onClick={cancelMapEventPlacement} />
      </Banner>
    );
  }

  if (mobilizingUnitId) {
    const unit = gameState.units.get(mobilizingUnitId);
    return (
      <Banner color="#facc15" textColor="#1f2937">
        <span>Piazza <strong>{unit?.name}</strong>: scegli una citta evidenziata.</span>
        <IconButton icon={actionIcon("cancel")} label="Annulla" onClick={cancelMobilizing} />
      </Banner>
    );
  }

  if (airActionMode === "rebase") {
    return (
      <Banner color="#0ea5e9">
        <IconImage src={actionIcon("rebase")} alt="Riposizionamento aereo" />
        <span>{selectedUnit ? <><strong>{selectedUnit.name}</strong> — riposizionamento aereo: scegli un esagono evidenziato ({validMoves.length} destinazioni).</> : `Riposizionamento aereo: scegli un esagono evidenziato (${validMoves.length} destinazioni).`}</span>
        <IconButton icon={actionIcon("cancel")} label="Annulla" onClick={() => setAirActionMode(null)} />
      </Banner>
    );
  }

  if (airActionMode === "naval") {
    return (
      <Banner color="#0ea5e9">
        <IconImage src={actionIcon("naval")} alt="Trasporto Navale" />
        <span>{selectedUnit ? <><strong>{selectedUnit.name}</strong> — Trasporto Navale: scegli un porto amico evidenziato ({validMoves.length} destinazioni).</> : `Trasporto Navale: scegli un porto amico evidenziato (${validMoves.length} destinazioni).`}</span>
        <IconButton icon={actionIcon("cancel")} label="Annulla" onClick={() => setAirActionMode(null)} />
      </Banner>
    );
  }

  if (airActionMode === "strike") {
    return (
      <Banner color="#dc2626">
        <IconImage src={actionIcon("airAttack")} alt="Attacco aereo" />
        <span>Attacco aereo: scegli un'unita aerea nemica evidenziata entro 7 esagoni.</span>
        <IconButton icon={actionIcon("cancel")} label="Annulla" onClick={() => setAirActionMode(null)} />
      </Banner>
    );
  }

  if (amphibiousMode) {
    return (
      <Banner color="#0e7490">
        <IconImage src={actionIcon("amphibious")} alt="Invasione Anfibia" />
        <span>Invasione Anfibia: scegli un esagono costiero evidenziato ({validMoves.length} opzioni).</span>
        <IconButton icon={actionIcon("cancel")} label="Annulla" onClick={toggleAmphibiousMode} />
      </Banner>
    );
  }

  const isMapBoxUnit = selectedUnit && (
    selectedUnit.mapPresence === "west_med" ||
    selectedUnit.mapPresence === "central_med" ||
    selectedUnit.mapPresence === "east_na"
  );
  if (isMapBoxUnit && validMoves.length > 0) {
    const boxLabel = selectedUnit.mapPresence === "west_med"
      ? "Western Med Box"
      : selectedUnit.mapPresence === "central_med"
        ? "Central Med Box"
        : "Eastern North America Box";
    return (
      <Banner color="#0e7490">
        <span><strong>{selectedUnit.name}</strong> ({boxLabel}): clicca uno degli esagoni evidenziati per Invasione Anfibia ({validMoves.length} opzioni).</span>
        <IconButton icon={actionIcon("cancel")} label="Annulla" onClick={resetSelection} />
      </Banner>
    );
  }

  if (gameState.victory) {
    const colors: Record<string, string> = { axis: "#7f1d1d", allied: "#1e3a8a", draw: "#374151" };
    return (
      <Banner color={colors[gameState.victory.winner] || "#374151"}>
        <span>{gameState.victory.winner.toUpperCase()} VICTORY - {gameState.victory.reason}</span>
      </Banner>
    );
  }

  // Phase-based Strategic Movement (no event card): show an instruction banner.
  if (gameState.phase === GamePhase.STRATEGIC_MOVEMENT && selectedUnit && selectedUnit.type !== "air") {
    return (
      <Banner color="#2563eb">
        <span>
          Movimento Strategico: muovi <strong>{selectedUnit.name}</strong> verso uno degli esagoni evidenziati ({validMoves.length} destinazioni), oppure clicca un'altra unita eleggibile.
        </span>
      </Banner>
    );
  }

  if (gameState.phase === GamePhase.STRATEGIC_MOVEMENT && (!selectedUnit || selectedUnit.type === "air")) {
    return (
      <Banner color="#1d4ed8">
        <span style={{ opacity: 0.9 }}>
          Movimento Strategico: clicca un'unita di terra eleggibile (Rifornimento pieno + ferrovia) per evidenziarne le destinazioni, oppure clicca Fine Fase per proseguire.
        </span>
      </Banner>
    );
  }

  // Stato di default: nessuna azione pendente. Mostriamo un placeholder con info sintetiche
  // così l'header mantiene sempre la stessa altezza (no "salto" della mappa).
  const phaseLabel = phaseLabelFor(gameState.phase, gameState.subPhase);
  const selectedAirBeforeActions =
    selectedUnit?.type === "air" &&
    gameState.phase === GamePhase.OPERATIONS &&
    gameState.subPhase !== GameSubPhase.ACTIONS;
  return (
    <Banner color="#1f2937">
      <span style={{ opacity: 0.85 }}>
        {selectedAirBeforeActions
          ? "Unita aerea selezionata: il riposizionamento aereo sara disponibile nella sottofase Azioni."
          : `${phaseLabel} - ${gameState.currentSide === "axis" ? "tocca all'Asse" : "toccano agli Alleati"}`}
      </span>
    </Banner>
  );
};

const phaseLabelFor = (phase: string, subPhase: string): string => {
  if (phase === "weather") return "Fase Meteo";
  if (phase === "economy") return "Fase Economia";
  if (phase === "strategic_movement") return "Movimento Strategico";
  if (phase === "operations" && subPhase === "actions") return "Operazioni: Azioni";
  if (phase === "operations" && subPhase === "supply_check") return "Operazioni: Rifornimento";
  if (phase === "no_supply") return "Fase No Supply";
  if (phase === "replacements") return "Rimpiazzi (8.1)";
  if (phase === "mobilization") return "Mobilitazione (8.2)";
  if (phase === "victory_check") return "Controllo Vittoria";
  if (phase === "end_turn") return "Fine Turno";
  return phase;
};

const Banner: React.FC<{ color: string; textColor?: string; children: React.ReactNode }> = ({ color, textColor = "#fef3c7", children }) => (
  <div style={{
    background: color,
    color: textColor,
    padding: "0.35rem 0.6rem",
    borderRadius: 4,
    border: "1px solid rgba(0,0,0,0.45)",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: 600,
    fontSize: "0.84rem"
  }}>
    {children}
  </div>
);

const IconImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => src ? (
  <img
    src={src}
    alt={alt}
    style={{ width: 42, height: 42, objectFit: "contain", flex: "0 0 auto", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.45))" }}
  />
) : null;

const SideChip: React.FC<{ side?: Side }> = ({ side }) => (
  <img
    src={sideIcon(side)}
    alt={side === Side.ALLIED ? "Alleati" : "Asse"}
    title={side === Side.ALLIED ? "Alleati" : "Asse"}
    style={{ width: 86, height: 43, objectFit: "contain", flex: "0 0 auto", marginRight: 8 }}
  />
);

const IconButton: React.FC<{
  icon?: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  title?: string;
}> = ({ icon, label, onClick, active, danger, title }) => (
  <button
    type="button"
    title={title ?? label}
    aria-label={label}
    onClick={onClick}
    style={{
      ...btnStyle(danger ? "#7f1d1d" : active ? "#166534" : "#374151"),
      width: 52,
      height: 52,
      padding: 3,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center"
    }}
  >
    {icon ? <img src={icon} alt="" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : label}
  </button>
);

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg,
  color: "#fef3c7",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 4,
  padding: "0.25rem 0.6rem",
  fontWeight: 700,
  cursor: "pointer"
});
