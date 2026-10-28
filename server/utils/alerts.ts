// Daily check across all landings: a sharp drop in leads, traffic gone, or a traffic spike
// yesterday compared with the 14 days before. On Mondays also a weekly summary.

const pct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(Math.round(x * 100))}%`
const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n))

export async function runAlerts(opts: { forceWeekly?: boolean } = {}) {
  const landings = await query<{ id: number; name: string; hostname: string }>('SELECT id, name, hostname FROM landings ORDER BY name')
  if (!landings.length) return { alerts: 0, weekly: false, sent: false }
  const data = await dailyByHost(landings.map((l) => l.hostname), 15)
  const base = useRuntimeConfig().publicUrl
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
  const yesterday = day(1)

  const alerts: string[] = []
  for (const l of landings) {
    const m = data.get(l.hostname) ?? new Map()
    const y = m.get(yesterday) ?? { sessions: 0, leads: 0 }
    let s = 0, ld = 0
    for (let i = 2; i <= 15; i++) { const d = m.get(day(i)); s += d?.sessions ?? 0; ld += d?.leads ?? 0 }
    const avgS = s / 14
    const avgL = ld / 14
    const name = escapeHtml(l.name)
    const link = base ? ` <a href="${base}/?landing=${l.id}">відкрити</a>` : ''
    if (avgS >= 20 && y.sessions === 0) alerts.push(`⚠️ <b>${name}</b>: учора 0 сесій (звично ~${fmt(avgS)}). Перевірте лендинг і трекінг.${link}`)
    else if (avgL >= 3 && y.leads < avgL * 0.5) alerts.push(`📉 <b>${name}</b>: учора ${fmt(y.leads)} лідів, звично ~${fmt(avgL)} (${pct(y.leads / avgL - 1)}).${link}`)
    if (avgS >= 10 && y.sessions > avgS * 2) alerts.push(`📈 <b>${name}</b>: учора ${fmt(y.sessions)} сесій, удвічі більше звичного (~${fmt(avgS)}).${link}`)
  }

  const weekly = opts.forceWeekly || new Date().getUTCDay() === 1
  let weeklyText = ''
  if (weekly) {
    const lines = landings.map((l) => {
      const m = data.get(l.hostname) ?? new Map()
      let s = 0, ld = 0, ps = 0, pl = 0
      for (let i = 1; i <= 7; i++) { const d = m.get(day(i)); s += d?.sessions ?? 0; ld += d?.leads ?? 0 }
      for (let i = 8; i <= 14; i++) { const d = m.get(day(i)); ps += d?.sessions ?? 0; pl += d?.leads ?? 0 }
      const ch = pl ? ` (${pct(ld / pl - 1)})` : ''
      return `• <b>${escapeHtml(l.name)}</b>: ${fmt(ld)} лідів${ch}, ${fmt(s)} сесій, конверсія ${s ? ((ld / s) * 100).toFixed(1).replace('.', ',') : '0'}%`
    })
    weeklyText = `🗓 <b>Тиждень ${day(7)} – ${yesterday}</b>\n${lines.join('\n')}`
  }

  const parts = [alerts.length ? `<b>Landing Stats: сповіщення</b>\n${alerts.join('\n')}` : '', weeklyText].filter(Boolean)
  let sent = false
  if (parts.length && telegramConfigured()) {
    await sendTelegram(parts.join('\n\n'))
    sent = true
  }
  return { alerts: alerts.length, weekly, sent, preview: parts.join('\n\n') }
}
