/** P6 local source registry foundation. Pure policy only: no persistence or network I/O. */
import { canonicalPublicUrl, type CommercialSourceKind } from './client-discovery-intake';

export type DiscoveryLane = 'DIRECT_DEMAND' | 'PROSPECT_SIGNAL' | 'PARTNERSHIP';
export type SourceCollectionMethod = 'PUBLIC_FEED' | 'OFFICIAL_API' | 'MANUAL_REVIEW';
export type SourceApproval = 'DRAFT' | 'APPROVED' | 'SUSPENDED';
export type RegistrySource = {
  id: string;
  name: string;
  homepage: string;
  kind: CommercialSourceKind;
  lane: DiscoveryLane;
  method: SourceCollectionMethod;
  approval: SourceApproval;
  enabled: boolean;
  permittedEndpoint?: string | null;
  cadenceMinutes: number;
  maxItemsPerRun: number;
  notes?: string;
};
export type RegistryResult = { ok: true; source: RegistrySource } | { ok: false; reasons: string[] };
const kinds = new Set<CommercialSourceKind>(['PUBLIC_RFP', 'PUBLIC_PROJECT_REQUEST', 'COMPANY_WEBSITE', 'BUSINESS_DIRECTORY', 'PARTNERSHIP_NOTICE', 'OTHER_PUBLIC']);
const lanes = new Set<DiscoveryLane>(['DIRECT_DEMAND', 'PROSPECT_SIGNAL', 'PARTNERSHIP']);
const methods = new Set<SourceCollectionMethod>(['PUBLIC_FEED', 'OFFICIAL_API', 'MANUAL_REVIEW']);
const approvals = new Set<SourceApproval>(['DRAFT', 'APPROVED', 'SUSPENDED']);
/** Constrain intended source configuration; never interpret approved as authorization to fetch any URL. */
export function validateRegistrySource(source: RegistrySource): RegistryResult {
  const reasons: string[] = [];
  if (!source || typeof source !== 'object') return { ok: false, reasons: ['Source is required'] };
  if (typeof source.id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(source.id)) reasons.push('Stable source ID required');
  if (typeof source.name !== 'string' || source.name.trim().length < 3 || source.name.length > 140) reasons.push('Source name invalid');
  const homepage = typeof source.homepage === 'string' ? canonicalPublicUrl(source.homepage) : null;
  if (!homepage) reasons.push('Public HTTPS homepage required');
  if (!kinds.has(source.kind)) reasons.push('Source kind unsupported');
  if (!lanes.has(source.lane)) reasons.push('Discovery lane unsupported');
  if (!methods.has(source.method)) reasons.push('Collection method unsupported');
  if (!approvals.has(source.approval)) reasons.push('Approval status unsupported');
  if (typeof source.enabled !== 'boolean') reasons.push('Enabled must be boolean');
  if (!Number.isInteger(source.cadenceMinutes) || source.cadenceMinutes < 60 || source.cadenceMinutes > 43200) reasons.push('Cadence must be 60–43200 minutes');
  if (!Number.isInteger(source.maxItemsPerRun) || source.maxItemsPerRun < 1 || source.maxItemsPerRun > 100) reasons.push('Run item limit must be 1–100');
  if (source.notes !== undefined && (typeof source.notes !== 'string' || source.notes.length > 2000)) reasons.push('Notes too long');
  const endpoint = source.permittedEndpoint ? canonicalPublicUrl(source.permittedEndpoint) : null;
  if (source.permittedEndpoint && !endpoint) reasons.push('Permitted endpoint must be public HTTPS');
  if (source.method !== 'MANUAL_REVIEW' && !endpoint) reasons.push('Automated method requires explicit endpoint');
  if (source.method === 'MANUAL_REVIEW' && source.permittedEndpoint) reasons.push('Manual review cannot have automated endpoint');
  if (source.approval !== 'APPROVED' && source.enabled) reasons.push('Only approved sources can be enabled');
  // Bound configurations for cross-host redirects and source drift. Fetch layer must separately validate DNS/IP/redirects.
  if (homepage && endpoint && new URL(homepage).hostname !== new URL(endpoint).hostname) reasons.push('Endpoint must share exact hostname with approved homepage');
  if (source.lane === 'PARTNERSHIP' && source.kind === 'BUSINESS_DIRECTORY') reasons.push('Partnership lane cannot treat directory listing as a partnership notice');
  if (reasons.length) return { ok: false, reasons };
  return { ok: true, source: { ...source, homepage: homepage!, permittedEndpoint: endpoint } };
}
/** Registry is initially empty; human-approved config is a later separately authorized persistence step. */
export const DEFAULT_DISCOVERY_SOURCES: readonly RegistrySource[] = Object.freeze([]);
/** Policy gate only, NOT a network permission token and not a collector. */
export function isEligibleForScheduledCollection(source: RegistrySource): boolean {
  const check = validateRegistrySource(source);
  return check.ok && check.source.enabled && check.source.approval === 'APPROVED' && check.source.method !== 'MANUAL_REVIEW';
}
