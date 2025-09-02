from __future__ import annotations

from dataclasses import dataclass
from statistics import median

from posthog.tasks.alerts.utils import AlertEvaluationResult

from .base import DetectorConfig, DetectorContext, register_detector


@dataclass
class MADConfig(DetectorConfig):
    type: str = "mad"
    window: int = 30
    on: str = "value"  # value|delta
    k: float = 3.5
    direction: str = "both"  # up|down|both
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
        thr = abs(config.k)
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

        if direction == "both":
            if abs(robust) >= thr:
                breaches.append(
                    f"MAD alert: Metric {metric_context} has robust score {robust:+.1f} exceeding threshold ±{thr} (window: {window} periods)"
                )
        elif direction == "up":
            if robust >= thr:
                breaches.append(
                    f"MAD alert: Metric {metric_context} has robust score {robust:+.1f} exceeding upward threshold +{thr} (window: {window} periods)"
                )
        elif direction == "down":
            if robust <= -thr:
                breaches.append(
                    f"MAD alert: Metric {metric_context} has robust score {robust:+.1f} exceeding downward threshold -{thr} (window: {window} periods)"
                )

        return AlertEvaluationResult(value=float(robust), breaches=breaches)


register_detector("mad", MADDetectorImpl())
