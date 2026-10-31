import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MedicationName } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
    visible: boolean;
    names: MedicationName[];
    loading: boolean;
    /** Текст ошибки загрузки справочника. */
    error: string | null;
    selectedId: number | null;
    onSelect: (entry: MedicationName) => void;
    /** Введённое название (trim). */
    onAddNew: (name: string) => void;
    onClose: () => void;
};

const lower = (value: string): string => value.toLocaleLowerCase('ru');

/** Модалка; содержимое монтируется при каждом открытии — поиск сбрасывается. */
export function MedicationNamePicker(props: Props) {
    return (
        <Modal
            visible={props.visible}
            transparent
            animationType="slide"
            onRequestClose={props.onClose}
        >
            {props.visible ? <PickerSheet {...props} /> : null}
        </Modal>
    );
}

function PickerSheet({
    names,
    loading,
    error,
    selectedId,
    onSelect,
    onAddNew,
    onClose,
}: Props) {
    const insets = useSafeAreaInsets();
    const [search, setSearch] = useState('');

    const trimmed = search.trim();

    const filtered = useMemo(() => {
        const needle = lower(trimmed);

        if (needle === '') {
            return names;
        }

        return names.filter((entry) => lower(entry.name).includes(needle));
    }, [names, trimmed]);

    const canAdd = useMemo(() => {
        if (trimmed === '') {
            return false;
        }

        const needle = lower(trimmed);

        return !names.some((entry) => lower(entry.name) === needle);
    }, [names, trimmed]);

    const showEmpty = !loading && names.length === 0 && trimmed === '';

    return (
        <>
            <View style={styles.backdrop}>
                <View
                    style={[
                        styles.sheet,
                        { paddingBottom: insets.bottom + spacing.lg },
                    ]}
                >
                    <View style={styles.header}>
                        <AppText variant="heading">Лекарство</AppText>
                        <Pressable
                            accessibilityRole="button"
                            style={styles.cancel}
                            onPress={onClose}
                        >
                            <AppText variant="label" color="primary">
                                Отмена
                            </AppText>
                        </Pressable>
                    </View>
                    <TextField
                        label="Поиск"
                        value={search}
                        onChangeText={setSearch}
                        accessibilityLabel="Поиск лекарства"
                        autoCorrect={false}
                        containerStyle={styles.search}
                    />
                    {error !== null ? (
                        <AppText
                            variant="caption"
                            color="danger"
                            style={styles.note}
                        >
                            {error}
                        </AppText>
                    ) : null}
                    {loading ? (
                        <AppText
                            variant="caption"
                            color="muted"
                            style={styles.note}
                        >
                            Загружаем справочник…
                        </AppText>
                    ) : null}
                    {canAdd ? (
                        <Pressable
                            accessibilityRole="button"
                            style={styles.row}
                            onPress={() => {
                                onAddNew(trimmed);
                            }}
                        >
                            <AppText variant="body" color="primary">
                                {`Добавить «${trimmed}»`}
                            </AppText>
                        </Pressable>
                    ) : null}
                    {showEmpty ? (
                        <AppText
                            variant="caption"
                            color="muted"
                            style={styles.note}
                        >
                            Справочник пуст. Введите название, чтобы добавить.
                        </AppText>
                    ) : null}
                    <FlatList
                        style={styles.list}
                        data={filtered}
                        keyExtractor={(entry) => String(entry.id)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => {
                            const selected = item.id === selectedId;

                            return (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    style={styles.row}
                                    onPress={() => {
                                        onSelect(item);
                                    }}
                                >
                                    <AppText
                                        variant="body"
                                        color={selected ? 'primary' : 'text'}
                                    >
                                        {item.name}
                                        {selected ? ' ✓' : ''}
                                    </AppText>
                                </Pressable>
                            );
                        }}
                    />
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        backgroundColor: colors.overlay,
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
        height: '80%',
        paddingTop: spacing.lg,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.xxl,
    },
    cancel: {
        justifyContent: 'center',
        minHeight: 44,
    },
    search: {
        marginBottom: spacing.sm,
        marginHorizontal: spacing.xxl,
    },
    note: {
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.sm,
    },
    list: {
        flex: 1,
    },
    row: {
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.md,
    },
});
