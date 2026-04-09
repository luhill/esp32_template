import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import compression from 'vite-plugin-compression2';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isPwa = mode === 'pwa' || mode === 'github' || mode === 'ha' || mode === 'development';
  const version = Math.floor(Date.now() / 1000);

  const cacheBuster = {
    name: 'html-cache-buster',
    transformIndexHtml(html) {
      // ONLY apply cache busting if we are in PWA/HA mode
      // ESP32 builds don't need this because viteSingleFile inlines everything!
      return html;//cache busting breaks the service worker.
      if (!isPwa) return html; 

      return html
        .replace(/(src="[^"]+\.js)(")/g, `$1?v=${version}$2`)
        .replace(/(href="[^"]+\.css)(")/g, `$1?v=${version}$2`);
    }
  };

  return {
    plugins: [
      react(),
      cacheBuster,

      // ESP32 Mode: Inline and Gzip
      !isPwa && viteSingleFile(),
      !isPwa && compression({
        algorithm: 'gzip',
        include: [/\.(html)$/, /\.(ico)$/, /\.(json)$/, /\.(png)$/],
        deleteOriginalAssets: true
      }),

      // PWA Mode
      // isPwa && VitePWA({
      VitePWA({
        registerType: 'prompt',
        manifest: false, // We provide our own manifest.json in the public folder
        enableWorkboxModulesLogs: false, // 1. Shuts up the console logs
        workbox: mode === 'development'? { 
          disableDevLogs: true,
          globPatterns: {},
          }:{
            globPatterns: ['**/*.{js,css,html,json,ico,png,svg}'],
          },
        devOptions: {
          enabled: true,
          type: 'module', // Recommended for better debugging in Dev
          suppressWarnings: true
        },
      })
    ],
    base: mode === 'github' ? './' : (mode === 'ha' ? '/' : '/'),
    build: {
      outDir: isPwa ? 'dist-pwa' : 'dist',
      emptyOutDir: true,
      reportCompressedSize: false,
      // minify: 'terser',
      minify: 'terser', 
      terserOptions: {
        compress: {
          drop_console: false, // Keep logs for now so we can debug the ESP32
        },
        mangle: {
          keep_fnames: true, // Prevents breaking dnd-kit internal logic
        },
      },
    },
    optimizeDeps: {
      // This tells Vite NOT to try and pre-bundle the virtual module
      exclude: ['virtual:pwa-register', 'virtual:pwa-register/react']
    }
  }
});


// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// import { viteSingleFile } from "vite-plugin-singlefile"
// import { VitePWA } from 'vite-plugin-pwa'
// import { compression } from 'vite-plugin-compression2'

// export default defineConfig(({ mode }) => {
//   const isPwa = mode === 'pwa' || mode === 'github' || mode === 'ha';

//   return {
//     plugins: [
//       react(),
//       // ESP32 Mode: Inline and Gzip
//       !isPwa && viteSingleFile(),
//       !isPwa && compression({ algorithms: ['gzip'], include: [/\.(html)$/, /\.(ico)$/], deleteOriginalAssets: true }),

//       // PWA Mode: Standard files with Manifest and Service Worker
//       isPwa && VitePWA({
//         registerType: 'autoUpdate',
//         manifest: {
//           name: 'ESP32 Fleet Manager',
//           short_name: 'ESP32',
//           display: 'standalone',
//           theme_color: '#000000',
//           background_color: '#000000',
//           icons: [
//             {
//               src: 'favicon.ico',
//               sizes: '64x64 32x32',
//               type: 'image/x-icon'
//             },
//             {
//               src: 'logo192.png',
//               sizes: '192x192',
//               type: 'image/png',
//               purpose: 'any maskable' // Recommended for Android icons
//             },
//             {
//               src: 'logo512.png',
//               sizes: '512x512',
//               type: 'image/png'
//             }
//           ]
//         }
//       })
//     ],
//     // Github needs './', HA needs the local path, ESP needs root '/'
//     //base: mode === 'github' ? './' : (mode === 'ha' ? '/local/esp-ui/' : '/'),
//     base: mode === 'github' ? './' : (mode === 'ha' ? '/' : '/'),
//     build: {
//       // If PWA, we want standard folders (assets/js/css)
//       // If ESP32, we want a flat structure
//       outDir: isPwa ? 'dist-pwa' : 'dist',
//       emptyOutDir: true,
//       reportCompressedSize: false,
//     }
//   }
// })
