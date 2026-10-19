import { Pressable, StyleSheet, View } from 'react-native';

import type { Seizure } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { colors, fontFamily, spacing } from '@/theme/tokens';
import { formatHm, parseUtcIso } from '@/utils/time';

/** «14:25» для строки внутри группы дня; непарсируемое (не бывает по
 *  контракту сервера) — сырая строка вместо пустоты. */
export function rowTimeLabel(occurredAt: string): string {
    const moment = parseUtcIso(occurredAt);

    return moment !== null ? formatHm(moment) : occurredAt;
}

type Props = {
    seizure: Seizure;
    /** Последняя строка листа — без нижнего разделителя. */
    isLast: boolean;
    disabled?: boolean;
    onPress: (seizure: Seizure) => void;
};

/** Строка журнала: время, комментарий (до 2 строк) и «···» справа. Тап по
 *  строке и по «···» открывает шторку действий. */
export function SeizureRow({ seizure, isLast, disabled, onPress }: Props) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Запись в ${rowTimeLabel(seizure.occurred_at)}`}
            accessibilityHint="Открыть действия с записью"
            disabled={disabled}
            onPress={() => onPress(seizure)}
            style={[
                styles.row,
                !isLast && styles.separator,
                disabled && styles.disabled,
            ]}
        >
            <AppText style={styles.time}>
                {rowTimeLabel(seizure.occurred_at)}
            </AppText>
            <View style={styles.body}>
                {seizure.comment !== null ? (
                    <AppText numberOfLines={2} style={styles.comment}>
                        {seizure.comment}
                    </AppText>
                ) : null}
            </View>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Действия"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.dotsButton}
                disabled={disabled}
                onPress={() => onPress(seizure)}
            >
                <AppText color="muted" style={styles.dots}>
                    ···
                </AppText>
            </Pressable>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: 36,
        paddingVertical: 7,
    },
    separator: {
        borderBottomColor: colors.line,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    disabled: { opacity: 0.6 },
    time: {
        fontFamily: fontFamily.extrabold,
        fontSize: 15,
        lineHeight: 20,
        minWidth: 46,
    },
    body: { flex: 1 },
    comment: { fontSize: 14, lineHeight: 19 },
    // Область касания «···» ≥ 44 px за счёт minWidth + hitSlop; высоту
    // строки не раздувает (hitSlop выходит за границы видимой области).
    dotsButton: { minWidth: 32, alignItems: 'center' },
    dots: { fontFamily: fontFamily.extrabold, fontSize: 18, lineHeight: 20 },
});
