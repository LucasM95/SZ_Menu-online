import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev
export default defineConfig({
  plugins: [react()],
  build: {
    // Força o Vite a usar o esbuild tradicional e evita o bug do Rolldown na Vercel
    bundler: 'esbuild' 
  }
})
