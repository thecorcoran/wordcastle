import path from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: {
      '@word-castle/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/castle-192.svg', 'icons/castle-512.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
      },
      manifest: {
        name: 'Word Castle',
        short_name: 'Word Castle',
        description: 'Build your castle stone by stone with Fry Instant Words.',
        display: 'standalone',
        background_color: '#F6F1E7',
        theme_color: '#2F7D5B',
        icons: [
          {
            src: 'icons/castle-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/castle-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
