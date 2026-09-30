export type AuthActionLink = { action_id: string; token: string };

/** Read once in the page, then remove even malformed secrets from the address.
 * Completion is deliberately separate: merely opening a mail must never redeem it.
 */
export function readActionFragment(url: URL): AuthActionLink | null {
  if (url.search) return null;
  const values = new URLSearchParams(url.hash.slice(1));
  if (Array.from(values.keys()).length !== 2 || values.getAll('action_id').length !== 1 || values.getAll('token').length !== 1) return null;
  const action_id = values.get('action_id') ?? '';
  const token = values.get('token') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(action_id) || action_id === '00000000-0000-0000-0000-000000000000') return null;
  //32bytes in canonical unpadded base64url: final sextet's bottom2bits are zero.
  if (!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(token)) return null;
  return { action_id, token };
}
