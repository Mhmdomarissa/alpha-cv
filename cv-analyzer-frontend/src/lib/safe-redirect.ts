/**
 * Returns a same-origin relative path safe to pass to router.push, or null.
 */
export function safeRedirectPath(raw: string | string[] | null | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null || typeof v !== 'string') return null;
  const t = v.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return null;
  if (t.includes('\n') || t.includes('\r')) return null;
  return t;
}
