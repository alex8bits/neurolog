import { describe, expect, it } from 'vitest';

import {
    DEFAULT_DOCX_FILENAME,
    filenameFromContentDisposition,
} from '@/utils/contentDisposition';

/** Content-Disposition с RFC 5987 filename* — имя в процентах, как отдаёт
 *  сервер (кириллица в ASCII-безопасном виде). */
function rfc5987Header(name: string): string {
    return `attachment; filename*=utf-8''${encodeURIComponent(name)}`;
}

describe('filenameFromContentDisposition', () => {
    it('RFC 5987 filename* декодирует кириллицу из процентов', () => {
        expect(
            filenameFromContentDisposition(
                rfc5987Header('Журнал_приступов_10.05.2026.docx'),
            ),
        ).toBe('Журнал_приступов_10.05.2026.docx');
    });

    it('при наличии обоих приоритет у filename*, не у filename=', () => {
        const header = `attachment; filename="fallback.docx"; ${rfc5987Header(
            'Журнал_приступов.docx',
        )}`;

        expect(filenameFromContentDisposition(header)).toBe(
            'Журнал_приступов.docx',
        );
    });

    it('plain filename="…" — имя в кавычках', () => {
        const header = 'attachment; filename="report.docx"';

        expect(filenameFromContentDisposition(header)).toBe('report.docx');
    });

    it('filename=… без кавычек — до следующей точки с запятой', () => {
        const header = 'attachment; filename=report.docx; size=123';

        expect(filenameFromContentDisposition(header)).toBe('report.docx');
    });

    it('заголовок null → дефолтный fallback', () => {
        expect(filenameFromContentDisposition(null)).toBe(
            DEFAULT_DOCX_FILENAME,
        );
        expect(DEFAULT_DOCX_FILENAME).toBe('Журнал_приступов.docx');
    });

    it('битые проценты в filename* → fallback, а не сырая строка', () => {
        const header = `attachment; filename*=utf-8''%D0%ZZ.docx`;

        expect(filenameFromContentDisposition(header)).toBe(
            DEFAULT_DOCX_FILENAME,
        );
    });

    it('битый filename* не проваливается на обычный filename', () => {
        const header =
            'attachment; filename="report.docx"; ' + "filename*=utf-8''%E0%";

        expect(filenameFromContentDisposition(header)).toBe(
            DEFAULT_DOCX_FILENAME,
        );
    });

    it('кастомный fallback вместо дефолтного', () => {
        expect(filenameFromContentDisposition(null, 'Отчёт.docx')).toBe(
            'Отчёт.docx',
        );
    });

    it("языковой субтег RFC 5987 (utf-8'en') декодируется так же", () => {
        const header = `attachment; filename*=utf-8'en'${encodeURIComponent(
            'Журнал.docx',
        )}`;

        expect(filenameFromContentDisposition(header)).toBe('Журнал.docx');
    });

    it('filename="" (пустое имя в кавычках) → fallback', () => {
        expect(filenameFromContentDisposition('attachment; filename=""')).toBe(
            DEFAULT_DOCX_FILENAME,
        );
    });

    it('заголовок без filename-параметра → fallback', () => {
        expect(filenameFromContentDisposition('attachment')).toBe(
            DEFAULT_DOCX_FILENAME,
        );
    });
});
