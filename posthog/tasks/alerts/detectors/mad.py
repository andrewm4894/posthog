from __future__ import annotations

from dataclasses import dataclass
from statistics import median

from posthog.tasks.alerts.utils import AlertEvaluationResult

from .base import DetectorConfig, DetectorContext, register_detector


@dataclass
class MADConfig(DetectorConfig):
    type: str = "mad"
    window: int = 30
    on: str = "value"  # value|delta|pct_delta
    k: float = 3.5
    min_points: int = 10


class MADDetectorImpl:
    def evaluate(self, ctx: DetectorContext, config: MADConfig) -> AlertEvaluationResult:
        series = ctx.series
        if len(series) < max(2, config.min_points):
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

        x = transform(series)
        tail = x[-config.window - 1 :] if len(x) > config.window + 1 else x
        if len(tail) < 2:
            return AlertEvaluationResult(value=None, breaches=[])

        current = tail[-1]
        baseline = tail[:-1]
        m = median(baseline)
        mad = median([abs(v - m) for v in baseline])
        robust = 0.6745 * (current - m) / (mad + 1e-12)

        breaches: list[str] = []
        if abs(robust) >= abs(config.k):
            breaches.append(f"|mad_score|={abs(robust):.2f} >= {abs(config.k)}")

        return AlertEvaluationResult(value=float(robust), breaches=breaches)


register_detector("mad", MADDetectorImpl())
