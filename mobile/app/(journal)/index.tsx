import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { deleteSeizure, listSeizures } from '@/api/seizures';
import type { Seizure } from '@/api/types';
import { deviceTimezone } from '@/config/timezone';
import { ApiError, userMessage } from '@/utils/errors';
import { formatLocalDateTime } from '@/utils/time';

const GENERIC_ERROR_TEXT = 'Сервер недоступен, попробуйте позже.';

/** Текст ошибки загрузки: сеть/сессия — из userMessage, прочее — общий. */
function loadErrorText(error: unknown): string {
    if (
        error instanceof ApiError &&
        (error.kind === 'network' || error.kind === 'unauthorized')
    ) {
        return userMessage(error);
    }

    return GENERIC_ERROR_TEXT;
}

/** Текст ошибки удаления: ApiError — по kind, неожиданное — общий. */
function deleteErrorText(error: unknown): string {
    return error instanceof ApiError ? userMessage(error) : GENERIC_ERROR_TEXT;
}

/**
 * Журнал — список приступов, маршрут «/» (владелец — группа (journal)).
 * Загрузка при фокусе экрана и по pull-to-refresh; порядок строк задаёт
 * сервер (occurred_at DESC, id DESC) — на клиенте не сортируем. Удаление —
 * long-press по строке с подтверждением через Alert. Гард корневого
 * layout сам уводит на логин при истечении сессии.
 */
export default function JournalScreen() {
    const router = useRouter();

    // null = первая загрузка не завершена: отличаем «грузим» от «пусто».
    const [items, setItems] = useState<Seizure[] | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [inlineError, setInlineError] = useState<string | null>(null);

    // Блокирует повторный запуск удаления той же строки.
    const [deletingId, setDeletingId] = useState<number | null>(null);

    /** Загрузка списка; при неудачном рефетче уже показанный список остаётся. */
    const load = useCallback(async (): Promise<void> => {
        setRefreshing(true);

        try {
            const response = await listSeizures(deviceTimezone());

            setItems(response.data);
            setLoadError(null);
        } catch (error) {
            // items не трогаем; не-ApiError тоже попадает в loadError —
            // рендер покажет для него общий текст.
            setLoadError(error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    // Один механизм на монтирование и возвраты из new/settings
    // (включая системный back) — вариант A дизайн-документа.
    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    /** Убирает запись из локального списка тем же фильтром по id. */
    function removeLocalItem(id: number): void {
        setItems((prev) =>
            prev === null ? prev : prev.filter((s) => s.id !== id),
        );
    }

    /** Подтверждение удаления: long-press по строке списка. */
    function confirmDelete(seizure: Seizure): void {
        Alert.alert('Удалить запись?', 'Действие нельзя отменить.', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Удалить',
                style: 'destructive',
                onPress: () => {
                    void removeSeizure(seizure.id);
                },
            },
        ]);
    }

    async function removeSeizure(id: number): Promise<void> {
        setDeletingId(id);
        setInlineError(null);

        try {
            await deleteSeizure(id);
            removeLocalItem(id);
        } catch (error) {
            if (error instanceof ApiError && error.kind === 'not_found') {
                // Записи уже нет на сервере — убираем локально.
                removeLocalItem(id);
            } else {
                // Сеть/5xx — инлайн-текст, запись остаётся в списке.
                setInlineError(deleteErrorText(error));
            }
        } finally {
            setDeletingId(null);
        }
    }

    // Шапка: «Настройки» и «+» идут на абсолютные typed routes
    // группы (journal).
    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Pressable
                    accessibilityRole="link"
                    style={styles.settingsLink}
                    onPress={() => {
                        router.push('/(journal)/settings');
                    }}
                >
                    <Text style={styles.linkLabel}>Настройки</Text>
                </Pressable>
                <Text style={styles.title}>Журнал</Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Новая запись"
                    style={styles.addButton}
                    onPress={() => {
                        router.push('/(journal)/new');
                    }}
                >
                    <Text style={styles.addLabel}>+</Text>
                </Pressable>
            </View>

            {items !== null && loadError !== null ? (
                <Text style={styles.inlineError}>
                    {loadErrorText(loadError)}
                </Text>
            ) : null}

            {inlineError !== null ? (
                <Text style={styles.inlineError}>{inlineError}</Text>
            ) : null}

            {items === null && loadError === null ? (
                <View style={styles.state}>
                    <Text style={styles.hint}>Загрузка…</Text>
                </View>
            ) : null}

            {items === null && loadError !== null ? (
                <View style={styles.state}>
                    <Text style={styles.stateError}>
                        {loadErrorText(loadError)}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.retry}
                        onPress={() => {
                            void load();
                        }}
                    >
                        <Text style={styles.retryLabel}>Повторить</Text>
                    </Pressable>
                </View>
            ) : null}

            {items !== null && items.length === 0 ? (
                <View style={styles.state}>
                    <Text style={styles.hint}>Приступов пока нет.</Text>
                </View>
            ) : null}

            {items !== null && items.length > 0 ? (
                <FlatList
                    data={items}
                    keyExtractor={(s) => String(s.id)}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                void load();
                            }}
                        />
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityHint="Долгое нажатие — удаление записи"
                            disabled={deletingId === item.id}
                            onLongPress={() => {
                                confirmDelete(item);
                            }}
                            style={[
                                styles.row,
                                deletingId === item.id && styles.rowDisabled,
                            ]}
                        >
                            <Text style={styles.rowDate}>
                                {formatLocalDateTime(item.occurred_at)}
                            </Text>
                            {item.comment !== null ? (
                                <Text
                                    numberOfLines={3}
                                    style={styles.rowComment}
                                >
                                    {item.comment}
                                </Text>
                            ) : null}
                        </Pressable>
                    )}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#fff',
        flex: 1,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 8,
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    settingsLink: {
        paddingVertical: 6,
    },
    linkLabel: {
        color: '#2f6fde',
        fontSize: 15,
    },
    title: {
        color: '#000',
        fontSize: 24,
        fontWeight: '600',
    },
    addButton: {
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    addLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    inlineError: {
        color: '#d32f2f',
        fontSize: 13,
        paddingHorizontal: 24,
        paddingVertical: 8,
    },
    state: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    hint: {
        color: '#333',
        fontSize: 16,
        textAlign: 'center',
    },
    stateError: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    retry: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingHorizontal: 32,
        paddingVertical: 12,
    },
    retryLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 24,
    },
    row: {
        borderBottomColor: '#eee',
        borderBottomWidth: 1,
        paddingVertical: 14,
    },
    rowDisabled: {
        opacity: 0.6,
    },
    rowDate: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    rowComment: {
        color: '#333',
        fontSize: 14,
        marginTop: 4,
    },
});
