import { LemonSelect, Tooltip } from '@posthog/lemon-ui'

type Props = {
    value: string
    onChange: (type: string) => void
}

export function DetectorPicker({ value, onChange }: Props): JSX.Element {
    return (
        <Tooltip
            title="Choose your detection method: Threshold for simple limits, Z-score for statistical anomalies, or MAD for robust outlier detection."
            placement="right"
        >
            <LemonSelect
                className="w-48"
                placeholder="Threshold (default)"
                value={value ?? ''}
                onChange={(val) => onChange(val as string)}
                options={[
                    {
                        label: 'Threshold',
                        value: '',
                        tooltip: 'Simple upper/lower bounds - alert when value crosses a fixed limit',
                    },
                    {
                        label: 'Z-score',
                        value: 'zscore',
                        tooltip:
                            'Statistical anomaly detection - alert when value deviates significantly from normal patterns',
                    },
                    {
                        label: 'MAD',
                        value: 'mad',
                        tooltip:
                            'Robust outlier detection - alert on extreme values, less sensitive to noise than Z-score',
                    },
                ]}
            />
        </Tooltip>
    )
}
