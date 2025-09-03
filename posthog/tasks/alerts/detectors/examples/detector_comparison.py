#!/usr/bin/env python3
"""
PostHog Alert Detector Comparison

This script demonstrates the different anomaly detection algorithms available in PostHog's alert system:
- Z-Score Detector: Detects anomalies based on standard deviations from the mean
- MAD Detector: Uses Median Absolute Deviation for robust anomaly detection
- Threshold Detector: Simple threshold-based detection

It generates various types of time series data and visualizes how each detector responds to different anomaly patterns.
"""

import os
import sys
from pathlib import Path

import django

import numpy as np
import matplotlib.pyplot as plt

# Add the project root to the path so we can import PostHog modules
# This script should be run from the PostHog project root directory
project_root = Path.cwd()
sys.path.insert(0, str(project_root))

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "posthog.settings")

django.setup()

# Import PostHog modules after Django setup
from posthog.tasks.alerts.detectors.base import DetectorContext  # noqa: E402
from posthog.tasks.alerts.detectors.mad import MADConfig, MADDetectorImpl  # noqa: E402
from posthog.tasks.alerts.detectors.threshold import (  # noqa: E402
    ThresholdBounds,
    ThresholdConfig,
    ThresholdDetectorImpl,
)
from posthog.tasks.alerts.detectors.zscore import ZScoreConfig, ZScoreDetectorImpl  # noqa: E402

# Configuration constants
TIME_SERIES_LENGTH = 200
BURN_IN_PERIOD = 50
DETECTOR_WINDOW_SIZE = 100
MIN_POINTS = 10
RANDOM_SEED = 42

# Z-Score detector thresholds
ZSCORE_SENSITIVE_THRESHOLD = 2.0
ZSCORE_STANDARD_THRESHOLD = 3.0
ZSCORE_CONSERVATIVE_THRESHOLD = 4.0

# MAD detector thresholds
MAD_SENSITIVE_THRESHOLD = 2.5
MAD_STANDARD_THRESHOLD = 3.5
MAD_CONSERVATIVE_THRESHOLD = 4.5

# Threshold detector bounds
THRESHOLD_WIDE_BOUNDS = (50, 150)
THRESHOLD_NARROW_BOUNDS = (80, 120)
THRESHOLD_DELTA_BOUNDS = (-20, 20)

# Detector configurations
DETECTOR_CONFIGS = {
    "zscore": {
        "sensitive": {
            "z_threshold": ZSCORE_SENSITIVE_THRESHOLD,
            "window": DETECTOR_WINDOW_SIZE,
            "min_points": MIN_POINTS,
        },
        "standard": {
            "z_threshold": ZSCORE_STANDARD_THRESHOLD,
            "window": DETECTOR_WINDOW_SIZE,
            "min_points": MIN_POINTS,
        },
        "conservative": {
            "z_threshold": ZSCORE_CONSERVATIVE_THRESHOLD,
            "window": DETECTOR_WINDOW_SIZE,
            "min_points": MIN_POINTS,
        },
        "delta": {
            "z_threshold": ZSCORE_STANDARD_THRESHOLD,
            "window": DETECTOR_WINDOW_SIZE,
            "min_points": MIN_POINTS,
            "delta": True,
        },
    },
    "mad": {
        "sensitive": {"k": MAD_SENSITIVE_THRESHOLD, "window": DETECTOR_WINDOW_SIZE, "min_points": MIN_POINTS},
        "standard": {"k": MAD_STANDARD_THRESHOLD, "window": DETECTOR_WINDOW_SIZE, "min_points": MIN_POINTS},
        "conservative": {"k": MAD_CONSERVATIVE_THRESHOLD, "window": DETECTOR_WINDOW_SIZE, "min_points": MIN_POINTS},
        "delta": {"k": MAD_STANDARD_THRESHOLD, "window": DETECTOR_WINDOW_SIZE, "min_points": MIN_POINTS, "delta": True},
    },
    "threshold": {
        "wide": {"bounds": THRESHOLD_WIDE_BOUNDS},
        "narrow": {"bounds": THRESHOLD_NARROW_BOUNDS},
        "delta": {"bounds": THRESHOLD_DELTA_BOUNDS, "delta": True},
    },
}

# Data generation parameters
BASE_VALUE = 100
NOISE_STD = 5
SPIKE_VALUE = 200
SPIKE_POSITION = 140
TREND_SLOPE = 1.5
VOLATILITY_STD = 20
STEP_VALUE = 150
STEP_POSITION = 120


def generate_baseline_data(n=TIME_SERIES_LENGTH, base_value=BASE_VALUE, noise_std=NOISE_STD, burn_in=BURN_IN_PERIOD):
    """Generate baseline time series with some noise"""
    np.random.seed(RANDOM_SEED)
    # Generate smoother baseline data with less noise
    data = base_value + np.random.normal(0, noise_std * 0.3, n)
    # Add burn-in period with more stable data
    data[:burn_in] = base_value + np.random.normal(0, noise_std * 0.2, burn_in)
    return data


def generate_spike_data(
    n=TIME_SERIES_LENGTH,
    base_value=BASE_VALUE,
    noise_std=NOISE_STD,
    spike_value=SPIKE_VALUE,
    spike_position=SPIKE_POSITION,
    burn_in=BURN_IN_PERIOD,
):
    """Generate data with a sudden spike"""
    np.random.seed(RANDOM_SEED)
    data = base_value + np.random.normal(0, noise_std, n)
    # Add burn-in period with more stable data
    data[:burn_in] = base_value + np.random.normal(0, noise_std * 0.5, burn_in)
    data[spike_position] = spike_value
    return data


def generate_trend_data(
    n=TIME_SERIES_LENGTH, start_value=BASE_VALUE, trend=TREND_SLOPE, noise_std=NOISE_STD, burn_in=BURN_IN_PERIOD
):
    """Generate data with a gradual trend"""
    np.random.seed(RANDOM_SEED)
    trend_component = np.arange(n) * trend
    noise = np.random.normal(0, noise_std, n)
    data = start_value + trend_component + noise
    # Add burn-in period with more stable data
    data[:burn_in] = start_value + np.random.normal(0, noise_std * 0.5, burn_in)
    return data


def generate_volatile_data(
    n=TIME_SERIES_LENGTH, base_value=BASE_VALUE, volatility_std=VOLATILITY_STD, burn_in=BURN_IN_PERIOD
):
    """Generate highly volatile data"""
    np.random.seed(RANDOM_SEED)
    data = base_value + np.random.normal(0, volatility_std, n)
    # Add burn-in period with more stable data
    data[:burn_in] = base_value + np.random.normal(0, volatility_std * 0.3, burn_in)
    return data


def generate_step_change_data(
    n=TIME_SERIES_LENGTH,
    base_value=BASE_VALUE,
    noise_std=NOISE_STD,
    step_value=STEP_VALUE,
    step_position=STEP_POSITION,
    burn_in=BURN_IN_PERIOD,
):
    """Generate data with a step change"""
    np.random.seed(RANDOM_SEED)
    data = base_value + np.random.normal(0, noise_std, n)
    # Add burn-in period with more stable data
    data[:burn_in] = base_value + np.random.normal(0, noise_std * 0.5, burn_in)
    data[step_position:] += step_value - base_value
    return data


def run_detector_replay(datasets, detector_configs, detector_impl, detector_name):
    """Run a detector on all datasets by replaying the data over time"""
    results = {}

    for dataset_name, data in datasets.items():
        results[dataset_name] = {}

        for config_name, config in detector_configs.items():
            # Replay the data over time
            alerts_over_time = []
            scores_over_time = []

            for i in range(len(data)):
                # Use data up to current point
                current_series = data[: i + 1].tolist()
                ctx = DetectorContext(series=current_series)

                try:
                    result = detector_impl.evaluate(ctx, config)
                    # Don't allow alerts during burn-in period
                    is_alert = len(result.breaches) > 0 and i >= BURN_IN_PERIOD
                    alerts_over_time.append(is_alert)
                    scores_over_time.append(result.value if result.value is not None else 0)
                except Exception:
                    alerts_over_time.append(False)
                    scores_over_time.append(0)

            results[dataset_name][config_name] = {
                "alerts_over_time": alerts_over_time,
                "scores_over_time": scores_over_time,
                "total_alerts": sum(alerts_over_time),
            }

    return results


def create_detector_visualization(dataset_name, data, zscore_results, mad_results, threshold_results, save_path=None):
    """Create a time series visualization with heatmap rows for each detector config"""

    # Calculate number of detector configs for subplot sizing
    num_configs = (
        len(zscore_results[dataset_name]) + len(mad_results[dataset_name]) + len(threshold_results[dataset_name])
    )

    # Create figure with main plot and sparkline rows
    fig = plt.figure(figsize=(20, 8 + num_configs * 0.3))
    gs = fig.add_gridspec(num_configs + 1, 1, height_ratios=[3] + [0.3] * num_configs, hspace=0.1)

    # Main time series plot
    ax_main = fig.add_subplot(gs[0])
    time_points = range(len(data))
    ax_main.plot(time_points, data, "b-", linewidth=2, alpha=0.8, label="Time Series")
    ax_main.scatter(time_points, data, c="blue", s=20, alpha=0.6)

    # Add burn-in period indicator
    ax_main.axvspan(0, BURN_IN_PERIOD, alpha=0.1, color="gray", label="Burn-in Period")

    # Styling for main plot
    ax_main.set_title(f"{dataset_name.title()} Dataset - Detector Alert Timeline", fontsize=16, fontweight="bold")
    ax_main.set_ylabel("Value", fontsize=12)
    ax_main.grid(True, alpha=0.3)
    ax_main.legend(loc="upper right")

    # Create heatmap rows for each detector config
    row_idx = 1

    # Z-Score detector configs
    for config_name, result in zscore_results[dataset_name].items():
        ax_sparkline = fig.add_subplot(gs[row_idx])
        alerts_over_time = result["alerts_over_time"]

        # Create sparkline time series
        time_points = np.arange(len(alerts_over_time))

        # Plot alert binary values (0 or 1) as main line
        ax_sparkline.plot(time_points, alerts_over_time, color="red", linewidth=1.5, label="Alerts")

        # Add burn-in period overlay
        ax_sparkline.axvspan(0, BURN_IN_PERIOD - 1, alpha=0.1, color="gray")

        # Configure sparkline
        ax_sparkline.set_ylim(-0.1, 1.1)
        ax_sparkline.set_xticks([])
        ax_sparkline.set_yticks([])
        ax_sparkline.set_xlim(ax_main.get_xlim())  # Match main plot x-axis

        # Add detector name and config parameters as text
        detector_name = "Z-Score " + config_name.replace("zscore_", "").replace("_", " ").title()
        config_params = (
            f"σ={ZSCORE_SENSITIVE_THRESHOLD}, w={DETECTOR_WINDOW_SIZE}"
            if "sensitive" in config_name
            else f"σ={ZSCORE_STANDARD_THRESHOLD}, w={DETECTOR_WINDOW_SIZE}"
            if "standard" in config_name
            else f"σ={ZSCORE_CONSERVATIVE_THRESHOLD}, w={DETECTOR_WINDOW_SIZE}"
            if "conservative" in config_name
            else f"σ={ZSCORE_STANDARD_THRESHOLD}, w={DETECTOR_WINDOW_SIZE}, δ"
        )
        full_text = f"{detector_name}: {config_params}"
        ax_sparkline.text(
            0.02,
            0.5,
            full_text,
            transform=ax_sparkline.transAxes,
            fontsize=8,
            va="center",
            ha="left",
            bbox={"boxstyle": "round", "pad": 0.2, "facecolor": "white", "alpha": 0.8},
        )

        row_idx += 1

    # MAD detector configs
    for config_name, result in mad_results[dataset_name].items():
        ax_sparkline = fig.add_subplot(gs[row_idx])
        alerts_over_time = result["alerts_over_time"]

        # Create sparkline time series
        time_points = np.arange(len(alerts_over_time))

        # Plot alert binary values (0 or 1) as main line
        ax_sparkline.plot(time_points, alerts_over_time, color="orange", linewidth=1.5, label="Alerts")

        # Add burn-in period overlay
        ax_sparkline.axvspan(0, BURN_IN_PERIOD - 1, alpha=0.1, color="gray")

        # Configure sparkline
        ax_sparkline.set_ylim(-0.1, 1.1)
        ax_sparkline.set_xticks([])
        ax_sparkline.set_yticks([])
        ax_sparkline.set_xlim(ax_main.get_xlim())  # Match main plot x-axis

        # Add detector name and config parameters as text
        detector_name = "MAD " + config_name.replace("mad_", "").replace("_", " ").title()
        config_params = (
            f"k={MAD_SENSITIVE_THRESHOLD}, w={DETECTOR_WINDOW_SIZE}"
            if "sensitive" in config_name
            else f"k={MAD_STANDARD_THRESHOLD}, w={DETECTOR_WINDOW_SIZE}"
            if "standard" in config_name
            else f"k={MAD_CONSERVATIVE_THRESHOLD}, w={DETECTOR_WINDOW_SIZE}"
            if "conservative" in config_name
            else f"k={MAD_STANDARD_THRESHOLD}, w={DETECTOR_WINDOW_SIZE}, δ"
        )
        full_text = f"{detector_name}: {config_params}"
        ax_sparkline.text(
            0.02,
            0.5,
            full_text,
            transform=ax_sparkline.transAxes,
            fontsize=8,
            va="center",
            ha="left",
            bbox={"boxstyle": "round", "pad": 0.2, "facecolor": "white", "alpha": 0.8},
        )

        row_idx += 1

    # Threshold detector configs
    for config_name, result in threshold_results[dataset_name].items():
        ax_sparkline = fig.add_subplot(gs[row_idx])
        alerts_over_time = result["alerts_over_time"]

        # Create sparkline time series
        time_points = np.arange(len(alerts_over_time))

        # Plot alert binary values (0 or 1) as main line
        ax_sparkline.plot(time_points, alerts_over_time, color="green", linewidth=1.5, label="Alerts")

        # Add burn-in period overlay
        ax_sparkline.axvspan(0, BURN_IN_PERIOD - 1, alpha=0.1, color="gray")

        # Configure sparkline
        ax_sparkline.set_ylim(-0.1, 1.1)
        ax_sparkline.set_xticks([])
        ax_sparkline.set_yticks([])
        ax_sparkline.set_xlim(ax_main.get_xlim())  # Match main plot x-axis

        # Add detector name and config parameters as text
        detector_name = "Threshold " + config_name.replace("threshold_", "").replace("_", " ").title()
        config_params = (
            f"bounds={THRESHOLD_WIDE_BOUNDS}"
            if "wide" in config_name
            else f"bounds={THRESHOLD_NARROW_BOUNDS}"
            if "narrow" in config_name
            else f"bounds={THRESHOLD_DELTA_BOUNDS}, δ"
        )
        full_text = f"{detector_name}: {config_params}"
        ax_sparkline.text(
            0.02,
            0.5,
            full_text,
            transform=ax_sparkline.transAxes,
            fontsize=8,
            va="center",
            ha="left",
            bbox={"boxstyle": "round", "pad": 0.2, "facecolor": "white", "alpha": 0.8},
        )

        row_idx += 1

    # Add x-axis label to the last subplot
    ax_sparkline.set_xlabel("Time", fontsize=12)

    # Removed summary box for cleaner visualization

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches="tight")
        # print(f"Saved visualization to: {save_path}")

    return fig


def main():
    """Main function to run the detector comparison"""
    # print("🔍 PostHog Alert Detector Comparison")
    # print("=" * 50)

    # Generate test datasets
    # print("Generating test datasets...")
    datasets = {
        "baseline": generate_baseline_data(),
        "spike": generate_spike_data(),
        "trend": generate_trend_data(),
        "volatile": generate_volatile_data(),
        "step_change": generate_step_change_data(),
    }

    # print(f"Generated {len(datasets)} datasets:")
    # for name, data in datasets.items():
    #     print(f"  {name}: mean={np.mean(data):.1f}, std={np.std(data):.1f}, min={np.min(data):.1f}, max={np.max(data):.1f}")

    # Set up detector configurations
    # print("\nSetting up detector configurations...")
    zscore_configs = {}
    for config_name, config_params in DETECTOR_CONFIGS["zscore"].items():
        zscore_configs[f"zscore_{config_name}"] = ZScoreConfig(
            window=config_params["window"],
            z_threshold=config_params["z_threshold"],
            direction="both",
            min_points=config_params["min_points"],
            on="delta" if config_params.get("delta") else "value",
        )

    mad_configs = {}
    for config_name, config_params in DETECTOR_CONFIGS["mad"].items():
        mad_configs[f"mad_{config_name}"] = MADConfig(
            window=config_params["window"],
            k=config_params["k"],
            direction="both",
            min_points=config_params["min_points"],
            on="delta" if config_params.get("delta") else "value",
        )

    threshold_configs = {}
    for config_name, config_params in DETECTOR_CONFIGS["threshold"].items():
        bounds = config_params["bounds"]
        threshold_configs[f"threshold_{config_name}"] = ThresholdConfig(
            bounds=ThresholdBounds(lower=bounds[0], upper=bounds[1]),
            on="delta" if config_params.get("delta") else "value",
        )

    # Run detector comparisons with replay
    # print("\nRunning detector evaluations (replaying data over time)...")
    zscore_results = run_detector_replay(datasets, zscore_configs, ZScoreDetectorImpl(), "Z-Score")
    mad_results = run_detector_replay(datasets, mad_configs, MADDetectorImpl(), "MAD")
    threshold_results = run_detector_replay(datasets, threshold_configs, ThresholdDetectorImpl(), "Threshold")

    # print("✅ All detectors evaluated successfully!")

    # Create visualizations
    # print("\nCreating visualizations...")
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    for dataset_name in datasets.keys():
        # print(f"  Creating visualization for {dataset_name} dataset...")
        save_path = output_dir / f"{dataset_name}_detector_timeline.png"

        fig = create_detector_visualization(
            dataset_name, datasets[dataset_name], zscore_results, mad_results, threshold_results, save_path=save_path
        )

        # Show the plot
        # plt.show()
        plt.close(fig)

    # print(f"\n🎉 Analysis complete! Visualizations saved to: {output_dir}")

    # Print summary insights
    # print("\n" + "=" * 50)
    # print("KEY INSIGHTS:")
    # print("=" * 50)

    for dataset_name in datasets.keys():
        # print(f"\n📊 {dataset_name.upper()} DATASET:")

        zscore_alerts = sum(result["total_alerts"] for result in zscore_results[dataset_name].values())
        mad_alerts = sum(result["total_alerts"] for result in mad_results[dataset_name].values())
        threshold_alerts = sum(result["total_alerts"] for result in threshold_results[dataset_name].values())

        # print(f"  Z-Score: {zscore_alerts} total alerts across all configs")
        # print(f"  MAD: {mad_alerts} total alerts across all configs")
        # print(f"  Threshold: {threshold_alerts} total alerts across all configs")

        # Find the most sensitive detector for this dataset
        total_alerts = zscore_alerts + mad_alerts + threshold_alerts
        if total_alerts > 0:
            if zscore_alerts >= mad_alerts and zscore_alerts >= threshold_alerts:
                # print(f"  → Z-Score detector was most sensitive to this pattern")
                pass
            elif mad_alerts >= threshold_alerts:
                # print(f"  → MAD detector was most sensitive to this pattern")
                pass
            else:
                # print(f"  → Threshold detector was most sensitive to this pattern")
                pass
        else:
            # print(f"  → No detectors triggered alerts (very stable pattern)")
            pass


if __name__ == "__main__":
    main()
