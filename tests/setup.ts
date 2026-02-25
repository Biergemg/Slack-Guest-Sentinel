import { beforeAll, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { config } from 'dotenv';

// 1. Vitest now injects these values via the config 'define' option.


// Load from file as fallback, but don't overwrite if provided
config({ path: path.resolve(__dirname, '../.env.test') });

import { disableHttpMock, enableHttpMock, resetHttpMock } from './helpers/http-mock';
import { clearMockCookies } from './helpers/next-mock';
import './helpers/next-mock';

beforeAll(async () => {
    // 2. Dynamically import supabase AFTER environment is locked
    const { supabase } = await import('@/lib/db');

    // Need a real connection to Supabase local emulator
    const { error } = await supabase.from('workspaces').select('id').limit(1);
    if (error) {
        console.error('Test Database connection failed!', error);
        throw new Error(`Please ensure Supabase local is running. Supabase mapped URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    }
});

beforeEach(async () => {
    clearMockCookies();
    const { cleanDatabase } = await import('./helpers/db');
    await cleanDatabase();
    enableHttpMock();
});

afterEach(() => {
    clearMockCookies();
    disableHttpMock();
    resetHttpMock();
});
