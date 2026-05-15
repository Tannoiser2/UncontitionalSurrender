"""
Minimax Engine with Alpha-Beta Pruning
Motore decisionale per l'IA tattica del wargame
"""

from typing import Optional, Tuple, List, Dict, Any
from dataclasses import dataclass
import time


@dataclass
class MoveScore:
    """Rappresenta una mossa con score minimax"""
    move: Dict[str, Any]
    score: float
    depth: int


class MinimaxEngine:
    """
    Engine Minimax con Alpha-Beta Pruning per USWC Digital
    
    Caratteristiche:
    - Alpha-Beta pruning per ridurre nodi esplorati
    - Transposition table per caching
    - Iterative deepening per timeout
    - Time management
    """

    def __init__(
        self,
        evaluation_fn,
        max_depth: int = 5,
        timeout_ms: int = 3000,
        use_alpha_beta: bool = True,
        use_transposition_table: bool = True
    ):
        self.evaluation_fn = evaluation_fn
        self.max_depth = max_depth
        self.timeout_ms = timeout_ms
        self.use_alpha_beta = use_alpha_beta
        self.use_transposition_table = use_transposition_table
        
        self.transposition_table: Dict[str, Tuple[float, int]] = {}
        self.nodes_explored = 0
        self.start_time = 0.0

    def find_best_move(self, game_state: Dict[str, Any], side: str) -> Optional[MoveScore]:
        """
        Trova la migliore mossa usando Minimax
        
        Args:
            game_state: Stato corrente del gioco
            side: "axis" o "allied"
            
        Returns:
            MoveScore con la mossa migliore
        """
        self.nodes_explored = 0
        self.start_time = time.time()
        self.transposition_table.clear()
        
        # Iterative deepening: prova profondità crescenti
        best_move = None
        for depth in range(1, self.max_depth + 1):
            try:
                move = self._iterative_deepening_step(game_state, side, depth)
                if move is not None:
                    best_move = move
                    
                # Verifica timeout
                elapsed_ms = (time.time() - self.start_time) * 1000
                if elapsed_ms > self.timeout_ms:
                    break
                    
            except TimeoutError:
                break
        
        return best_move

    def _iterative_deepening_step(
        self,
        game_state: Dict[str, Any],
        side: str,
        depth: int
    ) -> Optional[MoveScore]:
        """
        Un singolo passo di iterative deepening
        """
        alpha = float('-inf')
        beta = float('inf')
        
        moves = self._generate_moves(game_state, side)
        if not moves:
            return None
        
        best_score = float('-inf')
        best_move_obj = None
        
        for move in moves:
            new_state = self._apply_move(game_state, move)
            
            # Minimax ricorsivo
            score = self._minimax(
                new_state,
                depth - 1,
                alpha,
                beta,
                is_maximizing=False  # Dopo il nostro turno, turno dell'avversario
            )
            
            if score > best_score:
                best_score = score
                best_move_obj = MoveScore(move=move, score=best_score, depth=depth)
            
            alpha = max(alpha, best_score)
        
        return best_move_obj

    def _minimax(
        self,
        game_state: Dict[str, Any],
        depth: int,
        alpha: float,
        beta: float,
        is_maximizing: bool
    ) -> float:
        """
        Algoritmo Minimax con Alpha-Beta Pruning
        """
        # Verifica timeout
        elapsed_ms = (time.time() - self.start_time) * 1000
        if elapsed_ms > self.timeout_ms:
            raise TimeoutError("Minimax timeout reached")
        
        self.nodes_explored += 1
        
        # Transposition table lookup
        state_key = self._hash_state(game_state)
        if self.use_transposition_table and state_key in self.transposition_table:
            cached_score, cached_depth = self.transposition_table[state_key]
            if cached_depth >= depth:
                return cached_score
        
        # Condizioni di terminazione
        if depth == 0 or self._is_terminal(game_state):
            return self.evaluation_fn.evaluate(game_state)
        
        if is_maximizing:
            max_eval = float('-inf')
            moves = self._generate_moves(game_state, "allied")
            
            for move in moves:
                new_state = self._apply_move(game_state, move)
                eval_score = self._minimax(
                    new_state, depth - 1, alpha, beta, False
                )
                max_eval = max(max_eval, eval_score)
                alpha = max(alpha, eval_score)
                
                if beta <= alpha:
                    break  # Beta cutoff
            
            # Cache risultato
            if self.use_transposition_table:
                self.transposition_table[state_key] = (max_eval, depth)
            
            return max_eval
        else:
            min_eval = float('inf')
            moves = self._generate_moves(game_state, "axis")
            
            for move in moves:
                new_state = self._apply_move(game_state, move)
                eval_score = self._minimax(
                    new_state, depth - 1, alpha, beta, True
                )
                min_eval = min(min_eval, eval_score)
                beta = min(beta, eval_score)
                
                if beta <= alpha:
                    break  # Alpha cutoff
            
            # Cache risultato
            if self.use_transposition_table:
                self.transposition_table[state_key] = (min_eval, depth)
            
            return min_eval

    # ============ STUB METHODS ============
    # Questi devono essere implementati con la logica specifica del gioco

    def _generate_moves(self, game_state: Dict[str, Any], side: str) -> List[Dict]:
        """Genera tutte le mosse legali per il lato dato"""
        # TODO: Implementare basato su regole USWC
        return []

    def _apply_move(self, game_state: Dict[str, Any], move: Dict) -> Dict[str, Any]:
        """Applica una mossa e ritorna il nuovo stato"""
        # TODO: Implementare basato su regole USWC
        return game_state

    def _is_terminal(self, game_state: Dict[str, Any]) -> bool:
        """Controlla se lo stato è terminale (fine gioco)"""
        # TODO: Implementare basato su condizioni di vittoria
        return False

    def _hash_state(self, game_state: Dict[str, Any]) -> str:
        """Hash dello stato per transposition table"""
        # TODO: Implementare hashing efficiente dello stato
        return str(hash(str(game_state)))
