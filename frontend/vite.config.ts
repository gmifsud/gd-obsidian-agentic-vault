import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Port configurations for the AI Studio Environment
    host: '0.0.0.0',
    port: 3000,
    fs: {
      // CRITICAL: Allow the Vite dev server to read files from the parent directory 
      // Because the frontend is now inside /frontend/ and needs to access /vault/
      allow: [
        '..',
      ]
    }
  }
})
