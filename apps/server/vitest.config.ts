import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://quiz:quiz@localhost:5434/quiz_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      UPLOAD_DIR: './.test-uploads',
      PUBLIC_UPLOAD_URL: '/uploads',
    },
  },
});
