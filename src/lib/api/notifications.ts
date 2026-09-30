import type { components } from '@/types/generated/http';
import { apiClient } from './client';
export type Notification = components['schemas']['Notification'];
export type NotificationList = components['schemas']['NotificationList'];
export type NotificationPreferences = components['schemas']['NotificationPreferences'];
export type NotificationPreference = components['schemas']['NotificationPreference'];
export type NotificationPreferenceInput = components['schemas']['NotificationPreferenceInput'];
export type NotificationDevices = components['schemas']['NotificationDevices'];
export type NotificationDeviceResult = components['schemas']['NotificationDeviceResult'];
const base = '/api/v1/notifications';
export const notificationAPI = {
  list: (before: string, signal?: AbortSignal) => apiClient<NotificationList>(`${base}?limit=20${before ? `&before_id=${encodeURIComponent(before)}` : ''}`, { signal }),
  read: (id: string, signal: AbortSignal) => apiClient<components['schemas']['NotificationDetail']>(`${base}/${encodeURIComponent(id)}/read`, { method: 'POST', signal }),
  readAll: (signal: AbortSignal) => apiClient<components['schemas']['NotificationMarked']>(`${base}/read-all`, { method: 'POST', signal }),
  preferences: (signal?: AbortSignal) => apiClient<NotificationPreferences>(`${base}/preferences`, { signal }),
  savePreferences: (preferences: NotificationPreferenceInput[], signal: AbortSignal) => apiClient<NotificationPreferences>(`${base}/preferences`, { method: 'PUT', body: JSON.stringify({ preferences }), signal }),
  resetPreference: (type: string, signal: AbortSignal) => apiClient<NotificationPreferences>(`${base}/preferences/${encodeURIComponent(type)}`, { method: 'DELETE', signal }),
  devices: (signal?: AbortSignal) => apiClient<NotificationDevices>(`${base}/devices`, { signal }),
  registerDevice: (token: string, deviceName: string, signal: AbortSignal) => apiClient<NotificationDeviceResult>(`${base}/devices`, { method: 'POST', body: JSON.stringify({ token, platform: 'web', device_name: deviceName }), signal }),
  removeDevice: (id: string, signal: AbortSignal) => apiClient<components['schemas']['NotificationDeviceRemoved']>(`${base}/devices/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
};
