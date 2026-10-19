import { useRouter } from 'expo-router';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Seizure } from '@/api/types';
import { rowTimeLabel } from '@/components/journal/SeizureRow';
import { AppText } from '@/components/ui/AppText';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import { formatLocalDateTime, parseUtcIso } from '@/utils/time';

type Props = {
    visible: boolean;
    seizure: Seizure | null;
    onClose: () => void;
    /** Вызывается после подтверждения «Удалить» в Alert. */
    onDelete: (seizure: Seizure) => void;
};

/** «10.05.2026» из локальной даты записи. */
function dateLabel(occurredAt: string): string {
    return parseUtcIso(occurredAt) !== null
        ? formatLocalDateTime(occurredAt).split(', ')[0]
        : '';
}

/** Нижняя шторка действий над записью: изменить время, комментарий, удалить. */
export function ActionSheet({ visible, seizure, onClose, onDelete }: Props) {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    function edit(target: Seizure, focus?: 'comment'): void {
        onClose();
        router.push({
            pathname: '/edit',
            params: {
                id: String(target.id),
                occurredAt: target.occurred_at,
                comment: target.comment ?? '',
                ...(focus !== undefined ? { focus } : {}),
            },
        });
    }

    function confirmDelete(target: Seizure): void {
        onClose();
        Alert.alert('Удалить запись?', 'Действие нельзя отменить.', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Удалить',
                style: 'destructive',
                onPress: () => {
                    onDelete(target);
                },
            },
        ]);
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                style={styles.overlay}
                onPress={onClose}
            >
                {/* Внутренний Pressable без onPress гасит тап сквозь шторку. */}
                <Pressable
                    accessibilityViewIsModal
                    style={[
                        styles.sheet,
                        { paddingBottom: insets.bottom + spacing.lg },
                    ]}
                >
                    {seizure !== null ? (
                        <>
                            <View style={styles.head}>
                                <AppText style={styles.title}>
                                    {rowTimeLabel(seizure.occurred_at)}
                                </AppText>
                                <AppText color="muted" variant="label">
                                    {dateLabel(seizure.occurred_at)}
                                </AppText>
                            </View>
                            <Item
                                label="Изменить время"
                                onPress={() => edit(seizure)}
                            />
                            <Item
                                label="Добавить / изменить комментарий"
                                onPress={() => edit(seizure, 'comment')}
                            />
                            <Item
                                label="Удалить запись"
                                danger
                                onPress={() => confirmDelete(seizure)}
                            />
                        </>
                    ) : null}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function Item({
    label,
    danger = false,
    onPress,
}: {
    label: string;
    danger?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={styles.item}
        >
            <AppText
                color={danger ? 'danger' : 'text'}
                style={styles.itemLabel}
            >
                {label}
            </AppText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    overlay: {
        backgroundColor: colors.overlay,
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.modal,
        borderTopRightRadius: radius.modal,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
    },
    head: { gap: 2, paddingBottom: spacing.md },
    title: { fontFamily: fontFamily.extrabold, fontSize: 22, lineHeight: 28 },
    item: {
        borderTopColor: colors.line,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingVertical: spacing.lg,
    },
    itemLabel: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22 },
});
