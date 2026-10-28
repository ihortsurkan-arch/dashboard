import {
  ArcElement, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'

export default defineNuxtPlugin(() => {
  Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler)
  Chart.defaults.font.family = "Onest, system-ui, -apple-system, 'Segoe UI', sans-serif"
  Chart.defaults.font.size = 12

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    Chart.defaults.animation = false
    return
  }
  // Bars grow from the baseline on first draw, staggered left to right and starting
  // just after the metric strip; later data changes tween in place without the stagger.
  Chart.defaults.animation = {
    duration: 650,
    easing: 'easeOutQuart',
    delay: (ctx: any) => (ctx.type === 'data' && ctx.mode === 'default' ? 350 + Math.min(ctx.dataIndex, 40) * 14 : 0),
  } as any
  Chart.defaults.transitions.active = { animation: { duration: 150 } } as any
  // Only geometry tweens; colours switch instantly (a colour that appears on update has no
  // "from" value, which makes Chart.js' colour interpolator throw).
  ;(Chart.defaults as any).animations.colors = false
})
