import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"
import { compression } from 'vite-plugin-compression2'

export default defineConfig({
  plugins: [
    react(), 
    viteSingleFile(),
    // Gzip only - ESP32 doesn't speak Brotli!
    compression({
      algorithms: ['gzip'],
      include: [/\.(html)$/, /\.(ico)$/],
      deleteOriginalAssets: true,
    })
  ],
  build: {
    reportCompressedSize: false,
  },
})