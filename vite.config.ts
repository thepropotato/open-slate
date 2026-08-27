import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
    /*
     * Extension pages load their scripts in an isolated world, so Chrome
     * refuses every `<link rel="modulepreload">` Vite emits and logs a
     * "cross-world extension resource mismatch" for each one. The hints buy
     * nothing here — everything is served from local disk — so don't emit them.
     */
    modulePreload: false,
    rollupOptions: {
      input: {
        newtab: resolve(import.meta.dirname, 'newtab.html'),
        options: resolve(import.meta.dirname, 'options.html'),
        background: resolve(import.meta.dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        // Split the vendors so the new tab's critical path is legible in the
        // build output, and so a change to one does not invalidate the others.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-grid-layout') || id.includes('/react-draggable/')) return 'vendor-grid'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react'
          if (id.includes('/zod/')) return 'vendor-zod'
          if (id.includes('@fortawesome')) return 'vendor-icons'
          if (id.includes('@dnd-kit')) return 'vendor-dnd'
          return 'vendor'
        },
      },
    },
  },
})
