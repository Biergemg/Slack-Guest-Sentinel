import { vi } from 'vitest';

const mockCookies = new Map<string, string>();

export const setMockCookie = (name: string, value: string) => mockCookies.set(name, value);
export const clearMockCookies = () => mockCookies.clear();

vi.mock('next/headers', () => ({
    cookies: () => ({
        get: (name: string) => {
            const val = mockCookies.get(name);
            return val ? { value: val, name } : undefined;
        }
    })
}));
