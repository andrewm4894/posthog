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
        window = config.window or 30

        # Get raw metric values for context
        latest_value = ctx.get_latest_value()

        if config.on == "delta":
            previous_value = ctx.get_previous_value()
            delta_value = latest_value - previous_value
            metric_context = f"delta from {previous_value:.1f} to {latest_value:.1f} (Δ={delta_value:+.1f})"
        else:
            metric_context = f"value {latest_value:.1f}"

        if direction == "both" or config.two_tailed:
            if abs(z) >= thr:
                breaches.append(
                    f"Z-score alert: Metric {metric_context} has z-score {z:+.1f}σ exceeding threshold ±{thr}σ (window: {window} periods)"
                )
        elif direction == "up":
            if z >= thr:
                breaches.append(
                    f"Z-score alert: Metric {metric_context} has z-score {z:+.1f}σ exceeding upward threshold +{thr}σ (window: {window} periods)"
                )
        elif direction == "down":
            if z <= -thr:
                breaches.append(
                    f"Z-score alert: Metric {metric_context} has z-score {z:+.1f}σ exceeding downward threshold -{thr}σ (window: {window} periods)"
                )

        return AlertEvaluationResult(value=float(z), breaches=breaches, raw_value=latest_value)


register_detector("zscore", ZScoreDetectorImpl())
