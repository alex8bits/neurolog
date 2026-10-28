/**
 * Локальный стор журнала: in-memory зеркало journal-cache.json и
 * outbox.json с pub/sub (по образцу onSessionExpired в api/client.ts).
 * Экраны читают его через useJournalStore(). Каждый мутатор сразу меняет
 * состояние и уведомляет подписчиков, а запись файла ставит в общую
 * цепочку промисов — параллельные мутации не перетирают друг друга.
 */

import { useSyncExternalStore } from 'react';

import type { Seizure } from '@/api/types';
import {
    removeSeizure,
    replaceWindow,
    upsertSeizure,
} from '@/offline/journalCache';
import { emptyOutbox, enqueue, markFailed, removeItem } from '@/offline/outbox';
import {
    backupCorrupt,
    backupForeign,
    fileExists,
    JOURNAL_CACHE_FILE,
    OUTBOX_FILE,
    readJson,
    removeFile,
    writeJsonAtomic,
} from '@/offline/storage';
import type { JournalCacheFile, OutboxFile, OutboxItem } from '@/offline/types';

export interface JournalStoreState {
    loaded: boolean;
    owner: string | null;
    cache: JournalCacheFile | null;
    outbox: OutboxFile | null;
}

type Listener = () => void;

const EMPTY_STATE: JournalStoreState = {
    loaded: false,
    owner: null,
    cache: null,
    outbox: null,
};

let state: JournalStoreState = EMPTY_STATE;

const listeners = new Set<Listener>();

/** Хвост цепочки дисковых операций; ошибки звена не рвут цепочку. */
let chain: Promise<void> = Promise.resolve();

function serialize(task: () => Promise<void>): Promise<void> {
    const run = chain.then(task);

    chain = run.catch((error: unknown) => {
        console.warn('journalStore: дисковая операция не удалась', error);
    });

    return run;
}

function setState(next: JournalStoreState): void {
    state = next;

    for (const listener of listeners) {
        listener();
    }
}

const sameOwner = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

const emptyCache = (owner: string): JournalCacheFile => ({
    version: 1,
    owner,
    synced_at: null,
    seizures: [],
});

function isCacheFile(value: unknown): value is JournalCacheFile {
    const file = value as JournalCacheFile | null;

    return (
        typeof file === 'object' &&
        file !== null &&
        file.version === 1 &&
        typeof file.owner === 'string' &&
        Array.isArray(file.seizures)
    );
}

function isOutboxFile(value: unknown): value is OutboxFile {
    const file = value as OutboxFile | null;

    return (
        typeof file === 'object' &&
        file !== null &&
        file.version === 1 &&
        typeof file.owner === 'string' &&
        typeof file.next_seq === 'number' &&
        Array.isArray(file.items)
    );
}

/** Загруженное состояние для мутаторов; до loadStore мутации отклоняются
 *  (мутаторы async — исключение превращается в отклонённый промис). */
function requireLoaded(): {
    owner: string;
    cache: JournalCacheFile;
    outbox: OutboxFile;
} {
    if (
        !state.loaded ||
        state.owner === null ||
        state.cache === null ||
        state.outbox === null
    ) {
        throw new Error('journalStore: стор не загружен (нужен loadStore)');
    }

    return { owner: state.owner, cache: state.cache, outbox: state.outbox };
}

function commitCache(cache: JournalCacheFile): Promise<void> {
    setState({ ...state, cache });

    return serialize(() => writeJsonAtomic(JOURNAL_CACHE_FILE, cache));
}

function commitOutbox(outbox: OutboxFile): Promise<void> {
    setState({ ...state, outbox });

    return serialize(() => writeJsonAtomic(OUTBOX_FILE, outbox));
}

/**
 * Поколение загрузки: растёт на каждом loadStore/clearStore. Загрузка,
 * после начала которой был clearStore или более новый loadStore, своё
 * состояние не применяет.
 */
let epoch = 0;

/**
 * Читает оба файла владельца owner. Владелец проверяется по каждому файлу
 * отдельно: удаляется только файл с чужим email (чужие данные не
 * показываются; непустая чужая очередь перед удалением сохраняется копией
 * `.foreign-<ts>`), файл текущего владельца не трогается. Нечитаемая очередь
 * перед удалением всегда сохраняется копией `.corrupt-<ts>`; нечитаемый
 * кэш — просто пустой (перезагрузится онлайн). Сбой копии `.foreign` /
 * `.corrupt` намеренно обрывает загрузку (стор остаётся не загружен):
 * удалять очередь без копии нельзя. До окончания загрузки стор
 * выгружен — мутации прежнего владельца отклоняются.
 */
export function loadStore(owner: string): Promise<void> {
    epoch += 1;
    const myEpoch = epoch;

    setState({ loaded: false, owner, cache: null, outbox: null });

    return serialize(async () => {
        if (myEpoch !== epoch) {
            return;
        }

        const rawCache = await readJson<unknown>(JOURNAL_CACHE_FILE);
        const rawOutbox = await readJson<unknown>(OUTBOX_FILE);

        let cache = isCacheFile(rawCache) ? rawCache : null;
        let outbox = isOutboxFile(rawOutbox) ? rawOutbox : null;

        if (cache !== null && !sameOwner(cache.owner, owner)) {
            removeFile(JOURNAL_CACHE_FILE);
            cache = null;
        }

        if (outbox === null) {
            if (fileExists(OUTBOX_FILE)) {
                await backupCorrupt(OUTBOX_FILE);
                removeFile(OUTBOX_FILE);
            }
        } else if (!sameOwner(outbox.owner, owner)) {
            // Непустая очередь чужого владельца — копия перед удалением
            // (сбой переименования при смене email не должен молча стереть
            // неотправленные записи). Пустую удаляем как есть.
            if (outbox.items.length > 0) {
                await backupForeign(OUTBOX_FILE);
            }

            removeFile(OUTBOX_FILE);
            outbox = null;
        }

        if (myEpoch !== epoch) {
            return;
        }

        setState({
            loaded: true,
            owner,
            cache: cache ?? emptyCache(owner),
            outbox: outbox ?? emptyOutbox(owner),
        });
    });
}

/**
 * Свежий ответ сервера за окно 30 дней целиком заменяет снимок. today —
 * момент, для которого запрашивали окно (по умолчанию — сейчас).
 */
export async function setWindowSnapshot(
    fresh: Seizure[],
    today: Date = new Date(),
): Promise<void> {
    const { cache } = requireLoaded();

    return commitCache({
        ...cache,
        synced_at: today.toISOString(),
        seizures: replaceWindow(cache.seizures, fresh, today),
    });
}

/** Запись, принятая сервером (201 / PATCH), — в снимок. */
export async function addSyncedSeizure(seizure: Seizure): Promise<void> {
    const { cache } = requireLoaded();

    return commitCache({
        ...cache,
        seizures: upsertSeizure(cache.seizures, seizure, new Date()),
    });
}

/** Запись удалена на сервере — убрать из снимка. */
export async function removeCachedSeizure(id: number): Promise<void> {
    const { cache } = requireLoaded();

    return commitCache({
        ...cache,
        seizures: removeSeizure(cache.seizures, id),
    });
}

/** Новая запись в очередь (local_seq, state, created_at ставятся здесь). */
export async function enqueueOutbox(
    item: Omit<OutboxItem, 'local_seq' | 'state' | 'created_at'>,
): Promise<void> {
    const { outbox } = requireLoaded();

    return commitOutbox(enqueue(outbox, item, new Date()));
}

/** Запись принята сервером или удалена пользователем — снять из очереди. */
export async function removeOutbox(clientId: string): Promise<void> {
    const { outbox } = requireLoaded();

    return commitOutbox(removeItem(outbox, clientId));
}

/** Сервер отверг запись (422) — оставить в очереди с пометкой. */
export async function markOutboxFailed(
    clientId: string,
    error: string,
): Promise<void> {
    const { outbox } = requireLoaded();

    return commitOutbox(markFailed(outbox, clientId, error));
}

/**
 * Пользователь сменил email в профиле — данные остаются его. Очередь
 * пишется первой: если процесс умрёт между записями, с чужим (старым)
 * email останется только кэш, а его loadStore удалит без потери данных
 * (окно перезагрузится онлайн).
 */
export async function renameOwner(email: string): Promise<void> {
    const { cache, outbox } = requireLoaded();
    const nextCache = { ...cache, owner: email };
    const nextOutbox = { ...outbox, owner: email };

    setState({ ...state, owner: email, cache: nextCache, outbox: nextOutbox });

    return serialize(async () => {
        await writeJsonAtomic(OUTBOX_FILE, nextOutbox);
        await writeJsonAtomic(JOURNAL_CACHE_FILE, nextCache);
    });
}

/** Явный выход: стереть кэш и очередь с диска и из памяти. */
export function clearStore(): Promise<void> {
    epoch += 1;
    setState(EMPTY_STATE);

    return serialize(async () => {
        removeFile(JOURNAL_CACHE_FILE);
        removeFile(OUTBOX_FILE);
    });
}

/** Подписка на изменения; возвращает функцию отписки. */
export function subscribe(listener: Listener): () => void {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

export function getSnapshot(): JournalStoreState {
    return state;
}

/** Реактивное состояние стора для экранов. */
export function useJournalStore(): JournalStoreState {
    return useSyncExternalStore(subscribe, getSnapshot);
}
