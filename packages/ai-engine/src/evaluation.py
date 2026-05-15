"""
Funzione di Valutazione per il Minimax
Valuta la bontà di una posizione di gioco
"""

from typing import Dict, Any
from dataclasses import dataclass


@dataclass
class EvaluationWeights:
    """Pesi per i diversi fattori di valutazione"""
    territorial_control: float = 0.30
    unit_strength: float = 0.25
    supply_lines: float = 0.20
    morale: float = 0.15
    casualties_ratio: float = 0.10


class EvaluationFunction:
    """
    Funzione di valutazione per posizioni di gioco
    Ritorna un score in cui valori positivi favoriscono gli Alleati
    """

    def __init__(self, weights: EvaluationWeights = EvaluationWeights()):
        self.weights = weights

    def evaluate(self, game_state: Dict[str, Any]) -> float:
        """
        Valuta una posizione di gioco
        
        Score > 0: Vantaggio Alleati
        Score < 0: Vantaggio Asse
        Score = 0: Posizione equilibrata
        """
        score = 0.0

        # 1. Controllo territoriale (30%)
        territorial = self._evaluate_territorial_control(game_state)
        score += territorial * self.weights.territorial_control

        # 2. Forza unità (25%)
        strength = self._evaluate_unit_strength(game_state)
        score += strength * self.weights.unit_strength

        # 3. Linee di rifornimento (20%)
        supply = self._evaluate_supply_lines(game_state)
        score += supply * self.weights.supply_lines

        # 4. Morale (15%)
        morale = self._evaluate_morale(game_state)
        score += morale * self.weights.morale

        # 5. Rapporto perdite (10%)
        casualties = self._evaluate_casualties_ratio(game_state)
        score += casualties * self.weights.casualties_ratio

        return score

    def _evaluate_territorial_control(self, game_state: Dict[str, Any]) -> float:
        """
        Valuta il controllo territoriale
        Positivo per Alleati, negativo per Asse
        """
        # TODO: Contare hex controllate da ogni lato tramite ZOC
        # Utilizzare map_state per valutare influenza
        return 0.0

    def _evaluate_unit_strength(self, game_state: Dict[str, Any]) -> float:
        """
        Valuta la forza totale delle unità
        """
        allied_strength = 0.0
        axis_strength = 0.0

        units = game_state.get("units", {})

        for unit in units.values():
            side = unit.get("side", "")
            strength = unit.get("strength", 0)
            max_strength = unit.get("maxStrength", 1)

            # Normalizza per forza massima
            relative_strength = strength / max_strength if max_strength > 0 else 0

            if side == "allied":
                allied_strength += relative_strength
            elif side == "axis":
                axis_strength += relative_strength

        # Differenza normalizzata (scale -10 to +10)
        if allied_strength + axis_strength > 0:
            ratio = (allied_strength - axis_strength) / (allied_strength + axis_strength)
            return ratio * 10
        return 0.0

    def _evaluate_supply_lines(self, game_state: Dict[str, Any]) -> float:
        """
        Valuta integrità e efficienza delle linee di rifornimento
        """
        # TODO: Analizzare connected components per rifornimenti
        # Penalizzare unità isolate
        return 0.0

    def _evaluate_morale(self, game_state: Dict[str, Any]) -> float:
        """
        Valuta il morale medio delle unità
        """
        allied_morale_sum = 0.0
        axis_morale_sum = 0.0
        allied_count = 0
        axis_count = 0

        units = game_state.get("units", {})

        for unit in units.values():
            side = unit.get("side", "")
            morale = unit.get("morale", 5)  # Default 5/10

            if side == "allied":
                allied_morale_sum += morale
                allied_count += 1
            elif side == "axis":
                axis_morale_sum += morale
                axis_count += 1

        # Calcola media e differenza (scale -10 to +10)
        allied_avg = allied_morale_sum / allied_count if allied_count > 0 else 5
        axis_avg = axis_morale_sum / axis_count if axis_count > 0 else 5

        # Normalizza a -10, +10 dove 5 è neutrale
        return ((allied_avg - 5) - (axis_avg - 5)) * 2

    def _evaluate_casualties_ratio(self, game_state: Dict[str, Any]) -> float:
        """
        Valuta il rapporto perdite (vantaggio per chi ha perdite minori)
        """
        # TODO: Tracciare perdite cumulative nel history
        # Favorire il lato con perdite percentuali inferiori
        return 0.0
