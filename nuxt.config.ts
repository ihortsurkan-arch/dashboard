export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  // Private dashboard behind a login: a client-rendered app, the server only serves the API.
  ssr: false,
  modules: ['nuxt-auth-utils'],
  css: ['~/assets/main.css'],
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Landing Stats',
      htmlAttrs: { lang: 'uk' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    // Postgres connection string. Empty → local PGlite database in .data/db (dev only).
    databaseUrl: '',
    // First admin, created automatically when the users table is empty.
    adminLogin: '',
    adminPassword: '',
    ga4: {
      propertyId: '',
      clientEmail: '',
      privateKey: '',
      leadEvent: 'generate_lead',
      // Cache GA4 answers for N seconds (per server instance).
      cacheTtl: 600,
      // "1" → generated demo numbers instead of GA4 (for local development).
      mock: '',
    },
    // Telegram alerts: bot token from @BotFather and the chat (or group) id to post into.
    telegram: {
      botToken: '',
      chatId: '',
    },
    // Base URL used in alert messages, e.g. https://dashboard-xi-ten-54.vercel.app
    publicUrl: '',
  },
})
