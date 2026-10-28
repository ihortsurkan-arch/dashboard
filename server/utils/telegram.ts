export function telegramConfigured() {
  const { telegram } = useRuntimeConfig()
  return !!(telegram.botToken && telegram.chatId)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export { esc as escapeHtml }

/** Posts an HTML-formatted message to the configured Telegram chat. */
export async function sendTelegram(html: string) {
  const { telegram } = useRuntimeConfig()
  if (!telegram.botToken || !telegram.chatId) {
    throw createError({ statusCode: 400, statusMessage: 'Telegram не налаштовано (NUXT_TELEGRAM_BOT_TOKEN, NUXT_TELEGRAM_CHAT_ID)' })
  }
  const res = await fetch(`https://api.telegram.org/bot${telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: telegram.chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw createError({ statusCode: 502, statusMessage: `Telegram: ${data.description || res.statusText}` })
  }
}
