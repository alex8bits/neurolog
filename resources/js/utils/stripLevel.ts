/**
 * Минимальная верхняя граница шкалы: для малых значений шкала остаётся
 * абсолютной (1, 2, 3 приступа = уровни 1, 2, 3).
 */
const MIN_TOP = 3;

/**
 * Верхняя граница относительной шкалы: max(максимум за период, 3).
 */
export function stripTop(counts: number[]): number {
    return Math.max(Math.max(0, ...counts), MIN_TOP);
}

/**
 * Уровень насыщенности клетки ленты (0..3) на относительной шкале.
 *
 * level = count <= 0 ? 0 : min(3, ceil(count * 3 / top)).
 * Пример: top = 8 -> 1–2 = 1, 3–5 = 2, 6–8 = 3.
 */
export function stripLevel(count: number, top: number): number {
    if (count <= 0) {
        return 0;
    }

    return Math.min(3, Math.ceil((count * 3) / top));
}

/**
 * Уровни (0..3) для списка дней сводки; top считается по максимуму count.
 */
export function computeStripLevels(days: { count: number }[]): number[] {
    const top = stripTop(days.map((day) => day.count));

    return days.map((day) => stripLevel(day.count, top));
}
