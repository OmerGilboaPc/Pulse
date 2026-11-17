import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// GitHub Pages serves project sites from /<repo>/. The deploy workflow sets
// BASE_PATH (e.g. "/Pulse/"); local development uses the domain root.
const rawBase = process.env.BASE_PATH || '/';
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split long-lived vendor code so app updates don't re-download it.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          data: ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png', 'sw-notifications.js'],
      manifest: {
        id: base,
        name: 'PULSE — Your World. One Feed.',
        short_name: 'PULSE',
        description:
          'Movies, TV, games, sports, technology and world news in one personalized feed — with a private watchlist and release calendar.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        theme_color: '#05070a',
        background_color: '#05070a',
        categories: ['entertainment', 'news', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Search', short_name: 'Search', url: `${base}search` },
          { name: 'Watchlist', short_name: 'Watchlist', url: `${base}watchlist` },
          { name: 'Release calendar', short_name: 'Calendar', url: `${base}calendar` },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,webmanifest}',
          '**/*-{latin,hebrew}-wght-normal*.woff2',
        ],
        importScripts: ['sw-notifications.js'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              [
                'image.tmdb.org',
                'media.rawg.io',
                'static.tvmaze.com',
                'upload.wikimedia.org',
                'a.espncdn.com',
                'i.ytimg.com',
              ].includes(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pulse-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
