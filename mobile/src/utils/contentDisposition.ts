/**
 * Разбор Content-Disposition ответа DOCX-экспорта: имя файла приходит как
 * RFC 5987 filename*=utf-8''<проценты> (кириллица), запасной вариант —
 * обычный filename=. Платформо-независимый модуль — без импортов React/RN
 * (как errors.ts).
 */

/** Имя при отсутствии/битом Content-Disposition — как у серверного отчёта. */
export const DEFAULT_DOCX_FILENAME = 'Журнал_приступов.docx';

/** RFC 5987: filename*=utf-8''%D0%96… — UTF-8 имя в процентах; языковой
 *  субтег (filename*=utf-8'en'…) допускается и пропускается. */
const EXTENDED_FILENAME_RE = /filename\*=utf-8'[^']*'([^;]+)/i;

/** filename="report.docx" — имя в кавычках. */
const QUOTED_FILENAME_RE = /filename="([^"]+)"/i;

/** filename=report.docx — имя без кавычек до следующей точки с запятой. */
const PLAIN_FILENAME_RE = /filename=([^;]+)/i;

/** Имя файла из Content-Disposition: RFC 5987 filename*=utf-8''… →
 *  декодирование процентов; иначе filename="…"/filename=…; иначе fallback. */
export function filenameFromContentDisposition(
    header: string | null,
    fallback: string = DEFAULT_DOCX_FILENAME,
): string {
    if (header === null) {
        return fallback;
    }

    const extended = EXTENDED_FILENAME_RE.exec(header);

    if (extended !== null) {
        try {
            return decodeURIComponent(extended[1]);
        } catch {
            // Битые проценты (URIError) — не показываем сырую строку.
            return fallback;
        }
    }

    const quoted = QUOTED_FILENAME_RE.exec(header);

    if (quoted !== null) {
        return quoted[1];
    }

    const plain = PLAIN_FILENAME_RE.exec(header);

    if (plain === null) {
        return fallback;
    }

    // filename="" не матчится QUOTED-веткой (нужно 1+ символов) и попадает
    // сюда как две кавычки: снимаем их и пустоту трактуем как «имени нет».
    const value = stripSurroundingQuotes(plain[1].trim());

    return value === '' ? fallback : value;
}

function stripSurroundingQuotes(value: string): string {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1);
    }

    return value;
}
