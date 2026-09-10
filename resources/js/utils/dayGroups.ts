/**
 * Группировка записей веб-журнала по календарным дням. Порт
 * `mobile/src/utils/dayGroups.ts` — форматы заголовков («7 сентября»,
 * «3 приступа») обязаны дословно совпадать с приложением, поэтому месяцы
 * родительного падежа и плюрализация скопированы буквально, а не через
 * Intl.
 *
 * День записи уже машинный: `occurred_at_local` приходит от сервера в поясе
 * профиля ('Y-m-d\TH:i'), так что ключ группы — slice(0, 10) без Date и
 * таймзонных пересчётов.
 */

import type { SeizureRow } from '@/types/journal';

/** Группа «один календарный день»: key — `Y-m-d`, записи — в порядке
 *  сервера (occurred_at DESC, id DESC). */
export interface DayGroup {
    key: string;
    rows: SeizureRow[];
}

/** Родительный падеж месяцев заголовка: «7 сентября». Буквальный порт из
 *  mobile/src/utils/dayGroups.ts — заголовок веба обязан совпадать с
 *  приложением, Intl тут только добавил бы расхождений. */
const MONTHS_GENITIVE = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
];

/**
 * Схлопывает последовательные записи одного дня в группы. Порядок групп и
 * записей внутри — как пришло от сервера, на клиенте не пересортировываем.
 * Пустой вход — пустой массив.
 */
export function groupRowsByDay(rows: SeizureRow[]): DayGroup[] {
    const groups: DayGroup[] = [];

    for (const row of rows) {
        const key = row.occurred_at_local.slice(0, 10);
        const last = groups.at(-1);

        if (last !== undefined && last.key === key) {
            last.rows.push(row);

            continue;
        }

        groups.push({ key, rows: [row] });
    }

    return groups;
}

/**
 * Заголовок группы «7 сентября»; год дописывается только для не-текущего —
 * свежие дни журнала читаются без шума повторяющихся цифр. Сравнивается
 * только год (slice(0, 4)), как в мобильном formatDayTitle.
 */
export function formatDayTitle(key: string, todayYmd: string): string {
    // key уже Y-m-d — парсим как числа, Date и таймзоны не нужны.
    const [year, month, day] = key.split('-').map(Number);
    const base = `${day} ${MONTHS_GENITIVE[month - 1]}`;

    if (key.slice(0, 4) !== todayYmd.slice(0, 4)) {
        return `${base} ${year}`;
    }

    return base;
}

/**
 * Существительное после числительного для заголовка группы: 1/21 приступ,
 * 2–4/22–24 приступа, 5–20/25+ приступов — классические правила
 * русского склонения.
 */
export function pluralizeSeizures(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return 'приступ';
    }

    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
        return 'приступа';
    }

    return 'приступов';
}

/**
 * Текущая дата как `Y-m-d`. Пояс профиля (auth.user.timezone) передавай
 * явно: семантика «сегодня» обязана совпадать с серверным фильтром журнала
 * (пояс профиля), а не с поясом браузера. Локаль sv-SE — известный приём
 * получить из Intl готовый YYYY-MM-DD; без пояса берётся локальная дата
 * браузера тем же приёмом.
 */
export function todayYmd(timeZone?: string): string {
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };

    if (timeZone !== undefined) {
        options.timeZone = timeZone;
    }

    return new Intl.DateTimeFormat('sv-SE', options).format(new Date());
}
