import { StyleSheet, View } from 'react-native';

import type { SeizureSummaryDay } from '@/api/types';
import { colors } from '@/theme/tokens';
import { computeStripLevels } from '@/utils/stripLevel';

type Props = { days: SeizureSummaryDay[] };

const LEVEL_COLORS = [
    colors.strip0,
    colors.strip1,
    colors.strip2,
    colors.strip3,
] as const;

/** Тонкая лента 30 дней: клетка на день, оттенок по числу приступов
 *  относительно максимума за период (computeStripLevels),
 *  последняя (сегодня) обведена. Без подписей. */
export function MonthStrip({ days }: Props) {
    const levels = computeStripLevels(days);
    const withSeizures = days.filter((day) => day.count > 0).length;

    return (
        <View
            accessible
            accessibilityLabel={`За 30 дней приступы в ${withSeizures} днях`}
            style={styles.strip}
        >
            {days.map((day, index) => (
                <View
                    key={day.date}
                    style={[
                        styles.cell,
                        { backgroundColor: LEVEL_COLORS[levels[index]] },
                        index === days.length - 1 && styles.last,
                    ]}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    strip: {
        flexDirection: 'row',
        gap: 2,
        marginHorizontal: 16,
    },
    cell: { borderRadius: 3, flex: 1, height: 12 },
    last: { borderColor: colors.text, borderWidth: 1.5 },
});
