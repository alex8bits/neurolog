import { StyleSheet, View } from 'react-native';

import type { SeizureSummaryDay } from '@/api/types';
import { colors } from '@/theme/tokens';

type Props = { days: SeizureSummaryDay[] };

function cellColor(count: number): string {
    if (count <= 0) {
        return colors.strip0;
    }

    if (count === 1) {
        return colors.strip1;
    }

    return count === 2 ? colors.strip2 : colors.strip3;
}

/** Тонкая лента 30 дней: клетка на день, оттенок по числу приступов,
 *  последняя (сегодня) обведена. Без подписей. */
export function MonthStrip({ days }: Props) {
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
                        { backgroundColor: cellColor(day.count) },
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
