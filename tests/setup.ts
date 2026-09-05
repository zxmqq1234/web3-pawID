import '@testing-library/jest-dom';

/** 测试环境的最小浏览器 API 补齐，避免测试依赖真实浏览器。 */
if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => `test-${Math.random().toString(36).slice(2)}`,
  });
}
