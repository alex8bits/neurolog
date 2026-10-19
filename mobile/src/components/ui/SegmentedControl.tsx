import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, fontFamily, radius, shadow, spacing } from '@/theme/tokens';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
    options: readonly Option<T>[];
    /** null — ни один сегмент не выбран (значение вне options). */
    value: T | null;
    onChange: (value: T) => void;
    style?: StyleProp<ViewStyle>;
};

/** Переключатель из макета: серо-бирюзовый трек, активный сегмент белый. */
export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    style,
}: Props<T>) {
    return (
        <View style={[styles.track, style]} accessibilityRole="tablist">
            {options.map((option) => {
                const active = option.value === value;

                return (
                    <Pressable
                        key={option.value}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => onChange(option.value)}
                        style={[styles.segment, active && styles.active]}
                    >
                        <Text
                            numberOfLines={1}
                            style={[styles.label, active && styles.labelActive]}
                        >
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        flexDirection: 'row',
        backgroundColor: colors.segmentTrack,
        borderRadius: 12,
        padding: spacing.xs,
        gap: spacing.xs,
    },
    segment: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        paddingVertical: spacing.sm + 1,
        paddingHorizontal: spacing.xs,
        borderRadius: radius.control - 1,
    },
    active: {
        backgroundColor: colors.surface,
        ...shadow.segment,
    },
    label: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        lineHeight: 20,
        color: colors.muted,
    },
    labelActive: { color: colors.text },
});
