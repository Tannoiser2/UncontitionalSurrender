import React from "react";
import { useGameStore } from "../store/gameStore";
import { amphibiousTargetsFor, canNavalTransport, GamePhase, GameSubPhase, sequenceStepLabel, Side } from "@uswc/shared";

/**
 * Toolbar contestuale sotto il phase header con i bottoni applicabili
 * alla situazione corrente (selected unit, fase, modalità).
 */
export const PhaseToolbar: React.FC = () => {
  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const attackMode = useGameStore((s) => s.attackMode);
  const setAttackMode = useGameStore((s) => s.setAttackMode);
  const airActionMode = useGameStore((s) => s.airActionMode);
  const setAirActionMode = useGameStore((s) => s.setAirActionMode);
  const amphibiousMode = useGameStore((s) => s.amphibiousMode);
  const toggleAmphibiousMode = useGameStore((s) => s.toggleAmphibiousMode);
  const endSelectedActivation = useGameStore((s) => s.endSelectedActivation);
  const resolvePendingAssaults = useGameStore((s) => s.resolvePendingAssaults);
  const advanceGameSequence = useGameStore((s) => s.advanceGameSequence);

  if (!gameState) return null;

  const inActions = gameState.phase === GamePhase.OPERATIONS && gameState.subPhase === GameSubPhase.ACTIONS;
  const isGroundSelected = selectedUnit && selectedUnit.type !== "air" && selectedUnit.type !== "fort";
  const isAirSelected = selectedUnit && selectedUnit.type === "air";
  const weatherForcesAssault = gameState.weather === "poor" || gameState.weather === "severe";
  const hasPendingAssaults = Array.from(gameState.units.values()).some(
    (u) => u.assaultTarget && u.side === gameState.currentSide
  );
  const blockedByPending = Boolean(gameState.pendingCombat);
  const blockedByPendingAssault = inActions && hasPendingAssaults && !blockedByPending;

  const buttons: React.ReactNode[] = [];

  if (inActions && isGroundSelected) {
    buttons.push(
      <ToolbarButton
        key="mobile"
        active={attackMode === "mobile" && !weatherForcesAssault}
        disabled={weatherForcesAssault || selectedUnit!.hasMobileAttacked || blockedByPending}
        onClick={() => setAttackMode("mobile")}
        title={weatherForcesAssault ? "Meteo cattivo/estremo: solo Assault" : selectedUnit!.hasMobileAttacked ? "Mobile gia usato in questa attivazione" : "Modalita Mobile attack"}
      >
        Mobile
      </ToolbarButton>
    );
    buttons.push(
      <ToolbarButton
        key="assault"
        active={attackMode === "assault" || weatherForcesAssault}
        disabled={selectedUnit!.hasMobileAttacked || blockedByPending}
        onClick={() => setAttackMode("assault")}
        title={selectedUnit!.hasMobileAttacked ? "Non puoi fare Assault dopo Mobile" : "Designa Assault contro un nemico adiacente"}
      >
        Assault
      </ToolbarButton>
    );

    // 6.3.2 Amphibious Invasion: per unità Allied ground in port amico O Western Med Box
    const inPort = selectedUnit && selectedUnit.side === Side.ALLIED && (
      selectedUnit.mapPresence === "west_med" ||
      selectedUnit.mapPresence === "central_med" ||
      selectedUnit.mapPresence === "east_na" ||
      Boolean(gameState.map.get(`${selectedUnit.position.q},${selectedUnit.position.r}`)?.features.port)
    );
    if (inPort) {
      const targets = amphibiousTargetsFor(gameState, selectedUnit!);
      const noTargets = targets.length === 0;
      const reason = noTargets
        ? "Nessun bersaglio valido: controlla meteo, box/porto di partenza e marker Surprise Attack se richiesto"
        : "Lancia un'Invasione Anfibia su un esagono costiero valido";
      buttons.push(
        <ToolbarButton
          key="amphibious"
          active={amphibiousMode}
          disabled={blockedByPending || noTargets}
          onClick={toggleAmphibiousMode}
          title={reason}
        >
          Invasione Anfibia
        </ToolbarButton>
      );
    }
  }

  if (inActions && selectedUnit && canNavalTransport(gameState, selectedUnit)) {
    buttons.push(
      <ToolbarButton
        key="naval"
        active={airActionMode === "naval"}
        disabled={blockedByPending}
        onClick={() => setAirActionMode(airActionMode === "naval" ? null : "naval")}
        title="Trasporto Navale verso un porto amico valido"
      >
        Trasporto Navale
      </ToolbarButton>
    );
  }

  if (inActions && isAirSelected) {
    buttons.push(
      <ToolbarButton
        key="rebase"
        active={airActionMode === "rebase"}
        disabled={blockedByPending}
        onClick={() => setAirActionMode(airActionMode === "rebase" ? null : "rebase")}
        title="Riposiziona l'unita aerea in un esagono valido (+1 sortita)"
      >
        Riposiziona Aereo
      </ToolbarButton>
    );
    buttons.push(
      <ToolbarButton
        key="strike"
        active={airActionMode === "strike"}
        disabled={blockedByPending}
        onClick={() => setAirActionMode(airActionMode === "strike" ? null : "strike")}
        title="Attacca un'unita aerea nemica entro 7 esagoni"
      >
        Attacco Aereo
      </ToolbarButton>
    );
  }

  if (gameState.phase === GamePhase.STRATEGIC_MOVEMENT && isAirSelected) {
    buttons.push(
      <ToolbarButton
        key="rebase-disabled"
        disabled
        onClick={() => undefined}
        title="Il riposizionamento aereo e disponibile nella fase Operazioni: Azioni, non nel Movimento Strategico"
      >
        Riposiziona in Operazioni
      </ToolbarButton>
    );
  }

  if (inActions && selectedUnit && !blockedByPending) {
    buttons.push(
      <ToolbarButton key="end" onClick={endSelectedActivation} title="Termina l'attivazione dell'unita selezionata">
        Fine Attivazione
      </ToolbarButton>
    );
  }

  if (inActions && hasPendingAssaults && !blockedByPending) {
    buttons.push(
      <ToolbarButton key="resolveAssaults" emphasis onClick={resolvePendingAssaults} title="Risolvi un Assault designato">
        Risolvi Assault
      </ToolbarButton>
    );
  }

  // Next Step sempre presente
  buttons.push(
    <ToolbarButton
      key="next"
      primary
      disabled={blockedByPending || blockedByPendingAssault}
      onClick={advanceGameSequence}
      title={
        blockedByPending
            ? "Risolvi prima la decisione corrente"
          : blockedByPendingAssault
            ? "Risolvi prima gli Assault designati"
            : "Avanza nella sequenza"
      }
    >
      {sequenceStepLabel(gameState)}
    </ToolbarButton>
  );

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "0.35rem",
      alignItems: "center"
    }}>
      {buttons}
    </div>
  );
};

interface ToolbarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
  emphasis?: boolean;
  title?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ children, onClick, disabled, active, primary, emphasis, title }) => {
  const baseColor = primary ? "#1d4ed8" : emphasis ? "#b45309" : "#374151";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: active ? "#16a34a" : baseColor,
        color: "#fef3c7",
        border: active ? "2px solid #fde68a" : "1px solid rgba(255,255,255,0.2)",
        borderRadius: 4,
        padding: "0.32rem 0.65rem",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: "0.8em"
      }}
    >
      {children}
    </button>
  );
};
