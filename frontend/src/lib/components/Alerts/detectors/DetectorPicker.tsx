import { LemonSelect, Tooltip } from '@posthog/lemon-ui'

type Props = {
    value: string
    onChange: (type: string) => void
    isTimeSeries?: boolean
}

export function DetectorPicker({ value, onChange, isTimeSeries = true }: Props): JSX.Element {
    const options = [
        {
            label: 'Threshold',
            value: '',
            tooltip: 'Simple upper/lower bounds - alert when value crosses a fixed limit',
        },
    ]

    // Only show zscore and MAD options for time series insights
    if (isTimeSeries) {
        options.push(
            {
                label: 'Z-score',
                value: 'zscore',
                tooltip: 'Statistical anomaly detection - alert when value deviates significantly from normal patterns',
            },
            {
                label: 'MAD',
                value: 'mad',
                tooltip: 'Robust outlier detection - alert on extreme values, less sensitive to noise than Z-score',
            }
        )
    }

    return (
        <Tooltip
            title={
                isTimeSeries
                    ? 'Choose your detection method: Threshold for simple limits, Z-score for statistical anomalies, or MAD for robust outlier detection.'
                    : 'Choose your detection method: Threshold for simple limits when value crosses a fixed threshold.'
            }
            placement="right"
        >
            <LemonSelect
                className="w-48"
                placeholder="Threshold (default)"
                value={value ?? ''}
                onChange={(val) => onChange(val as string)}
                options={options}
            />
        </Tooltip>
    )
}
