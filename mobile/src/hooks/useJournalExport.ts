import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import { emailSeizuresSelf, exportSeizuresDocx } from '@/api/seizures';
import type { ExportPeriodParams } from '@/api/types';
import { deviceTimezone } from '@/config/timezone';
import { actionErrorText } from '@/utils/errors';
import { periodToRange } from '@/utils/period';
import type { PeriodFilter } from '@/utils/period';

/** MIME DOCX-отчёта — expo-sharing передаёт его системному шарингу. */
const DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Сколько показывать итоговый значок «Отправить себе» (галочка/крест). */
const SELF_STATUS_RESET_MS = 5000;

/** Состояние кнопки «Отправить себе»; idle — значка нет. */
export type SelfStatus = 'idle' | 'sending' | 'ok' | 'fail';

/**
 * Экспорт журнала за период (DOCX / письмо себе / письмо доктору).
 * Период каждого действия — periodRef.current на момент нажатия, те же
 * timezone/from/to, что уходят в listSeizures. Подключается экраном «Отчёт».
 */
export function useJournalExport(periodRef: MutableRefObject<PeriodFilter>) {
    const router = useRouter();

    // Блокирует повторный запуск экспорта DOCX (скачивание + шаринг).
    const [docxSaving, setDocxSaving] = useState(false);

    // Текст ошибки экспорта DOCX для инлайн-показа под кнопками.
    const [actionError, setActionError] = useState<string | null>(null);

    // Кнопка «Отправить себе»: отправка — спиннер, результат — галочка/крест,
    // гаснут сами через SELF_STATUS_RESET_MS.
    const [selfStatus, setSelfStatus] = useState<SelfStatus>('idle');

    // Таймер авто-скрытия значка результата; переживать экран и новую
    // отправку он не должен.
    const selfStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // false после размонтирования: ответы запросов не пишут в state.
    const isMounted = useRef(true);

    function periodParams(): ExportPeriodParams {
        return {
            timezone: deviceTimezone(),
            ...(periodToRange(periodRef.current) ?? {}),
        };
    }

    /** «Поделиться DOCX»: отчёт за текущий период скачивается в файл и
     *  уходит в системный шаринг. На Android shareAsync резолвится запуском
     *  интента — закрытие шаринг-шита пользователем не попадает в catch. */
    async function saveDocx(): Promise<void> {
        if (docxSaving) {
            return;
        }

        setDocxSaving(true);
        setActionError(null);

        try {
            const { fileUri } = await exportSeizuresDocx(periodParams());

            await Sharing.shareAsync(fileUri, { mimeType: DOCX_MIME });
        } catch (error) {
            if (isMounted.current) {
                setActionError(actionErrorText(error));
            }
        } finally {
            if (isMounted.current) {
                setDocxSaving(false);
            }
        }
    }

    function clearSelfStatusTimer(): void {
        if (selfStatusTimer.current !== null) {
            clearTimeout(selfStatusTimer.current);
            selfStatusTimer.current = null;
        }
    }

    /** Показывает итоговый значок и планирует возврат в idle. */
    function showSelfStatus(status: 'ok' | 'fail'): void {
        if (!isMounted.current) {
            return;
        }

        setSelfStatus(status);

        clearSelfStatusTimer();
        selfStatusTimer.current = setTimeout(() => {
            setSelfStatus('idle');
            selfStatusTimer.current = null;
        }, SELF_STATUS_RESET_MS);
    }

    /** «Отправить себе»: письмо с отчётом текущего периода на email
     *  владельца; фидбек — значок на кнопке, без всплывающих окон. */
    async function sendSelf(): Promise<void> {
        if (selfStatus === 'sending') {
            return;
        }

        clearSelfStatusTimer();
        setActionError(null);
        setSelfStatus('sending');

        try {
            await emailSeizuresSelf(periodParams());
            showSelfStatus('ok');
        } catch {
            showSelfStatus('fail');
        }
    }

    /** «Отправить доктору»: экран-форма письма с периодом текущего фильтра;
     *  роут-параметры — строки: timezone всегда, from/to — только непустые. */
    function openEmailDoctor(): void {
        const { timezone, from, to } = periodParams();

        router.push({
            pathname: '/(journal)/email-doctor',
            params: {
                timezone,
                ...(from !== undefined ? { from } : {}),
                ...(to !== undefined ? { to } : {}),
            },
        });
    }

    // Таймер значка не должен пережить экран.
    useEffect(() => {
        isMounted.current = true;

        return () => {
            isMounted.current = false;
            clearSelfStatusTimer();
        };
    }, []);

    return {
        docxSaving,
        actionError,
        selfStatus,
        saveDocx,
        sendSelf,
        openEmailDoctor,
        periodParams,
        clearActionError: () => setActionError(null),
    };
}
