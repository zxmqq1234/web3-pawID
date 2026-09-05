import { defineConfig } from 'vitest/config';
/** Vitest 测试配置，使用 jsdom 模拟浏览器存储与 DOM。 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
