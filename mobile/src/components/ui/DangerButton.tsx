import { BaseButton } from '@/components/ui/BaseButton';
import type { ButtonProps } from '@/components/ui/BaseButton';
import { colors } from '@/theme/tokens';

export function DangerButton(props: ButtonProps) {
    return (
        <BaseButton
            {...props}
            background="transparent"
            border={colors.danger}
            textColor={colors.danger}
        />
    );
}
