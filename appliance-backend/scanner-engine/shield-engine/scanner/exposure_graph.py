from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Set


@dataclass
class Edge:
    source: str
    target: str
    relationship: str  # e.g. assume_role, instance_profile, bucket_access


class ExposureGraph:
    """Simple in-memory exposure graph for lateral movement analysis."""

    def __init__(self) -> None:
        self._adj: Dict[str, List[Edge]] = {}

    def add_edge(self, source: str, target: str, relationship: str) -> None:
        self._adj.setdefault(source, []).append(Edge(source, target, relationship))

    def neighbors(self, node: str) -> List[Edge]:
        return self._adj.get(node, [])

    def get_reachable(self, start: str, max_depth: int = 4) -> Set[str]:
        """Return nodes reachable from `start` within max_depth hops."""
        seen: Set[str] = set()
        frontier: List[tuple[str, int]] = [(start, 0)]
        while frontier:
            node, depth = frontier.pop()
            if node in seen or depth > max_depth:
                continue
            seen.add(node)
            for edge in self._adj.get(node, []):
                if edge.target not in seen:
                    frontier.append((edge.target, depth + 1))
        return seen

