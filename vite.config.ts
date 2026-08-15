import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    // One vendor chunk. The dependency list is short on purpose; splitting it
    // further would only cost round trips.
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ['@codemirror/state', '@codemirror/view', '@codemirror/commands'],
        },
      },
    },
  },
})
