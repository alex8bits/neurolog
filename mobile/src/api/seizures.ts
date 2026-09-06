import { apiFetch } from '@/api/client';
import type {
    CreateSeizureInput,
    Seizure,
    SeizureListResponse,
    SeizureResponse,
} from '@/api/types';

/** Этап 2 фиксирует per_page=50 (PLAN.md); максимум сервера — 100. */
const PER_PAGE = 50;

export async function listSeizures(
    timezone: string,
): Promise<SeizureListResponse> {
    const query = `per_page=${PER_PAGE}&timezone=${encodeURIComponent(timezone)}`;

    return apiFetch<SeizureListResponse>(`/seizures?${query}`);
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
