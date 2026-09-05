import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Vite 开发与静态构建配置。 */
export default defineConfig({
  plugins: [react()],
});
