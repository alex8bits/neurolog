import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { fontFamily, radius, spacing } from '@/theme/tokens';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
    title: string;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
};

type BaseProps = ButtonProps & {
    background: string;
    border: string;
    textColor: string;
};

/** Общая основа кнопок: радиус 10, рамка 1.5, текст 14/700. */
export function BaseButton({
    title,
    loading = false,
    disabled,
    style,
    background,
    border,
    textColor,
    ...rest
}: BaseProps) {
    const inactive = disabled || loading;

    return (
        <Pressable
            accessibilityRole="button"
            {...rest}
            disabled={inactive}
            style={({ pressed }) => [
                styles.base,
                { backgroundColor: background, borderColor: border },
                pressed && styles.pressed,
                inactive && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={textColor} />
            ) : (
                <Text style={[styles.title, { color: textColor }]}>
                    {title}
                </Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        minHeight: 44,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.control,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20 },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.5 },
});
