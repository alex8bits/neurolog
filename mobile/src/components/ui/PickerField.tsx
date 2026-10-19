import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, fontFamily, radius, spacing } from '@/theme/tokens';

type Props = {
    label: string;
    value: string;
    invalid?: boolean;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
};

/** Кнопка-поле «Дата»/«Время»: открывает нативный пикер. */
export function PickerField({ label, value, invalid, onPress, style }: Props) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value}`}
            onPress={onPress}
            style={[styles.field, invalid && styles.invalid, style]}
        >
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    field: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.line,
        borderRadius: radius.control,
        paddingHorizontal: spacing.lg - 2,
        paddingVertical: spacing.sm + 2,
    },
    invalid: { borderColor: colors.danger },
    label: {
        fontFamily: fontFamily.bold,
        fontSize: 11,
        lineHeight: 14,
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.44,
    },
    value: {
        fontFamily: fontFamily.semibold,
        fontSize: 16,
        lineHeight: 24,
        color: colors.text,
    },
});
