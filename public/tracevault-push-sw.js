/* TraceVault browser Push worker. Keep this file dependency-free and root-scoped. */
const REPORT_PATH = /^\/tax\/reports\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\?run_id=[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safePath(value) {
  return typeof value === 'string' && REPORT_PATH.test(value) ? value : '/notifications';
}

function safeText(value, fallback, limit) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return Array.from(value.trim()).slice(0, limit).join('');
}

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const notification = payload && typeof payload.notification === 'object' ? payload.notification : {};
  const data = payload && typeof payload.data === 'object' ? payload.data : {};
  const title = safeText(notification.title, 'TraceVault 알림', 120);
  const body = safeText(notification.body, '새 알림을 확인해 주세요.', 1000);
  const notificationID = typeof data.notification_id === 'string' && UUID.test(data.notification_id) ? data.notification_id : '';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    data: { path: safePath(data.path) },
    tag: notificationID ? `tracevault:${notificationID}` : undefined,
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = safePath(event.notification.data && event.notification.data.path);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(path);
        return client.focus();
      }
    }
    return self.clients.openWindow(path);
  })());
});
