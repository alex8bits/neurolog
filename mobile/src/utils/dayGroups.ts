/**
 * Группировка списка приступов по локальным календарным дням для журнала.
 * UI-слой остаётся тонким (PLAN.md §3: бизнес-логики в компонентах нет) —
 * ключ дня, заголовок и склонение считаются здесь и покрываются юнит-тестами.
 * Платформо-независимый модуль — без импортов React/RN (как time.ts).
 */

import type { Seizure } from '@/api/types';

import { formatYmd, parseUtcIso } from '@/utils/time';

/** Группа «один локальный календарный день»: key — `Y-m-d`, day — локальная
 *  полночь дня (сырьё для formatDayTitle), записи — в порядке сервера. */
export interface SeizureDayGroup<T extends Seizure = Seizure> {
    key: string;
    day: Date;
    count: number;
    items: T[];
}

/** Родительный падеж месяцев заголовка: «7 сентября». Вручную массивом, а
 *  не через Intl — форматирование Intl на Android нестабильно между
 *  уровнями API, а заголовок должен быть предсказуем. */
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
 * Группирует приступы по локальному календарному дню occurred_at. Порядок
 * групп и записей внутри — как пришло (сервер отдаёт occurred_at DESC,
 * id DESC), на клиенте не пересортировываем. Непарсируемый occurred_at
 * сервер не отдаёт; если всё же приехал — запись пропускаем с warn, чтобы
 * мусор не ломал весь список.
 */
export function groupSeizuresByDay<T extends Seizure>(
    seizures: T[],
): SeizureDayGroup<T>[] {
    const groups = new Map<string, SeizureDayGroup<T>>();

    for (const seizure of seizures) {
        const moment = parseUtcIso(seizure.occurred_at);

        if (moment === null) {
            console.warn(
                `groupSeizuresByDay: непарсируемый occurred_at «${seizure.occurred_at}» у записи ${seizure.id}`,
            );

            continue;
        }

        // Ключ и локальная полночь — из локальных геттеров момента: группа
        // ровно по календарному дню устройства, а не по UTC-суткам.
        const key = formatYmd(moment);
        let group = groups.get(key);

        if (group === undefined) {
            group = {
                key,
                day: new Date(
                    moment.getFullYear(),
                    moment.getMonth(),
                    moment.getDate(),
                ),
                count: 0,
                items: [],
            };
            groups.set(key, group);
        }

        group.items.push(seizure);
        group.count += 1;
    }

    return [...groups.values()];
}

/**
 * Заголовок группы «7 сентября»; год дописывается только для не-текущего —
 * свежие дни журнала читаются без шума повторяющихся цифр.
 */
export function formatDayTitle(day: Date): string {
    const base = `${day.getDate()} ${MONTHS_GENITIVE[day.getMonth()]}`;

    if (day.getFullYear() === new Date().getFullYear()) {
        return base;
    }

    return `${base} ${day.getFullYear()}`;
}

/**
 * Существительное после числительного для заголовка группы: 1/21 приступ,
 * 2–4/22–24 приступа, 5–20/25+ приступов — классические правила
 * русского склонения.
 */
export function pluralizeSeizures(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return 'приступ';
    }

    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
        return 'приступа';
    }

    return 'приступов';
}
