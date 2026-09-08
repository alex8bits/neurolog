import { Paths } from 'expo-file-system';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiDownload, apiFetch } from '@/api/client';
import type { ApiFetchInit } from '@/api/client';
import {
    createSeizure,
    deleteSeizure,
    emailSeizuresDoctor,
    emailSeizuresSelf,
    exportSeizuresDocx,
    listSeizures,
    updateSeizure,
} from '@/api/seizures';

vi.mock('@/api/client', () => ({
    apiDownload: vi.fn(),
    apiFetch: vi.fn().mockResolvedValue({ data: [] }),
}));

const apiFetchMock = vi.mocked(apiFetch);
const apiDownloadMock = vi.mocked(apiDownload);

/** Одна запись мока expo-file-system: куда и с каким именем пишутся байты. */
interface RecordedWrite {
    directory: unknown;
    name: string;
    bytes: Uint8Array;
}

const fileWrites = vi.hoisted(() => [] as RecordedWrite[]);

vi.mock('expo-file-system', () => ({
    File: class MockFile {
        readonly directory: unknown;

        readonly name: string;

        readonly uri: string;

        constructor(directory: unknown, name: string) {
            this.directory = directory;
            this.name = name;
            this.uri = `file:///Documents/${name}`;
        }

        write(bytes: Uint8Array): void {
            fileWrites.push({
                directory: this.directory,
                name: this.name,
                bytes,
            });
        }
    },
    Paths: { document: 'file:///Documents' },
}));

beforeEach(() => {
    apiFetchMock.mockClear();
    apiDownloadMock.mockReset();
    fileWrites.length = 0;
});

describe('listSeizures', () => {
    it('без from/to шлёт только per_page и timezone', async () => {
        await listSeizures({ timezone: 'Europe/Moscow' });

        expect(apiFetchMock).toHaveBeenCalledWith(
            '/seizures?per_page=50&timezone=Europe%2FMoscow',
        );
    });

    it('дописывает закодированные from/to после timezone', async () => {
        await listSeizures({
            timezone: 'Europe/Moscow',
            from: '2026-07-01',
            to: '2026-07-10',
        });

        expect(apiFetchMock).toHaveBeenCalledWith(
            '/seizures?per_page=50&timezone=Europe%2FMoscow&from=2026-07-01&to=2026-07-10',
        );
    });

    it('учитывает каждую границу отдельно', async () => {
        await listSeizures({ timezone: 'UTC', from: '2026-07-01' });
        await listSeizures({ timezone: 'UTC', to: '2026-07-10' });

        expect(apiFetchMock).toHaveBeenNthCalledWith(
            1,
            '/seizures?per_page=50&timezone=UTC&from=2026-07-01',
        );
        expect(apiFetchMock).toHaveBeenNthCalledWith(
            2,
            '/seizures?per_page=50&timezone=UTC&to=2026-07-10',
        );
    });
});

describe('createSeizure', () => {
    it('передаёт тело как есть методом POST', async () => {
        const input = {
            timezone: 'Europe/Moscow',
            comment: 'утро',
            occurred_at: '2026-05-10T09:05:00',
        };

        await createSeizure(input);

        expect(apiFetchMock).toHaveBeenCalledWith('/seizures', {
            method: 'POST',
            body: input,
        });
    });
});

describe('deleteSeizure', () => {
    it('DELETE по id записи', async () => {
        await deleteSeizure(42);

        expect(apiFetchMock).toHaveBeenCalledWith('/seizures/42', {
            method: 'DELETE',
        });
    });
});

describe('updateSeizure', () => {
    it('PATCH по id с телом как есть, возвращает распакованный .data', async () => {
        const input = {
            timezone: 'Europe/Moscow',
            comment: 'x',
            occurred_at: '2026-09-07T10:00:00',
        };
        const seizure = {
            id: 42,
            occurred_at: '2026-09-07T07:00:00.000000Z',
            comment: 'x',
            created_at: '2026-09-07T09:00:00.000000Z',
        };
        apiFetchMock.mockResolvedValueOnce({ data: seizure });

        const result = await updateSeizure(42, input);

        expect(apiFetchMock).toHaveBeenCalledWith('/seizures/42', {
            method: 'PATCH',
            body: input,
        });
        expect(result).toEqual(seizure);
    });
});

describe('exportSeizuresDocx', () => {
    it('пишет байты ответа в документ-директорию под именем из заголовка', async () => {
        const encoded = encodeURIComponent('Журнал_приступов_10.05.2026.docx');
        const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

        apiDownloadMock.mockResolvedValueOnce(
            new Response(bytes, {
                status: 200,
                headers: {
                    'Content-Disposition': `attachment; filename*=utf-8''${encoded}`,
                },
            }),
        );

        const result = await exportSeizuresDocx({
            timezone: 'Europe/Moscow',
            from: '2026-07-01',
        });

        expect(apiDownloadMock).toHaveBeenCalledWith(
            '/seizures/export.docx?timezone=Europe%2FMoscow&from=2026-07-01',
        );
        expect(fileWrites).toEqual([
            {
                directory: Paths.document,
                name: 'Журнал_приступов_10.05.2026.docx',
                bytes,
            },
        ]);
        expect(result).toEqual({
            fileUri: 'file:///Documents/Журнал_приступов_10.05.2026.docx',
            filename: 'Журнал_приступов_10.05.2026.docx',
        });
    });

    it('без Content-Disposition пишет под дефолтным именем', async () => {
        apiDownloadMock.mockResolvedValueOnce(
            new Response(new Uint8Array([0x50]), { status: 200 }),
        );

        const result = await exportSeizuresDocx({ timezone: 'UTC' });

        expect(apiDownloadMock).toHaveBeenCalledWith(
            '/seizures/export.docx?timezone=UTC',
        );
        expect(fileWrites[0]?.name).toBe('Журнал_приступов.docx');
        expect(result).toEqual({
            fileUri: 'file:///Documents/Журнал_приступов.docx',
            filename: 'Журнал_приступов.docx',
        });
    });
});

describe('emailSeizuresSelf', () => {
    it('POST с периодом в query и без тела; ответ как есть', async () => {
        apiFetchMock.mockResolvedValueOnce({
            message: 'Отчёт отправлен на вашу почту.',
        });

        const result = await emailSeizuresSelf({
            timezone: 'Europe/Moscow',
            from: '2026-07-01',
        });

        expect(apiFetchMock).toHaveBeenCalledWith(
            '/seizures/email-self?timezone=Europe%2FMoscow&from=2026-07-01',
            { method: 'POST' },
        );
        expect(result).toEqual({
            message: 'Отчёт отправлен на вашу почту.',
        });
    });

    it('без from/to — в query только timezone', async () => {
        apiFetchMock.mockResolvedValueOnce({ message: 'ok' });

        await emailSeizuresSelf({ timezone: 'UTC' });

        expect(apiFetchMock).toHaveBeenCalledWith(
            '/seizures/email-self?timezone=UTC',
            { method: 'POST' },
        );
    });
});

describe('emailSeizuresDoctor', () => {
    it('POST с периодом в query и телом {to, subject, body}', async () => {
        apiFetchMock.mockResolvedValueOnce({ message: 'Письмо отправлено.' });

        const result = await emailSeizuresDoctor(
            { timezone: 'Europe/Moscow', from: '2026-07-01' },
            {
                to: 'doctor@example.com',
                subject: 'Журнал приступов',
                body: 'Отчёт за июль',
            },
        );

        expect(apiFetchMock).toHaveBeenCalledWith(
            '/seizures/email-doctor?timezone=Europe%2FMoscow&from=2026-07-01',
            {
                method: 'POST',
                body: {
                    to: 'doctor@example.com',
                    subject: 'Журнал приступов',
                    body: 'Отчёт за июль',
                },
            },
        );
        expect(result).toEqual({ message: 'Письмо отправлено.' });
    });

    it('пустые subject/body не попадают в тело', async () => {
        apiFetchMock.mockResolvedValueOnce({ message: 'ok' });

        await emailSeizuresDoctor(
            { timezone: 'UTC' },
            { to: 'doctor@example.com', subject: '', body: '' },
        );

        expect(apiFetchMock).toHaveBeenCalledWith(
            '/seizures/email-doctor?timezone=UTC',
            { method: 'POST', body: { to: 'doctor@example.com' } },
        );

        const init = apiFetchMock.mock.calls[0][1] as ApiFetchInit;

        // Сериализованное тело содержит только to: undefined-ключи
        // JSON.stringify выкидывает — на сервер пустышки не уедут.
        expect(JSON.stringify(init.body)).toBe('{"to":"doctor@example.com"}');
    });
});
