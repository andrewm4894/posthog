from __future__ import annotations

from dataclasses import dataclass
from statistics import mean, pstdev

from posthog.tasks.alerts.utils import AlertEvaluationResult

from .base import DetectorConfig, DetectorContext, register_detector


@dataclass
class ZScoreConfig(DetectorConfig):
    type: str = "zscore"
    window: int = 30
    on: str = "value"  # value|delta
    z_threshold: float = 3.0
    two_tailed: bool = True
    direction: str = "both"  # up|down|both (both == two-tailed)
    min_points: int = 10


class ZScoreDetectorImpl:
    def evaluate(self, ctx: DetectorContext, config: ZScoreConfig) -> AlertEvaluationResult:
        series = ctx.series
        if len(series) < max(2, config.min_points):
            return AlertEvaluationResult(value=None, breaches=[])

        def transform(seq: list[float]) -> list[float]:
            if config.on == "value":
                return seq
            if config.on == "delta":
                return [b - a for a, b in zip(seq[:-1], seq[1:])]
            return seq

        x = transform(series)
        if len(x) < max(2, config.min_points):
            return AlertEvaluationResult(value=None, breaches=[])

        tail = x[-config.window - 1 :] if len(x) > config.window + 1 else x
        if len(tail) < 2:
            return AlertEvaluationResult(value=None, breaches=[])

        current = tail[-1]
        baseline = tail[:-1]
        mu = mean(baseline)
        sigma = pstdev(baseline) if len(baseline) > 1 else 0.0
        z = (current - mu) / (sigma + 1e-12)

        breaches: list[str] = []
        thr = abs(config.z_threshold)
        direction = (config.direction or "both").lower()
        if direction == "both" or config.two_tailed:
            if abs(z) >= thr:
                breaches.append(f"|z|={abs(z):.2f} >= {thr}")
        elif direction == "up":
            if z >= thr:
                breaches.append(f"z={z:.2f} >= {thr}")
        elif direction == "down":
            if z <= -thr:
                breaches.append(f"z={z:.2f} <= -{thr}")

        return AlertEvaluationResult(value=float(z), breaches=breaches)


register_detector("zscore", ZScoreDetectorImpl())
