import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  // Pinned: the browser-driven scripts all default to this port, and `strictPort`
  // makes a clash fail loudly instead of leaving them driving a stale server.
  server: { port: 5178, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
    // Chrome refuses modulepreload links from an extension's isolated world and logs
    // a "cross-world extension resource mismatch" for each; they buy nothing locally.
    modulePreload: false,
    rollupOptions: {
      input: {
        newtab: resolve(import.meta.dirname, 'newtab.html'),
        options: resolve(import.meta.dirname, 'options.html'),
        setup: resolve(import.meta.dirname, 'setup.html'),
        background: resolve(import.meta.dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        // Split so a change to one vendor does not invalidate the others.
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
