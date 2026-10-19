import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';

import { colors, fontFamily, radius, spacing } from '@/theme/tokens';

type Props = TextInputProps & {
    label: string;
    error?: string | null;
    containerStyle?: StyleProp<ViewStyle>;
};

/** Поле с рамкой 1.5 и ярлыком-подписью внутри; ошибка — под полем. */
export function TextField({
    label,
    error,
    containerStyle,
    onFocus,
    onBlur,
    style,
    ...rest
}: Props) {
    const [focused, setFocused] = useState(false);

    return (
        <View style={[styles.wrap, containerStyle]}>
            <View
                style={[
                    styles.field,
                    focused && styles.focused,
                    !!error && styles.errored,
                ]}
            >
                <Text style={styles.label}>{label}</Text>
                <TextInput
                    placeholderTextColor={colors.muted}
                    {...rest}
                    onFocus={(e) => {
                        setFocused(true);
                        onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setFocused(false);
                        onBlur?.(e);
                    }}
                    style={[styles.input, style]}
                />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginBottom: spacing.sm + 2 },
    field: {
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.line,
        borderRadius: radius.control,
        paddingHorizontal: spacing.lg - 2,
        paddingVertical: spacing.sm + 2,
    },
    focused: { borderColor: colors.primary },
    errored: { borderColor: colors.danger },
    label: {
        fontFamily: fontFamily.bold,
        fontSize: 11,
        lineHeight: 14,
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.44,
    },
    input: {
        fontFamily: fontFamily.semibold,
        fontSize: 16,
        color: colors.text,
        paddingVertical: 2,
        paddingHorizontal: 0,
    },
    error: {
        fontFamily: fontFamily.semibold,
        fontSize: 12,
        lineHeight: 16,
        color: colors.danger,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    },
});
