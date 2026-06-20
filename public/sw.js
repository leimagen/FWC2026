const CACHE = 'fwc2026-shell-v2';
const SHELL = ['/', '/en/', '/manifest.webmanifest', '/favicon.ico', '/favicon.png', '/icon-192.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
		),
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				const copy = response.clone();
				caches.open(CACHE).then((cache) => cache.put(event.request, copy));
				return response;
			})
			.catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))),
	);
});

self.addEventListener('push', (event) => {
	const data = event.data?.json() ?? {};
	event.waitUntil(
		self.registration.showNotification(data.title ?? 'World Cup 2026', {
			body: data.body ?? 'The live table has changed.',
			icon: '/icon-192.png',
			data: { url: data.url ?? '/' },
		}),
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'));
});
