import type { Listing } from '@/features/opportunities/lib/matching';
const endpoint = 'https://remotive.com/api/remote-jobs?category=software-dev';
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function plain(value: string) { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim().slice(0, 50000); }
export function parseRemotive(payload: unknown): Listing[] {
  if (!record(payload) || !Array.isArray(payload.jobs) || payload.jobs.length > 5000) throw new Error('Invalid source response');
  const listings: Listing[] = [];
  for (const item of payload.jobs) {
    if (!record(item) || typeof item.id !== 'number' || typeof item.title !== 'string' || typeof item.url !== 'string' || typeof item.company_name !== 'string' || typeof item.description !== 'string' || typeof item.publication_date !== 'string') throw new Error('Invalid source listing');
    const url = new URL(item.url);
    if (url.protocol !== 'https:' || url.hostname !== 'remotive.com') throw new Error('Invalid source URL');
    const publishedAt = new Date(item.publication_date.endsWith('Z') ? item.publication_date : item.publication_date + 'Z');
    if (Number.isNaN(publishedAt.getTime())) throw new Error('Invalid publication date');
    listings.push({ externalId: String(item.id), title: item.title.slice(0, 250), company: item.company_name.slice(0, 250), url: url.href, description: plain(item.description), location: typeof item.candidate_required_location === 'string' ? item.candidate_required_location.slice(0, 500) : '', salary: typeof item.salary === 'string' && item.salary ? item.salary.slice(0, 500) : null, jobType: typeof item.job_type === 'string' ? item.job_type : 'unknown', publishedAt });
  }
  return [...new Map(listings.map(item => [item.externalId, item])).values()];
}
export async function collectRemotive(): Promise<Listing[]> {
  const response = await fetch(endpoint, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Job source unavailable');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty source response');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 10000000) { await reader.cancel(); throw new Error('Source response too large'); } chunks.push(value); }
  return parseRemotive(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}
