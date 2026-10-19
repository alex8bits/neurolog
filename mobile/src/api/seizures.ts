import { File, Paths } from 'expo-file-system';

import { apiDownload, apiFetch } from '@/api/client';
import type {
    CreateSeizureInput,
    EmailDoctorInput,
    EmailMessageResponse,
    ExportPeriodParams,
    ListSeizuresParams,
    Seizure,
    SeizureListResponse,
    SeizureResponse,
    SeizureSummary,
    SeizureSummaryResponse,
    SummaryParams,
} from '@/api/types';
import { filenameFromContentDisposition } from '@/utils/contentDisposition';

/** Этап 2 фиксирует per_page=50 (PLAN.md); максимум сервера — 100. */
const PER_PAGE = 50;

/** Общая часть query списка/экспорта/писем: timezone всегда, from/to — при
 *  наличии; кодирование и порядок параметров — как у GET /seizures. */
function periodQuery(params: ExportPeriodParams): string {
    let query = `timezone=${encodeURIComponent(params.timezone)}`;

    if (params.from !== undefined) {
        query += `&from=${encodeURIComponent(params.from)}`;
    }

    if (params.to !== undefined) {
        query += `&to=${encodeURIComponent(params.to)}`;
    }

    return query;
}

export async function listSeizures(
    params: ListSeizuresParams,
): Promise<SeizureListResponse> {
    // Страница — последним параметром: первая загрузка её не шлёт,
    // сервер по умолчанию отдаёт страницу 1.
    const pageQuery = params.page !== undefined ? `&page=${params.page}` : '';

    return apiFetch<SeizureListResponse>(
        `/seizures?per_page=${PER_PAGE}&${periodQuery(params)}${pageQuery}`,
    );
}

/** GET /seizures/summary: лента 30 дней и итоги периода (тот же periodQuery,
 *  что у списка). */
export async function fetchSummary(
    params: SummaryParams,
): Promise<SeizureSummary> {
    const response = await apiFetch<SeizureSummaryResponse>(
        `/seizures/summary?${periodQuery(params)}`,
    );

    return response.data;
}

export async function createSeizure(
    input: CreateSeizureInput,
): Promise<Seizure> {
    const response = await apiFetch<SeizureResponse>('/seizures', {
        method: 'POST',
        body: input,
    });

    return response.data;
}

export async function deleteSeizure(id: number): Promise<void> {
    await apiFetch<void>(`/seizures/${id}`, { method: 'DELETE' });
}

/** PATCH /seizures/{id}: правка существующей записи; тело и 422 — как у
 *  create, 404 — чужая/удалённая запись. */
export async function updateSeizure(
    id: number,
    input: CreateSeizureInput,
): Promise<Seizure> {
    const response = await apiFetch<SeizureResponse>(`/seizures/${id}`, {
        method: 'PATCH',
        body: input,
    });

    return response.data;
}

/** GET /seizures/export.docx: скачивает бинарный отчёт за период, имя файла
 *  берёт из Content-Disposition (RFC 5987) и пишет байты в документ-директорию
 *  (перезапись одноимённого файла допустима); fileUri — для expo-sharing. */
export async function exportSeizuresDocx(
    params: ExportPeriodParams,
): Promise<{ fileUri: string; filename: string }> {
    const response = await apiDownload(
        `/seizures/export.docx?${periodQuery(params)}`,
    );

    const filename = filenameFromContentDisposition(
        response.headers.get('content-disposition'),
    );

    const bytes = new Uint8Array(await response.arrayBuffer());

    const file = new File(Paths.document, filename);

    file.write(bytes);

    return { fileUri: file.uri, filename };
}

/** POST /seizures/email-self: отчёт за период на почту самого пользователя. */
export async function emailSeizuresSelf(
    params: ExportPeriodParams,
): Promise<EmailMessageResponse> {
    return apiFetch<EmailMessageResponse>(
        `/seizures/email-self?${periodQuery(params)}`,
        { method: 'POST' },
    );
}

/** POST /seizures/email-doctor: отчёт за период на адрес врача; пустые
 *  subject/body передаются как undefined — JSON.stringify выкинет ключи. */
export async function emailSeizuresDoctor(
    params: ExportPeriodParams,
    input: EmailDoctorInput,
): Promise<EmailMessageResponse> {
    return apiFetch<EmailMessageResponse>(
        `/seizures/email-doctor?${periodQuery(params)}`,
        {
            method: 'POST',
            body: {
                to: input.to,
                subject: input.subject || undefined,
                body: input.body || undefined,
            },
        },
    );
}
