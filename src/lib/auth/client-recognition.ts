import { withSessionLock } from './tokens';

export const CLIENT_KEY = 'tracevault_client_v1';
const clientPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Recognition metadata only; logout and account switching retain this value. */
export async function getLoginClientID(): Promise<string | undefined> {
  return withSessionLock(() => {
    try {
      const stored = localStorage.getItem(CLIENT_KEY);
      if (stored && clientPattern.test(stored)) return stored;
      const id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
      // If storage cannot retain it, report an unidentified login to the server.
      return localStorage.getItem(CLIENT_KEY) === id ? id : undefined;
    } catch {
      return undefined;
    }
  });
}
