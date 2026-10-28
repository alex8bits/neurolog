/**
 * Отправка записей через очередь и досылка outbox. Все сетевые попытки
 * (recordSeizure и flush) идут под одним замком: один элемент никогда не
 * отправляется двумя параллельными POST. Вызов во время работы не стартует
 * второй проход, а заказывает ещё один после текущего.
 */

import * as Crypto from 'expo-crypto';

import { createSeizure } from '@/api/seizures';
import type { Seizure } from '@/api/types';
import { deviceTimezone } from '@/config/timezone';
import { runFlushPass, sendOne } from '@/offline/flushCore';
import type { FlushDeps, SendItem } from '@/offline/flushCore';
import {
    addSyncedSeizure,
    enqueueOutbox,
    getSnapshot,
    loadStore,
    markOutboxFailed,
    removeOutbox,
    subscribe,
} from '@/offline/journalStore';
import type { OutboxItem } from '@/offline/types';
import type { ApiError } from '@/utils/errors';

/**
 * Исход recordSeizure:
 * - sent — сервер принял запись (2xx), она уже в кэше журнала;
 * - queued — запись сохранена на устройстве и уйдёт при досылке;
 * - rejected — 422, ошибки для формы; запись из очереди уже снята;
 * - unavailable — локальный стор так и не загрузился (нет владельца /
 *   сбой чтения за STORE_WAIT_MS): запись НЕ сохранена, экран показывает
 *   общий текст ошибки.
 */
export type RecordResult =
    | { kind: 'sent'; seizure: Seizure }
    | { kind: 'queued'; clientId: string }
    | { kind: 'rejected'; error: ApiError }
    | { kind: 'unavailable' };

export interface RecordInput {
    occurredAt: Date;
    comment: string | null;

    /** Email текущего пользователя. Задан — запись ждёт стор именно этого
     *  владельца: после истёкшей сессии A и входа под B экран может
     *  позвать recordSeizure раньше, чем провайдер загрузит стор B, и без
     *  проверки запись ушла бы в очередь A (и стёрлась бы при loadOwner(B)). */
    owner?: string;
}

const send: SendItem = (item) =>
    createSeizure({
        client_id: item.client_id,
        occurred_at: item.occurred_at,
        timezone: item.timezone,
        ...(item.comment === null ? {} : { comment: item.comment }),
    });

/** Идущая загрузка стора (loadOwner) и её владелец. */
let loading: Promise<void> | null = null;

let loadingEmail: string | null = null;

const sameEmail = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

/** Сколько recordSeizure ждёт загрузки стора на холодном старте. */
const STORE_WAIT_MS = 10_000;

/**
 * Ждёт, пока стор станет loaded (а при заданном owner — загружен именно
 * для этого владельца). Нужен на холодном старте и после смены аккаунта:
 * эффекты экрана (/quick) срабатывают раньше эффекта корневого
 * провайдера, который запускает loadOwner. false — не дождались за
 * timeoutMs.
 */
function waitForStore(timeoutMs: number, owner?: string): Promise<boolean> {
    const ready = (): boolean => {
        const snapshot = getSnapshot();

        if (!snapshot.loaded) {
            return false;
        }

        return (
            owner === undefined ||
            (snapshot.owner !== null && sameEmail(snapshot.owner, owner))
        );
    };

    if (ready()) {
        return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
        const finish = (ready: boolean) => {
            clearTimeout(timer);
            unsubscribe();
            resolve(ready);
        };

        const timer = setTimeout(() => finish(false), timeoutMs);

        const unsubscribe = subscribe(() => {
            if (ready()) {
                finish(true);
            }
        });
    });
}

/**
 * Загружает стор для владельца; повтор для уже загруженного владельца —
 * без перечитывания. Вызывается ConnectivityProvider при входе.
 */
export function loadOwner(email: string): Promise<void> {
    if (isLoadedFor(email)) {
        return Promise.resolve();
    }

    // Загрузка того же владельца уже идёт — новый loadStore поднял бы
    // поколение и оборвал её. Но её мог обесценить clearStore (выход и
    // сразу вход тем же email): тогда после ожидания стор не загружен —
    // запускаем загрузку заново, один раз.
    if (
        loading !== null &&
        loadingEmail !== null &&
        sameEmail(loadingEmail, email)
    ) {
        const pending = loading;

        return pending.then(() => {
            if (isLoadedFor(email)) {
                return;
            }

            if (loading !== null) {
                // Перезагрузку того же email уже запустил другой ждавший —
                // ждём её. Идёт загрузка другого email (выход и вход под
                // другим аккаунтом) — этот вызов неактуален, не обрываем её.
                return loadingEmail !== null && sameEmail(loadingEmail, email)
                    ? loading
                    : undefined;
            }

            return startLoad(email);
        });
    }

    return startLoad(email);
}

function isLoadedFor(email: string): boolean {
    const snapshot = getSnapshot();

    return (
        snapshot.loaded &&
        snapshot.owner !== null &&
        sameEmail(snapshot.owner, email)
    );
}

function startLoad(email: string): Promise<void> {
    const promise = loadStore(email).finally(() => {
        if (loading === promise) {
            loading = null;
            loadingEmail = null;
        }
    });

    loading = promise;
    loadingEmail = email;

    return promise;
}

/** Мутаторы стора, привязанные к владельцу на момент старта: если стор
 *  выгрузили или сменили владельца, мутация бросает и проход останавливается
 *  (чужая запись не попадёт в кэш нового пользователя). */
function boundDeps(owner: string): FlushDeps {
    const guard = () => {
        const snapshot = getSnapshot();

        if (!snapshot.loaded || snapshot.owner !== owner) {
            throw new Error('sync: владелец стора сменился');
        }
    };

    return {
        send,
        getItems: () => {
            const snapshot = getSnapshot();

            return snapshot.loaded && snapshot.owner === owner
                ? (snapshot.outbox?.items ?? [])
                : [];
        },
        addSynced: async (seizure) => {
            guard();
            await addSyncedSeizure(seizure);
        },
        remove: async (clientId) => {
            guard();
            await removeOutbox(clientId);
        },
        markFailed: async (clientId, error) => {
            guard();
            await markOutboxFailed(clientId, error);
        },
    };
}

/** Общий замок сетевых попыток; резолвится после всех заказанных проходов. */
let active: Promise<void> | null = null;

/** Во время работы позвали flush()/recordSeizure — нужен ещё проход. */
let rerunRequested = false;

async function pass(): Promise<void> {
    const snapshot = getSnapshot();

    if (!snapshot.loaded || snapshot.owner === null) {
        return;
    }

    if ((snapshot.outbox?.items.length ?? 0) === 0) {
        return;
    }

    await runFlushPass(boundDeps(snapshot.owner));
}

/** Берёт замок: first(), затем столько проходов, сколько заказали. */
function runLocked(first: () => Promise<void>): Promise<void> {
    const run = async () => {
        try {
            try {
                await first();
            } catch (error) {
                console.warn('sync: попытка отправки не удалась', error);
            }

            while (rerunRequested) {
                rerunRequested = false;

                try {
                    await pass();
                } catch (error) {
                    console.warn('sync: проход очереди не удался', error);
                }
            }
        } finally {
            // Синхронно с выходом из цикла: flush(), позванный после этой
            // точки, уже возьмёт замок заново, а не «заказ» в пустоту.
            active = null;
        }
    };

    active = run();

    return active;
}

/**
 * Досылка очереди (single-flight). Если проход уже идёт — заказывает ещё
 * один и возвращает общий промис: он резолвится, когда завершены и
 * текущий, и заказанный проходы. Никогда не отклоняется.
 */
export function flush(): Promise<void> {
    if (active !== null) {
        rerunRequested = true;

        return active;
    }

    return runLocked(pass);
}

function hasQueued(owner: string, exceptClientId: string): boolean {
    return boundDeps(owner)
        .getItems()
        .some(
            (item) =>
                item.state === 'queued' && item.client_id !== exceptClientId,
        );
}

/** Исход записи, которую отправляла досылка: снята из очереди и есть в
 *  кэше — sent; иначе (не дошла, 422, сменился владелец) — queued. */
function settledResult(owner: string, clientId: string): RecordResult {
    const snapshot = getSnapshot();
    const queued: RecordResult = { kind: 'queued', clientId };

    if (!snapshot.loaded || snapshot.owner !== owner) {
        return queued;
    }

    if (snapshot.outbox?.items.some((item) => item.client_id === clientId)) {
        return queued;
    }

    const seizure = snapshot.cache?.seizures.find(
        (candidate) => candidate.client_id === clientId,
    );

    return seizure === undefined ? queued : { kind: 'sent', seizure };
}

/**
 * Записывает приступ: сначала в outbox на диск, затем одна попытка
 * отправить именно эту запись. 2xx — sent, 422 — rejected (запись снята),
 * прочее — queued (уйдёт следующим flush). Если досылка уже идёт (старт
 * приложения, возврат в него, загрузка журнала) — заказывает ещё проход и
 * ждёт его: запись уходит этой досылкой, и при связи ответ — sent, а не
 * преждевременное «сохранено на устройстве». С input.owner запись ждёт
 * стор этого владельца (см. RecordInput.owner).
 */
export async function recordSeizure(input: RecordInput): Promise<RecordResult> {
    if (!(await waitForStore(STORE_WAIT_MS, input.owner))) {
        return { kind: 'unavailable' };
    }

    const clientId = Crypto.randomUUID();
    const item: Omit<OutboxItem, 'local_seq' | 'state' | 'created_at'> = {
        client_id: clientId,
        occurred_at: input.occurredAt.toISOString(),
        timezone: deviceTimezone(),
        comment: input.comment,
    };

    try {
        await enqueueOutbox(item);
    } catch (error) {
        // Стор выгрузили между ожиданием и записью (выход/смена владельца)
        // или запись на диск не удалась — на устройстве записи нет.
        console.warn('sync: запись не сохранена в очередь', error);

        return { kind: 'unavailable' };
    }

    const queued: RecordResult = { kind: 'queued', clientId };
    const owner = getSnapshot().owner;

    if (owner === null) {
        return queued;
    }

    const ownerAtStart: string = owner;

    if (active !== null) {
        rerunRequested = true;
        await active;

        return settledResult(ownerAtStart, clientId);
    }

    return new Promise<RecordResult>((resolve) => {
        const attempt = async (): Promise<void> => {
            const deps = boundDeps(ownerAtStart);
            const current = deps
                .getItems()
                .find((candidate) => candidate.client_id === clientId);

            if (current === undefined) {
                resolve(queued);

                return;
            }

            const outcome = await sendOne(send, current);

            try {
                if (outcome.kind === 'sent') {
                    await deps.addSynced(outcome.seizure);
                    await deps.remove(clientId);
                    resolve({ kind: 'sent', seizure: outcome.seizure });

                    // Связь есть — заодно дослать то, что ждало в очереди.
                    if (hasQueued(ownerAtStart, clientId)) {
                        rerunRequested = true;
                    }

                    return;
                }

                if (outcome.kind === 'rejected') {
                    await deps.remove(clientId);
                    resolve({ kind: 'rejected', error: outcome.error });

                    return;
                }
            } catch (error) {
                console.warn('sync: стор не принял результат отправки', error);
            }

            resolve(queued);
        };

        void runLocked(async () => {
            try {
                await attempt();
            } finally {
                // Страховка: промис не повисает при любом исходе попытки
                // (повторный resolve игнорируется).
                resolve(queued);
            }
        });
    });
}
