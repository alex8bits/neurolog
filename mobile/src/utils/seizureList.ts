/**
 * Дозагрузка страниц списков (журнал, лекарства): аккумулирование страниц
 * пагинатора без дублей. Платформо-независимый модуль — без импортов
 * React/RN (как dayGroups.ts), UI-слой остаётся тонким.
 */

import type { Seizure } from '@/api/types';

/**
 * Дописывает загруженную страницу к уже показанному списку. Порядок
 * сохраняется: существующие записи, затем новые (сервер отдаёт страницы
 * в одном стабильном порядке — страницы стыкуются подряд).
 *
 * Записи с id, который уже есть в списке, выбрасываются: между запросами
 * страниц могла появиться новая запись — окно страницы сдвинулось и её
 * край уехал в обе выборки; без фильтра запись показалась бы дважды.
 * Если свежих записей нет, возвращается прежний массив (та же ссылка) —
 * повторный рендер списка не нужен.
 */
export function appendPage<T extends { id: number }>(
    existing: T[],
    incoming: T[],
): T[] {
    const seen = new Set(existing.map((item) => item.id));

    const fresh = incoming.filter((item) => !seen.has(item.id));

    return fresh.length > 0 ? [...existing, ...fresh] : existing;
}

/** Склейка страниц журнала приступов — appendPage для Seizure. */
export function appendSeizurePage(
    existing: Seizure[],
    incoming: Seizure[],
): Seizure[] {
    return appendPage(existing, incoming);
}
