import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, fontFamily } from '@/theme/tokens';
import type { WeekDay } from '@/utils/week';

const LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

type Props = { week: WeekDay[] };

function circleColor(count: number | null): string {
    if (count === null) {
        return colors.line;
    }

    return count > 0 ? colors.sun : colors.primarySoft;
}

/** Неделя пн–вс: круг на день — sun при приступах, primarySoft без них,
 *  line для будущих, сегодня — обводка 2 px. */
export function WeekStrip({ week }: Props) {
    return (
        <View style={styles.row}>
            {week.map((day, index) => (
                <View key={day.date} style={styles.col}>
                    <AppText color="muted" style={styles.label}>
                        {LABELS[index]}
                    </AppText>
                    <View
                        accessibilityLabel={
                            day.count === null
                                ? `${LABELS[index]}: ещё не наступил`
                                : `${LABELS[index]}: приступов ${day.count}`
                        }
                        style={[
                            styles.circle,
                            { backgroundColor: circleColor(day.count) },
                            day.isToday && styles.today,
                        ]}
                    >
                        {day.count !== null && day.count > 0 ? (
                            <AppText style={styles.num}>{day.count}</AppText>
                        ) : null}
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row' },
    col: { alignItems: 'center', flex: 1, gap: 4 },
    label: { fontSize: 11, lineHeight: 14 },
    circle: {
        alignItems: 'center',
        borderRadius: 15,
        height: 30,
        justifyContent: 'center',
        width: 30,
    },
    today: { borderColor: colors.text, borderWidth: 2 },
    num: { fontFamily: fontFamily.extrabold, fontSize: 13, lineHeight: 16 },
});
