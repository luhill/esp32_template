import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"
import { VitePWA } from 'vite-plugin-pwa'
import { compression } from 'vite-plugin-compression2'

export default defineConfig(({ mode }) => {
  const isPwa = mode === 'pwa' || mode === 'github';

  return {
    plugins: [
      react(),
      // ESP32 Mode: Inline and Gzip
      !isPwa && viteSingleFile(),
      !isPwa && compression({ algorithms: ['gzip'], include: [/\.(html)$/, /\.(ico)$/], deleteOriginalAssets: true }),

      // PWA Mode: Standard files with Manifest and Service Worker
      isPwa && VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'ESP32 Fleet Manager',
          short_name: 'ESP32',
          display: 'standalone',
          theme_color: '#000000',
          background_color: '#000000',
          icons: [
            {
              src: 'favicon.ico',
              sizes: '64x64 32x32',
              type: 'image/x-icon'
            },
            {
              src: 'logo192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable' // Recommended for Android icons
            },
            {
              src: 'logo512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    base: mode === 'github' ? './' : '/',
    build: {
      // If PWA, we want standard folders (assets/js/css)
      // If ESP32, we want a flat structure
      outDir: isPwa ? 'dist-pwa' : 'dist',
      emptyOutDir: true,
      reportCompressedSize: false,
    }
  }
})
