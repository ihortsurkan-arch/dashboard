export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  // Private dashboard behind a login: a client-rendered app, the server only serves the API.
  ssr: false,
  modules: ['nuxt-auth-utils'],
  css: ['~/assets/main.css'],
  app: {
    head: {
      title: 'Landing Stats',
      htmlAttrs: { lang: 'uk' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
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
  },
})
