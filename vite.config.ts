/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Les mêmes préfixes sont réécrits par vercel.json en production :
// le navigateur n'appelle que notre domaine (pas de souci CORS).
// Ordre important : Vite teste les préfixes par `startsWith` dans l'ordre d'insertion,
// donc '/ext/meteo-archive' doit précéder '/ext/meteo'.
const proxies = {
  '/ext/geopf': 'https://data.geopf.fr',
  '/ext/apicarto': 'https://apicarto.ign.fr',
  '/ext/meteo-archive': 'https://archive-api.open-meteo.com',
  '/ext/meteo': 'https://api.open-meteo.com',
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'PermaJardin',
        short_name: 'PermaJardin',
        description: 'Cartographier son jardin en 3D, choisir quoi planter où et savoir quand entretenir.',
        lang: 'fr',
        theme_color: '#2f5d3a',
        background_color: '#f6f3ea',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//, /^\/ext\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ext/geopf/wmts'),
            handler: 'CacheFirst',
            options: { cacheName: 'ign-tuiles', expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: Object.fromEntries(
      Object.entries(proxies).map(([prefix, target]) => [
        prefix,
        { target, changeOrigin: true, rewrite: (p: string) => p.replace(prefix, '') },
      ]),
    ),
  },
  test: { environment: 'node' },
})
