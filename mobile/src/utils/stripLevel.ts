/**
 * Относительная шкала ленты 30 дней (алгоритм синхронизирован с вебом).
 * top = max(максимум за период, 3): для малых значений шкала абсолютная
 * (1, 2, 3), для больших — делится на три равные доли от максимума.
 */
export function stripLevel(count: number, top: number): 0 | 1 | 2 | 3 {
    if (count <= 0) {
        return 0;
    }

    return Math.min(3, Math.ceil((count * 3) / top)) as 1 | 2 | 3;
}

/** Уровни 0–3 для каждого дня сводки по общему максимуму. */
export function computeStripLevels(
    days: { count: number }[],
): (0 | 1 | 2 | 3)[] {
    const top = Math.max(3, ...days.map((day) => day.count));

    return days.map((day) => stripLevel(day.count, top));
}
