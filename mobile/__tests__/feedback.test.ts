import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api/client';
import { sendFeedback } from '@/api/feedback';

vi.mock('@/api/client', () => ({
    apiFetch: vi.fn().mockResolvedValue({ data: [] }),
}));

const apiFetchMock = vi.mocked(apiFetch);

beforeEach(() => {
    apiFetchMock.mockClear();
});

describe('sendFeedback', () => {
    it('POST /feedback с полями формы; возвращает .message', async () => {
        const input = {
            anonymous: false,
            name: 'Alex',
            email: 'user@example.com',
            message: 'Спасибо за приложение!',
        };
        apiFetchMock.mockResolvedValueOnce({
            message: 'Обращение отправлено.',
        });

        const result = await sendFeedback(input);

        expect(apiFetchMock).toHaveBeenCalledWith('/feedback', {
            method: 'POST',
            body: input,
        });
        expect(result).toBe('Обращение отправлено.');
    });
});
