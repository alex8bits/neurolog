import { StyleSheet, View } from 'react-native';

import type { MedicationStatus } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Colors } from '@/theme/tokens';

const BADGES: Record<
    MedicationStatus,
    { label: string; background: keyof Colors; text: keyof Colors }
> = {
    planned: { label: 'Запланировано', background: 'sunSoft', text: 'text' },
    active: { label: 'Идёт приём', background: 'primarySoft', text: 'primary' },
    finished: { label: 'Приём окончен', background: 'line', text: 'muted' },
};

/** Подпись статуса приёма — для бейджа и для экранного диктора. */
export function statusLabel(status: MedicationStatus): string {
    return BADGES[status].label;
}

/** Пилюля статуса приёма; статус считает сервер. */
export function StatusBadge({ status }: { status: MedicationStatus }) {
    const badge = BADGES[status];

    return (
        <View
            style={[styles.pill, { backgroundColor: colors[badge.background] }]}
        >
            <AppText variant="caption" color={badge.text} numberOfLines={1}>
                {badge.label}
            </AppText>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        alignSelf: 'flex-start',
        borderRadius: radius.control,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs / 2,
    },
});
