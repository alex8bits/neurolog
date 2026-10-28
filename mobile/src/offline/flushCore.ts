/**
 * Ядро досылки очереди: исходы отправки и один проход по outbox. Чистый
 * модуль без импортов expo/React — отправка и мутаторы стора приходят
 * параметрами (sync.ts подставляет createSeizure и journalStore).
 */

import type { Seizure } from '@/api/types';
import type { OutboxItem } from '@/offline/types';
import { ApiError, RECORD_REJECTED_TEXT, userMessage } from '@/utils/errors';

/** Исход отправки одного элемента очереди. */
export type SendOutcome =
    | { kind: 'sent'; seizure: Seizure }
    // 422: сервер отверг запись — повтор не поможет.
    | { kind: 'rejected'; error: ApiError }
    // Нет связи, 401, 429, 5xx, неожиданный сбой — повторить позже.
    | { kind: 'retry'; error: unknown };

export type SendItem = (item: OutboxItem) => Promise<Seizure>;

/** Отправляет элемент и классифицирует результат; не бросает. */
export async function sendOne(
    send: SendItem,
    item: OutboxItem,
): Promise<SendOutcome> {
    try {
        return { kind: 'sent', seizure: await send(item) };
    } catch (error) {
        if (
            error instanceof ApiError &&
            (error.kind === 'validation' || error.kind === 'form')
        ) {
            return { kind: 'rejected', error };
        }

        return { kind: 'retry', error };
    }
}

/** Текст для элемента с state 'failed': первая ошибка поля с сервера,
 *  иначе общий текст по kind. */
export function rejectionText(error: ApiError): string {
    const first = Object.values(error.fieldErrors ?? {}).flat()[0];

    if (first) {
        return first;
    }

    return error.kind === 'form' ? RECORD_REJECTED_TEXT : userMessage(error);
}

export interface FlushDeps {
    send: SendItem;
    /** Текущие элементы очереди (читаются заново перед каждой отправкой). */
    getItems: () => readonly OutboxItem[];
    addSynced: (seizure: Seizure) => Promise<void>;
    remove: (clientId: string) => Promise<void>;
    markFailed: (clientId: string, error: string) => Promise<void>;
}

/** 'done' — очередь пройдена до конца; 'stopped' — проход прерван
 *  (нет связи, сессия, 429/5xx или сбой стора), остаток ждёт триггера. */
export type FlushPassResult = 'done' | 'stopped';

/**
 * Один проход: элементы со state 'queued' по local_seq по возрастанию.
 * 2xx — в кэш и из очереди; 422 — пометить failed и идти дальше; прочее —
 * остановиться. Элемент, который успели снять из очереди (пользователь
 * удалил), пропускается.
 */
export async function runFlushPass(deps: FlushDeps): Promise<FlushPassResult> {
    const pending = deps
        .getItems()
        .filter((item) => item.state === 'queued')
        .sort((a, b) => a.local_seq - b.local_seq);

    try {
        for (const item of pending) {
            const current = deps
                .getItems()
                .find((candidate) => candidate.client_id === item.client_id);

            if (current === undefined || current.state !== 'queued') {
                continue;
            }

            const outcome = await sendOne(deps.send, current);

            if (outcome.kind === 'retry') {
                return 'stopped';
            }

            if (outcome.kind === 'sent') {
                await deps.addSynced(outcome.seizure);
                await deps.remove(current.client_id);
            } else {
                await deps.markFailed(
                    current.client_id,
                    rejectionText(outcome.error),
                );
            }
        }
    } catch {
        // Мутатор стора отклонён (стор выгружен / сменился владелец).
        return 'stopped';
    }

    return 'done';
}
