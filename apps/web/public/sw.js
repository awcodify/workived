// Service worker kill-switch: unregisters the old PWA SW and clears all caches.
// Required for users who installed the app before PWA was removed.
// The browser fetches this on its next update check (within 24h) and runs the cleanup.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  )
})
