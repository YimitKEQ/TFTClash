import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('node_modules') === -1) return undefined
          if (id.indexOf('react-router') !== -1) return 'vendor-react'
          if (id.indexOf('/react/') !== -1 || id.indexOf('/react-dom/') !== -1 || id.indexOf('/scheduler/') !== -1) return 'vendor-react'
          if (id.indexOf('@supabase') !== -1) return 'vendor-supabase'
          if (id.indexOf('@sentry') !== -1) return 'vendor-sentry'
          return 'vendor'
        },
      },
    },
  },
})
