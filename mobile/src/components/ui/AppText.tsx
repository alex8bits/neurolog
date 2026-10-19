import { Text } from 'react-native';
import type { TextProps } from 'react-native';

import { colors, type } from '@/theme/tokens';
import type { TypeVariant } from '@/theme/tokens';
import type { Colors } from '@/theme/tokens';

type Props = TextProps & {
    variant?: TypeVariant;
    color?: keyof Colors;
};

export function AppText({
    variant = 'body',
    color = 'text',
    style,
    ...rest
}: Props) {
    return (
        <Text
            {...rest}
            style={[type[variant], { color: colors[color] }, style]}
        />
    );
}
