import { LemonSelect } from '@posthog/lemon-ui'

type Props = {
    value: string
    onChange: (type: string) => void
}

export function DetectorPicker({ value, onChange }: Props): JSX.Element {
    return (
        <LemonSelect
            className="w-48"
            placeholder="Threshold (default)"
            value={value ?? ''}
            onChange={(val) => onChange(val as string)}
            options={[
                { label: 'Threshold', value: '' },
                { label: 'Z-score', value: 'zscore' },
                { label: 'MAD', value: 'mad' },
            ]}
        />
    )
}
