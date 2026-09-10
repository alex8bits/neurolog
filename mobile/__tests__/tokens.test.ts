import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import type { StoredAuth } from '@/auth/tokens';
import { updateStoredEmail } from '@/auth/tokens';

vi.mock('expo-secure-store', () => ({
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
}));

const getItemAsync = SecureStore.getItemAsync as unknown as Mock<
    (key: string) => Promise<string | null>
>;
const setItemAsync = SecureStore.setItemAsync as unknown as Mock<
    (key: string, value: string) => Promise<void>
>;

function storedAuth(): StoredAuth {
    return {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        email: 'old@example.com',
    };
}

beforeEach(() => {
    vi.resetAllMocks();
    getItemAsync.mockResolvedValue(null);
});

describe('updateStoredEmail', () => {
    it('перезаписывает auth.tokens целиком: токены прежние, email новый', async () => {
        getItemAsync.mockResolvedValue(JSON.stringify(storedAuth()));

        await updateStoredEmail('new@example.com');

        expect(setItemAsync).toHaveBeenCalledTimes(1);
        expect(setItemAsync).toHaveBeenCalledWith(
            'auth.tokens',
            JSON.stringify({
                access_token: 'access-1',
                refresh_token: 'refresh-1',
                email: 'new@example.com',
            }),
        );
    });

    it('без сохранённой записи ничего не пишет и не бросает', async () => {
        getItemAsync.mockResolvedValue(null);

        await expect(
            updateStoredEmail('new@example.com'),
        ).resolves.toBeUndefined();

        expect(setItemAsync).not.toHaveBeenCalled();
    });
});
