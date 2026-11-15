import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Load environment variables from the frontend directory AND the repository root directory
  const env = {
    ...loadEnv(mode, path.resolve(__dirname, '..'), ''),
    ...loadEnv(mode, '.', '')
  };

  const apiPort = env.VITE_API_PORT || env.PORT || '3001';
  const devPort = parseInt(env.VITE_PORT || '3000');
  const selectedVault = path.resolve(__dirname, env.VAULT_PATH || '../vault');
  const relativeVault = path.relative(__dirname, selectedVault).replace(/\\/g, '/');
  const globPrefix = (relativeVault.startsWith('.') ? relativeVault : '/' + relativeVault) + '/';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VAULT_GLOB_PREFIX': JSON.stringify(globPrefix),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@vault': selectedVault,
      },
    },
    server: {
      host: '0.0.0.0',
      port: devPort,
      fs: {
        allow: ['..'],
      },
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
