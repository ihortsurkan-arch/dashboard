import {
  ArcElement, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'

export default defineNuxtPlugin(() => {
  Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler)
  Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  Chart.defaults.font.size = 12
  Chart.defaults.animation = { duration: 300 }
})
