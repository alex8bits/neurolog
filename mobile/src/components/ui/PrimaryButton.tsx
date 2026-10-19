import { BaseButton } from '@/components/ui/BaseButton';
import type { ButtonProps } from '@/components/ui/BaseButton';
import { colors } from '@/theme/tokens';

export function PrimaryButton(props: ButtonProps) {
    return (
        <BaseButton
            {...props}
            background={colors.primary}
            border={colors.primary}
            textColor={colors.white}
        />
    );
}
