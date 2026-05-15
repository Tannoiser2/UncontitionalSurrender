"""
USWC Digital AI Engine
Minimax with Alpha-Beta Pruning for tactical decision making
"""

from .minimax_engine import MinimaxEngine
from .evaluation import EvaluationFunction

__version__ = "0.1.0"
__all__ = ["MinimaxEngine", "EvaluationFunction"]
