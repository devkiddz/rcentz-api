/** P6 discovery candidate admission; pure/no I/O. This is NOT a scraper or lead validator. */
export type CommercialSourceKind = 'PUBLIC_RFP' | 'PUBLIC_PROJECT_REQUEST' | 'COMPANY_WEBSITE' | 'BUSINESS_DIRECTORY' | 'PARTNERSHIP_NOTICE' | 'OTHER_PUBLIC';
export type IntakeDecision = 'REVIEW' | 'REJECT';
export type PublicCandidate = {
  sourceKind: CommercialSourceKind;
  sourceName: string;
  sourceUrl: string;
  title: string;
  description: string;
  capturedAt: string;
  publishedAt?: string | null;
  externalId?: string | null;
};
export type IntakeResult = { decision: IntakeDecision; reason: string; canonicalKey?: string; normalizedUrl?: string; warnings: string[] };
const kinds = new Set<CommercialSourceKind>(['PUBLIC_RFP','PUBLIC_PROJECT_REQUEST','COMPANY_WEBSITE','BUSINESS_DIRECTORY','PARTNERSHIP_NOTICE','OTHER_PUBLIC']);
const blockHost = (host: string) => host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.endsWith('.internal') || host.endsWith('.local');
export function canonicalPublicUrl(input: string): string | null {
  if (input.length > 2048 || !input.trim()) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !url.hostname.includes('.') || blockHost(url.hostname) || url.username || url.password || url.port) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_[a-z_]+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.origin}${path}${url.search}`;
  } catch { return null; }
}
const careerOnly = /\b(?:we are hiring|now hiring|apply for (?:this |the )?(?:job|role|position)|job vacancy|vacant position|salary and benefits|send (?:your |a )?cv|submit (?:your |a )?resume|full[ -]time employee|employment opportunity)\b/i;
const commercialSignals = /\b(?:request for proposals?|rfp|request for quotation|rfq|seeking (?:a |an )?(?:vendor|agency|software company|development partner)|looking for (?:a |an )?(?:software vendor|development agency|implementation partner)|outsourc(?:e|ing)|tender|procurement|commission (?:a |an )?(?:website|app|platform)|contract (?:to |for )(?:build|develop|implement)|invitation to bid|proposal submissions?)\b/i;
/** Assess whether a public source deserves human review. Never auto-contacts or creates a prospect. */
export function assessCommercialCandidate(c: PublicCandidate): IntakeResult {
  const warnings: string[] = [];
  if (!c || !kinds.has(c.sourceKind) || typeof c.sourceName !== 'string' || !c.sourceName.trim() || c.sourceName.length > 140) return { decision:'REJECT', reason:'Invalid public source identity', warnings };
  const url = canonicalPublicUrl(c.sourceUrl);
  if (!url) return { decision:'REJECT', reason:'A valid public HTTPS source URL is required', warnings };
  if (typeof c.title !== 'string' || !c.title.trim() || c.title.length > 240 || typeof c.description !== 'string' || c.description.length > 8000) return { decision:'REJECT', reason:'Invalid or unbounded source content', warnings };
  const captured = Date.parse(c.capturedAt);
  if (!Number.isFinite(captured) || captured > Date.now() + 5 * 60_000) return { decision:'REJECT', reason:'Invalid capture timestamp', warnings };
  if (c.publishedAt && !Number.isFinite(Date.parse(c.publishedAt))) warnings.push('Publication date unverified');
  const text = `${c.title} ${c.description}`;
  if (careerOnly.test(text) && !commercialSignals.test(text)) return { decision:'REJECT', reason:'Career-only posting; route to separate career workflow', warnings };
  if (!commercialSignals.test(text)) warnings.push('Commercial purchasing intent not explicit; human review required');
  if (c.sourceKind === 'BUSINESS_DIRECTORY') warnings.push('Directory listing alone is not evidence of buying intent');
  if (c.sourceKind === 'COMPANY_WEBSITE') warnings.push('Company website alone is not evidence of a purchase request');
  const external = typeof c.externalId === 'string' && /^[a-zA-Z0-9._:-]{1,160}$/.test(c.externalId) ? c.externalId : '';
  // Stable, scoped deduplication hint; final persistence must enforce owner/profile isolation.
  const canonicalKey = `${c.sourceKind}:${external ? `${new URL(url).hostname}:${external}` : url}`;
  return { decision:'REVIEW', reason:commercialSignals.test(text) ? 'Public commercial signal for qualification' : 'Public candidate requires intent verification', canonicalKey, normalizedUrl:url, warnings };
}
