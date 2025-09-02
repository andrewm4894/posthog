from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from posthog.tasks.alerts.utils import AlertEvaluationResult

from .base import DetectorConfig, DetectorContext, register_detector


@dataclass
class ThresholdBounds:
    lower: Optional[float] = None
    upper: Optional[float] = None


@dataclass
class ThresholdConfig(DetectorConfig):
    type: str = "threshold"
    on: str = "value"  # value|delta|pct_delta
    bounds: ThresholdBounds = field(default_factory=ThresholdBounds)
    two_tailed: bool = True  # kept for symmetry


class ThresholdDetectorImpl:
    def evaluate(self, ctx: DetectorContext, config: ThresholdConfig) -> AlertEvaluationResult:
        series = ctx.series
        if not series:
            return AlertEvaluationResult(value=None, breaches=[])

        def transform(seq: list[float]) -> list[float]:
            if config.on == "value":
                return seq
            if config.on == "delta":
                return [b - a for a, b in zip(seq[:-1], seq[1:])]
            if config.on == "pct_delta":
                out = []
                for a, b in zip(seq[:-1], seq[1:]):
                    denom = a if abs(a) > 1e-12 else 1e-12
                    out.append((b - a) / denom)
                return out
            return seq

        transformed = transform(series)
        current = transformed[-1] if transformed else None
        breaches: list[str] = []
        if current is not None:
            if config.bounds.lower is not None and current < config.bounds.lower:
                breaches.append(f"value {current} < lower {config.bounds.lower}")
            if config.bounds.upper is not None and current > config.bounds.upper:
                breaches.append(f"value {current} > upper {config.bounds.upper}")

        return AlertEvaluationResult(value=current, breaches=breaches)


register_detector("threshold", ThresholdDetectorImpl())
