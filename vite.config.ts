import react from '@vitejs/plugin-react';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { configApi } from './vite-plugins/config-api';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), configApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
