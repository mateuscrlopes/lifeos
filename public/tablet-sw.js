self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// O painel continua usando a rede normalmente.
// O service worker existe para dar ao tablet uma experiência instalável,
// sem criar cache persistente que possa prender versões antigas do LifeOS.
self.addEventListener('fetch', () => {});
