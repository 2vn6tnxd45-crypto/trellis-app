import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path' // Import dirname
import { fileURLToPath } from 'url'     // Import fileURLToPath

// Define __dirname manually for ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
        // report: resolve(__dirname, 'public/pedigree_report.html') // Remove this (see point 3)
      },
    },
  },
})
