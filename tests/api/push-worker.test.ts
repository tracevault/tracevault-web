import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker() {
  const listeners: Record<string, (event: Record<string, unknown>) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const navigate = vi.fn().mockResolvedValue(undefined);
  const focus = vi.fn().mockResolvedValue(undefined);
  const self = {
    addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) => { listeners[name] = listener; },
    registration: { showNotification },
    location: { origin: 'https://tracevault.test' },
    clients: {
      matchAll: vi.fn().mockResolvedValue([{ url: 'https://tracevault.test/notifications', navigate, focus }]),
      openWindow: vi.fn().mockResolvedValue(undefined),
    },
  };
  vm.runInNewContext(readFileSync('public/tracevault-push-sw.js', 'utf8'), { self, URL });
  return { focus, listeners, navigate, self, showNotification };
}

describe('browser Push service worker', () => {
  it('renders provider text but rejects a cross-origin navigation value', async () => {
    const w = worker(); let pending: Promise<unknown> = Promise.resolve();
    w.listeners.push({
      data: { json: () => ({ notification: { title: '보고서', body: '준비됨' }, data: { notification_id: 'id', path: 'https://evil.test/' } }) },
      waitUntil: (work: Promise<unknown>) => { pending = work; },
    });
    await pending;
    expect(w.showNotification).toHaveBeenCalledWith('보고서', expect.objectContaining({ body: '준비됨', data: { path: '/notifications' } }));
  });

  it('bounds visible provider text and ignores a noncanonical notification tag', async () => {
    const w = worker(); let pending: Promise<unknown> = Promise.resolve();
    w.listeners.push({
      data: { json: () => ({ notification: { title: '가'.repeat(121), body: '나'.repeat(1001) }, data: { notification_id: 'raw-provider-value' } }) },
      waitUntil: (work: Promise<unknown>) => { pending = work; },
    });
    await pending;
    expect(w.showNotification).toHaveBeenCalledWith('가'.repeat(120), expect.objectContaining({ body: '나'.repeat(1000), tag: undefined }));
  });

  it('navigates an existing same-origin window only to a canonical report path', async () => {
    const w = worker(); let pending: Promise<unknown> = Promise.resolve();
    const path = '/tax/reports/11111111-1111-4111-8111-111111111111?run_id=22222222-2222-4222-8222-222222222222';
    w.listeners.notificationclick({
      notification: { close: vi.fn(), data: { path } },
      waitUntil: (work: Promise<unknown>) => { pending = work; },
    });
    await pending;
    expect(w.navigate).toHaveBeenCalledWith(path);
    expect(w.focus).toHaveBeenCalledOnce();
  });
});
