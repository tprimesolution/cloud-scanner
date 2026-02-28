"""In-memory metrics for scan execution and worker activity."""

from __future__ import annotations

import threading
from dataclasses import dataclass


@dataclass
class _State:
    total_rules_executed: int = 0
    failed_rules_count: int = 0
    cumulative_rule_execution_time_seconds: float = 0.0
    active_workers: int = 0


class EngineMetrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state = _State()

    def inc_active_workers(self) -> None:
        with self._lock:
            self._state.active_workers += 1

    def dec_active_workers(self) -> None:
        with self._lock:
            self._state.active_workers = max(0, self._state.active_workers - 1)

    def record_rule(self, elapsed_seconds: float, failed: bool) -> None:
        with self._lock:
            self._state.total_rules_executed += 1
            self._state.cumulative_rule_execution_time_seconds += max(0.0, elapsed_seconds)
            if failed:
                self._state.failed_rules_count += 1

    def snapshot(self) -> dict[str, float | int]:
        with self._lock:
            total = self._state.total_rules_executed
            avg = (
                self._state.cumulative_rule_execution_time_seconds / total
                if total
                else 0.0
            )
            return {
                "total_rules_executed": total,
                "failed_rules_count": self._state.failed_rules_count,
                "average_rule_execution_time_seconds": avg,
                "active_worker_count": self._state.active_workers,
            }

    def prometheus_text(self) -> str:
        snap = self.snapshot()
        return "\n".join(
            [
                "# HELP engine_total_rules_executed Total executed rules",
                "# TYPE engine_total_rules_executed counter",
                f"engine_total_rules_executed {snap['total_rules_executed']}",
                "# HELP engine_failed_rules_count Failed rules count",
                "# TYPE engine_failed_rules_count counter",
                f"engine_failed_rules_count {snap['failed_rules_count']}",
                "# HELP engine_average_rule_execution_time_seconds Average rule runtime",
                "# TYPE engine_average_rule_execution_time_seconds gauge",
                f"engine_average_rule_execution_time_seconds {snap['average_rule_execution_time_seconds']}",
                "# HELP engine_active_worker_count Active worker count",
                "# TYPE engine_active_worker_count gauge",
                f"engine_active_worker_count {snap['active_worker_count']}",
                "",
            ]
        )


metrics = EngineMetrics()
