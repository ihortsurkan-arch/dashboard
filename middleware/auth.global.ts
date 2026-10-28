export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, user, fetch } = useUserSession()
  if (!loggedIn.value) await fetch()
  if (to.path === '/login') {
    if (loggedIn.value) return navigateTo('/')
    return
  }
  if (!loggedIn.value) return navigateTo('/login')
  if (to.path.startsWith('/admin') && user.value?.role !== 'admin') return navigateTo('/')
})
