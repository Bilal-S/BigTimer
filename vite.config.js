import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app_icon.png', 'BigTimer.png', 'BigTimer2.png', 'BigTimer3.png'],
      manifest: {
        id: '/',
        name: 'BigTimer',
        short_name: 'BigTimer',
        description: 'High-visibility, distraction-free timer for presenters.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        lang: 'en-US',
        dir: 'ltr',
        background_color: '#000000',
        theme_color: '#000000',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: '/app_icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/app_icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/app_icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/app_icon.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'Start 5-minute timer',
            short_name: '5 min',
            description: 'Quickly start a 5-minute countdown',
            url: '/?duration=05:00',
            icons: [{ src: '/app_icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Start 10-minute timer',
            short_name: '10 min',
            description: 'Quickly start a 10-minute countdown',
            url: '/?duration=10:00',
            icons: [{ src: '/app_icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Start 30-minute timer',
            short_name: '30 min',
            description: 'Quickly start a 30-minute countdown',
            url: '/?duration=30:00',
            icons: [{ src: '/app_icon-192.png', sizes: '192x192' }]
          }
        ],
        screenshots: [
          {
            src: '/BigTimer.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Big Timer configuration screen on desktop'
          },
          {
            src: '/BigTimer2.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Big Timer countdown in focus mode'
          },
          {
            src: '/BigTimer3.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Big Timer overtime alert state'
          }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/privacy/, /^\/help/],
        runtimeCaching: [
          {
            urlPattern: /\.(?:woff2?|ttf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-assets',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});