import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase':    ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'react-vendor':['react', 'react-dom', 'react-router-dom'],
          'ui-vendor':   ['lucide-react', 'sonner', 'date-fns'],
          'pdf':         ['jspdf'],
          'map':         ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
})
