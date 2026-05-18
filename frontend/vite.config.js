import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Ensure worker bundles use ES modules to allow code-splitting inside workers
  worker: {
    format: 'es'
  },
  build: {
    // keep default build settings
  }
})