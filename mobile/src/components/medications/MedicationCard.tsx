import { Pressable, StyleSheet, View } from 'react-native';

import type { Medication } from '@/api/types';
import { StatusBadge, statusLabel } from '@/components/medications/StatusBadge';
import { AppText } from '@/components/ui/AppText';
import { colors, radius, spacing } from '@/theme/tokens';
import { formatDosage } from '@/utils/dosage';
import { formatYmdDisplay } from '@/utils/ymd';

type Props = {
    medication: Medication;
    onPress: (medication: Medication) => void;
};

/** «с 25.10.2026 по 28.10.2026» или «с 25.10.2026, бессрочно». */
function periodText(medication: Medication): string {
    const from = `с ${formatYmdDisplay(medication.start_date)}`;

    return medication.end_date === null
        ? `${from}, бессрочно`
        : `${from} по ${formatYmdDisplay(medication.end_date)}`;
}

/** Карточка лекарства: название + бейдж, дозировка, период приёма.
 *  Нажатие открывает форму правки. */
export function MedicationCard({ medication, onPress }: Props) {
    const dosage = formatDosage(medication.dosage, medication.unit);
    const period = periodText(medication);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${medication.name}, ${dosage}, ${period}, ${statusLabel(medication.status)}`}
            onPress={() => {
                onPress(medication);
            }}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
            <View style={styles.top}>
                <AppText variant="heading" style={styles.name}>
                    {medication.name}
                </AppText>
                <StatusBadge status={medication.status} />
            </View>
            <AppText variant="label">{dosage}</AppText>
            <AppText variant="label" color="muted">
                {period}
            </AppText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.sheet,
        gap: spacing.xs,
        padding: spacing.lg,
    },
    pressed: { opacity: 0.85 },
    top: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'space-between',
    },
    name: { flex: 1 },
});
