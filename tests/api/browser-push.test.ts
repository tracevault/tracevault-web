import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebase = vi.hoisted(() => ({
  app: {},
  deleteToken: vi.fn(),
  getMessaging: vi.fn(() => 'messaging'),
  getToken: vi.fn(),
  initializeApp: vi.fn(() => ({})),
  isSupported: vi.fn(),
}));
vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => firebase.app),
  getApps: vi.fn(() => []),
  initializeApp: firebase.initializeApp,
}));
vi.mock('firebase/messaging', () => ({
  deleteToken: firebase.deleteToken,
  getMessaging: firebase.getMessaging,
  getToken: firebase.getToken,
  isSupported: firebase.isSupported,
}));

const registration = { scope: 'https://tracevault.test/' } as ServiceWorkerRegistration;
const permission = { value: 'default' as NotificationPermission, request: vi.fn() };

function configure() {
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'AIza-public-browser-key');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'tracevault-browser');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '123456789012');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:123456789012:web:abcdef');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'A'.repeat(87));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  configure();
  permission.value = 'default';
  permission.request.mockResolvedValue('granted');
  firebase.isSupported.mockResolvedValue(true);
  firebase.getToken.mockResolvedValue('fcm-browser-token');
  firebase.deleteToken.mockResolvedValue(true);
  const notification = { get permission() { return permission.value; }, requestPermission: permission.request };
  vi.stubGlobal('Notification', notification);
  vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockResolvedValue(registration) } });
  vi.stubGlobal('window', { isSecureContext: true, Notification: notification });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('browser Push registration', () => {
  it('requests permission only when subscribing and binds the root worker to getToken', async () => {
    const push = await import('@/lib/browser-push');
    expect(await push.browserPushState()).toBe('ready');
    expect(permission.request).not.toHaveBeenCalled();
    expect(await push.subscribeBrowserPush()).toBe('fcm-browser-token');
    expect(permission.request).toHaveBeenCalledOnce();
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/tracevault-push-sw.js', { scope: '/' });
    expect(firebase.getToken).toHaveBeenCalledWith('messaging', { serviceWorkerRegistration: registration, vapidKey: 'A'.repeat(87) });
  });

  it('fails closed before asking permission when public configuration is absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', '');
    vi.resetModules();
    const push = await import('@/lib/browser-push');
    expect(await push.browserPushState()).toBe('unconfigured');
    await expect(push.subscribeBrowserPush()).rejects.toMatchObject({ code: 'unconfigured' });
    expect(permission.request).not.toHaveBeenCalled();
    expect(firebase.getToken).not.toHaveBeenCalled();
  });

  it('does not register a worker after permission denial and deletes an existing local token explicitly', async () => {
    permission.request.mockImplementation(async () => { permission.value = 'denied'; return 'denied'; });
    const push = await import('@/lib/browser-push');
    await expect(push.subscribeBrowserPush()).rejects.toMatchObject({ code: 'denied' });
    expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
    permission.value = 'granted';
    expect(await push.deleteBrowserPushToken()).toBe(true);
    expect(firebase.deleteToken).toHaveBeenCalledWith('messaging');
  });
});
