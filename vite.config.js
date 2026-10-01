import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.cjs',
        vite: {
          build: {
            outDir: 'dist/electron',
          },
        },
      },
      {
        entry: 'electron/preload.cjs',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist/electron',
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // docs/ holds local test media (gitignored): ffmpeg writes and media
    // players lock files there, and chokidar's EBUSY on a locked file crashed
    // the whole dev server twice — keep it out of the watcher.
    watch: {
      ignored: ['**/docs/**'],
    },
  },
})
