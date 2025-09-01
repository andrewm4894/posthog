from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol, runtime_checkable

from posthog.tasks.alerts.utils import AlertEvaluationResult


@dataclass
class DetectorContext:
    # raw series with most recent at index -1 (ascending timestamps)
    series: list[float]
    # optional label/series name
    label: Optional[str] = None


@runtime_checkable
class DetectorConfig(Protocol):
    type: str


class Detector(Protocol):
    def evaluate(self, ctx: DetectorContext, config: DetectorConfig) -> AlertEvaluationResult:  # pragma: no cover
        ...


_REGISTRY: dict[str, Detector] = {}


def register_detector(name: str, detector: Detector) -> None:
    _REGISTRY[name] = detector


def get_detector(name: str) -> Detector:
    return _REGISTRY[name]
