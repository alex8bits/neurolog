import { apiFetch } from '@/api/client';
import type { FeedbackInput } from '@/api/types';

/** POST /feedback: обращение уходит письмом владельцу проекта; при
 *  anonymous === true сервер игнорирует имя и почту — только текст.
 *  Ответ — {message} для алерта. */
export async function sendFeedback(input: FeedbackInput): Promise<string> {
    const response = await apiFetch<{ message: string }>('/feedback', {
        method: 'POST',
        body: input,
    });

    return response.message;
}
