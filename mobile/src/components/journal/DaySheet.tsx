import { StyleSheet, View } from 'react-native';

import { SeizureRow } from '@/components/journal/SeizureRow';
import { AppText } from '@/components/ui/AppText';
import type { JournalEntry } from '@/offline/types';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import { formatDayTitle, pluralizeSeizures } from '@/utils/dayGroups';
import type { SeizureDayGroup } from '@/utils/dayGroups';

type Props = {
    group: SeizureDayGroup<JournalEntry>;
    isToday: boolean;
    deletingId: number | null;
    onPressRow: (entry: JournalEntry) => void;
};

/** Лист дня: заголовок («Сегодня» на sunSoft) + количество, внутри строки. */
export function DaySheet({ group, isToday, deletingId, onPressRow }: Props) {
    return (
        <View style={styles.sheet}>
            <View style={[styles.head, isToday && styles.headToday]}>
                <AppText style={styles.title}>
                    {isToday ? 'Сегодня' : formatDayTitle(group.day)}
                </AppText>
                <AppText color="muted" style={styles.count}>
                    {group.count} {pluralizeSeizures(group.count)}
                </AppText>
            </View>
            <View style={styles.rows}>
                {group.items.map((seizure, index) => (
                    <SeizureRow
                        key={seizure.id}
                        seizure={seizure}
                        isLast={index === group.items.length - 1}
                        disabled={deletingId === seizure.id}
                        onPress={onPressRow}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sheet: {
        backgroundColor: colors.surface,
        borderRadius: radius.sheet,
        marginBottom: spacing.sm + 2,
        marginHorizontal: spacing.lg,
        overflow: 'hidden',
    },
    head: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    headToday: { backgroundColor: colors.sunSoft },
    rows: { paddingHorizontal: spacing.lg },
    title: { fontFamily: fontFamily.extrabold, fontSize: 14, lineHeight: 20 },
    count: { fontSize: 12, lineHeight: 16 },
});
