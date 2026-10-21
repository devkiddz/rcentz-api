import { createHmac, timingSafeEqual } from 'node:crypto';
export async function boundedBytes(request: Request | Response, maxBytes: number): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('EMPTY_BODY');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > maxBytes) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export function validSignature(body: Buffer, signature: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
export function validBearer(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header) return false;
  const value = Buffer.from(header), expected = Buffer.from(`Bearer ${secret}`);
  return value.length === expected.length && timingSafeEqual(value, expected);
}
export async function providerGet(url: URL, token: string | undefined, fetcher: typeof fetch = fetch): Promise<unknown> {
  if (!token) throw new Error('PROVIDER_CREDENTIAL_MISSING');
  if (!['api.github.com', 'api.vercel.com'].includes(url.hostname) || url.protocol !== 'https:') throw new Error('INVALID_PROVIDER');
  const response = await fetcher(url, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(url.hostname === 'api.github.com' ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}) } });
  if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
  return JSON.parse((await boundedBytes(response, 8_000_000)).toString('utf8'));
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_PROVIDER_RESPONSE');
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_PROVIDER_RESPONSE'); return value;
}
