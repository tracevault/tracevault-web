import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';

export type BrowserPushState = 'checking' | 'ready' | 'unconfigured' | 'unsupported' | 'denied';

export class BrowserPushError extends Error {
  constructor(public readonly code: Exclude<BrowserPushState, 'checking' | 'ready'>) {
    super(code);
    this.name = 'BrowserPushError';
  }
}

const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '';

function configured() {
  const values = [config.apiKey, config.projectId, config.messagingSenderId, config.appId, vapidKey];
  return values.every(value => typeof value === 'string' && value.length > 4 && !/placeholder|replace|example/i.test(value))
    && /^[a-z][a-z0-9-]{4,62}[a-z0-9]$/.test(config.projectId ?? '')
    && /^\d{5,30}$/.test(config.messagingSenderId ?? '')
    && /^[A-Za-z0-9_-]{80,120}$/.test(vapidKey);
}

function browserReady() {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'Notification' in window;
}

export async function browserPushState(): Promise<Exclude<BrowserPushState, 'checking'>> {
  if (!configured()) return 'unconfigured';
  if (!browserReady() || !(await isSupported())) return 'unsupported';
  return Notification.permission === 'denied' ? 'denied' : 'ready';
}

function app() {
  return getApps().length ? getApp() : initializeApp(config);
}

export async function subscribeBrowserPush() {
  const state = await browserPushState();
  if (state !== 'ready') throw new BrowserPushError(state);
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') throw new BrowserPushError('denied');
  const registration = await navigator.serviceWorker.register('/tracevault-push-sw.js', { scope: '/' });
  const token = await getToken(getMessaging(app()), {
    serviceWorkerRegistration: registration,
    vapidKey,
  });
  if (!token || token.length > 500 || /\s/.test(token)) throw new BrowserPushError('unsupported');
  return token;
}

export async function deleteBrowserPushToken() {
  if ((await browserPushState()) !== 'ready' || Notification.permission !== 'granted') return false;
  return deleteToken(getMessaging(app()));
}

export function browserDeviceKey(owner: string) {
  return `tracevault:browser-push-device:${owner}`;
}
