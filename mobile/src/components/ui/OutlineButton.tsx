import { BaseButton } from '@/components/ui/BaseButton';
import type { ButtonProps } from '@/components/ui/BaseButton';
import { colors } from '@/theme/tokens';

export function OutlineButton(props: ButtonProps) {
    return (
        <BaseButton
            {...props}
            background="transparent"
            border={colors.primary}
            textColor={colors.primary}
        />
    );
}
