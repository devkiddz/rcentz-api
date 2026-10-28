/** Strict allowlisted SDK v1 payload; no arbitrary user identifiers or free text. */
export type IntakeEvent = {
  schemaVersion: 1;
  eventId: string;
  occurredAt: string;
  kind: 'analytics' | 'feature' | 'performance' | 'runtime';
  name: string;
  environment: 'development' | 'preview' | 'production';
  featureKey?: string;
  measurements?: Record<string, number>;
  dimensions?: Record<string, string>;
};
const identifier = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedDimensions = new Set(['route','platform','device','result','category','operation','source','session']);
export function decodeBatch(raw: unknown, now = Date.now()): IntakeEvent[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('BAD_BATCH');
  const {events} = raw as Record<string, unknown>;
  if (!Array.isArray(events) || events.length === 0 || events.length > 20) throw Error('BAD_BATCH');
  return events.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('BAD_EVENT');
    const e = value as Record<string, unknown>;
    if (Object.keys(e).some(k=>!['schemaVersion','eventId','occurredAt','kind','name','environment','featureKey','measurements','dimensions'].includes(k)) ||
        e.schemaVersion !== 1 || typeof e.eventId !== 'string' || !uuid.test(e.eventId) ||
        typeof e.occurredAt !== 'string' || !Number.isFinite(Date.parse(e.occurredAt)) ||
        Math.abs(now - Date.parse(e.occurredAt)) > 86400000 ||
        !['analytics','feature','performance','runtime'].includes(String(e.kind)) ||
        !['development','preview','production'].includes(String(e.environment)) ||
        typeof e.name !== 'string' || e.name.length > 100 || !identifier.test(e.name) ||
        (e.featureKey !== undefined && (typeof e.featureKey !== 'string' || !identifier.test(e.featureKey))) ||
        (e.kind === 'feature' && !e.featureKey)) throw Error('BAD_EVENT');
    for (const [key, cap] of [['measurements', 8], ['dimensions', 6]] as const) {
      const item = e[key]; if (item === undefined) continue;
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).length > cap) throw Error('BAD_EVENT');
    }
    if (e.measurements) for (const [key,val] of Object.entries(e.measurements)) {
      if (!identifier.test(key) || key.length>48 || typeof val!=='number' || !Number.isFinite(val) || Math.abs(val)>1e12) throw Error('BAD_MEASUREMENT');
    }
    if (e.dimensions) for (const [key,val] of Object.entries(e.dimensions)) {
      const maxLength=key==='route'?512:key==='session'?64:80;
      if (!allowedDimensions.has(key) || typeof val!=='string' || val.length>maxLength || /[?&#@]/.test(val) ||
          (key==='route' && (!/^\/[a-zA-Z0-9/_\[\]-]{0,511}$/.test(val) || /\d{5,}/.test(val)))) throw Error('BAD_DIMENSION');
    }
    return e as IntakeEvent;
  });
}
