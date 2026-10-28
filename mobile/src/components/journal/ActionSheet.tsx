import { useRouter } from 'expo-router';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { rowTimeLabel, syncLabel } from '@/components/journal/SeizureRow';
import { AppText } from '@/components/ui/AppText';
import type { JournalEntry } from '@/offline/types';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import { formatLocalDateTime, parseUtcIso } from '@/utils/time';

type Props = {
    visible: boolean;
    entry: JournalEntry | null;
    /** Есть связь с сервером: без неё серверные записи не меняются. */
    online: boolean;
    onClose: () => void;
    /** Вызывается после подтверждения «Удалить» в Alert. */
    onDelete: (entry: JournalEntry) => void;
};

/** «10.05.2026» из локальной даты записи. */
function dateLabel(occurredAt: string): string {
    return parseUtcIso(occurredAt) !== null
        ? formatLocalDateTime(occurredAt).split(', ')[0]
        : '';
}

/**
 * Нижняя шторка действий над записью: изменить время, комментарий, удалить.
 * Запись из очереди (не отправлена / не удалось сохранить) можно только
 * удалить с устройства; серверная запись без связи не меняется — пункты
 * неактивны, под ними подпись.
 */
export function ActionSheet({
    visible,
    entry,
    online,
    onClose,
    onDelete,
}: Props) {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    function edit(target: JournalEntry, focus?: 'comment'): void {
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

    function confirmDelete(target: JournalEntry): void {
        onClose();
        Alert.alert(
            target.sync !== 'synced'
                ? 'Удалить неотправленную запись?'
                : 'Удалить запись?',
            'Действие нельзя отменить.',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: () => {
                        onDelete(target);
                    },
                },
            ],
        );
    }

    const pending = entry !== null && entry.sync !== 'synced';
    const mark = entry !== null ? syncLabel(entry.sync) : null;
    // Серверная запись без связи: правка и удаление недоступны.
    const locked = entry !== null && !pending && !online;

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
                    {entry !== null ? (
                        <>
                            <View style={styles.head}>
                                <AppText style={styles.title}>
                                    {rowTimeLabel(entry.occurred_at)}
                                </AppText>
                                <AppText color="muted" variant="label">
                                    {dateLabel(entry.occurred_at)}
                                </AppText>
                                {mark !== null ? (
                                    <AppText color={mark.color} variant="label">
                                        {mark.text}
                                    </AppText>
                                ) : null}
                            </View>
                            {!pending ? (
                                <>
                                    <Item
                                        label="Изменить время"
                                        disabled={locked}
                                        onPress={() => edit(entry)}
                                    />
                                    <Item
                                        label="Добавить / изменить комментарий"
                                        disabled={locked}
                                        onPress={() => edit(entry, 'comment')}
                                    />
                                </>
                            ) : null}
                            <Item
                                label="Удалить запись"
                                danger
                                disabled={locked}
                                onPress={() => confirmDelete(entry)}
                            />
                            {locked ? (
                                <AppText
                                    color="muted"
                                    variant="label"
                                    style={styles.hint}
                                >
                                    Доступно при подключении к интернету
                                </AppText>
                            ) : null}
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
    disabled = false,
    onPress,
}: {
    label: string;
    danger?: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            style={[styles.item, disabled && styles.itemDisabled]}
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
    itemDisabled: { opacity: 0.4 },
    itemLabel: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22 },
    hint: { paddingBottom: spacing.sm, textAlign: 'center' },
});
