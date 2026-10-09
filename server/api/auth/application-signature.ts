import { createHmac, timingSafeEqual } from 'node:crypto';
export type ApplicationClaims = { applicationId: string; subject: string; issuedAt: string; nonce: string };
const identifier = /^[a-zA-Z0-9:_-]{1,160}$/;
export function signaturePayload(claims: ApplicationClaims, path: string, body: string) {
  return JSON.stringify(['rcentz-api:v1', 'POST', path, claims.applicationId, claims.subject, claims.issuedAt, claims.nonce, body]);
}
export function signApplicationRequest(secret: string, claims: ApplicationClaims, path: string, body: string) {
  return createHmac('sha256', secret).update(signaturePayload(claims, path, body)).digest('hex');
}
export function validApplicationSignature(secret: string | undefined, claims: ApplicationClaims, path: string, body: string, signature: string, now = Date.now()) {
  if (!secret || secret.length < 32 || !identifier.test(claims.applicationId) || !identifier.test(claims.subject) || !/^[a-f0-9-]{36}$/.test(claims.nonce) || !/^\d{13}$/.test(claims.issuedAt) || Math.abs(now - Number(claims.issuedAt)) > 90000 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signApplicationRequest(secret, claims, path, body)), Buffer.from(signature));
}
