/**
 * Разрешение query-параметра returnTo в цель редиректа после логина.
 * Платформо-независимый модуль — без импортов React/RN.
 */

/**
 * Белый список значений returnTo. Параметр внутренний: его ставит
 * только само приложение (гард на /quick), поэтому список жёсткий —
 * защита от неожидаемых значений, которые могли бы проскочить в URL.
 */
export const RETURN_TO_WHITELIST = ['/quick'] as const;

/** Литерал из белого списка — то, что приложение само кладёт в URL. */
type Whitelisted = (typeof RETURN_TO_WHITELIST)[number];

/**
 * Валидная цель router.replace после логина: литерал из белого
 * списка либо корень «/» (журнал) — обе строки являются Href.
 */
export type ReturnTo = Whitelisted | '/';

/**
 * Строка входит в белый список. Единственный каст в модуле:
 * includes принимает readonly string[], а не литеральный кортеж.
 */
function isWhitelisted(value: string): value is Whitelisted {
    return (RETURN_TO_WHITELIST as readonly string[]).includes(value);
}

/**
 * Разрешает значение параметра returnTo в цель редиректа: валидный
 * литерал из белого списка возвращается как есть, всё остальное
 * (undefined, массив от повторённого параметра, посторонние пути,
 * пустая строка) — корень «/».
 */
export function resolveReturnTo(
    value: string | string[] | undefined,
): ReturnTo {
    if (typeof value !== 'string') {
        return '/';
    }

    return isWhitelisted(value) ? value : '/';
}
