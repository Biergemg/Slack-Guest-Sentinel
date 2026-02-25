import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./tests/setup.ts'],
        alias: {
            '@': path.resolve(__dirname, './'),
        },
        env: {
            NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
            SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
            STRIPE_SECRET_KEY: 'sk_test_mock',
            STRIPE_WEBHOOK_SECRET: 'whsec_mock',
            STRIPE_PRICE_STARTER: 'price_starter',
            STRIPE_PRICE_GROWTH: 'price_growth',
            STRIPE_PRICE_SCALE: 'price_scale',
            SLACK_CLIENT_ID: 'test_client_id',
            SLACK_CLIENT_SECRET: 'test_client_secret',
            SLACK_SIGNING_SECRET: 'test_signing_secret',
            NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
            ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
            CRON_SECRET: 'test-cron-secret'
        },
        // Run test files sequentially — integration tests share a real local DB.
        // Concurrent file execution causes race conditions between beforeEach(cleanDatabase)
        // calls across test files.
        fileParallelism: false,
        // The user explicitly requested the suite must run in less than 20 seconds.
        // We set a strict 15-second timeout per test.
        testTimeout: 15000,
        hookTimeout: 15000,
        clearMocks: true,
    },
    define: {
        'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
        'process.env.SUPABASE_SERVICE_ROLE_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'),
        'process.env.STRIPE_SECRET_KEY': JSON.stringify('sk_test_mock'),
        'process.env.STRIPE_WEBHOOK_SECRET': JSON.stringify('whsec_mock'),
        'process.env.STRIPE_PRICE_STARTER': JSON.stringify('price_starter'),
        'process.env.STRIPE_PRICE_GROWTH': JSON.stringify('price_growth'),
        'process.env.STRIPE_PRICE_SCALE': JSON.stringify('price_scale'),
        'process.env.SLACK_CLIENT_ID': JSON.stringify('test_client_id'),
        'process.env.SLACK_CLIENT_SECRET': JSON.stringify('test_client_secret'),
        'process.env.SLACK_SIGNING_SECRET': JSON.stringify('test_signing_secret'),
        'process.env.NEXT_PUBLIC_APP_URL': JSON.stringify('http://localhost:3000'),
        'process.env.ENCRYPTION_KEY': JSON.stringify('0000000000000000000000000000000000000000000000000000000000000000'),
        'process.env.CRON_SECRET': JSON.stringify('test-cron-secret'),
        'process.env.NODE_ENV': JSON.stringify('test')
    }
});

