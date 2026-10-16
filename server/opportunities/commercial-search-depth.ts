import { searchWeb } from './search';
import type { commercialQueries } from './client-discovery-policy';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const commercialSearchLimits = { pages: 3, pageSize: 10, fetchBudgetMs: 120000, runBudgetMs: 240000 } as const;
type Plan = ReturnType<typeof commercialQueries>[number];
export type SearchStats = { key: string; label: string; query: string; status: 'SUCCESS' | 'PARTIAL' | 'FAILED'; fetched: number; new: number; existing: number; skipped: number; pagesFetched: number; requests: number };
// Breadth first: every territory gets its first page before any gets a second.
export async function collectSearchPages(plans: Plan[], deadline: number) {
 const batches = plans.map(plan => ({ plan, items: [] as unknown[], more: true, stats: { key: plan.key, label: plan.label, query: plan.query, status: 'SUCCESS', fetched: 0, new: 0, existing: 0, skipped: 0, pagesFetched: 0, requests: 0 } as SearchStats }));
 for (let page = 0; page < commercialSearchLimits.pages; page++) for (const batch of batches) {
  if (!batch.more) continue;
  if (Date.now() >= deadline) { batch.stats.status = batch.stats.pagesFetched ? 'PARTIAL' : 'FAILED'; batch.more = false; continue; }
  batch.stats.requests++;
  try {
   const response = await searchWeb(batch.plan.query, commercialSearchLimits.pageSize, batch.plan.kind === 'REQUEST' ? 'pm' : 'py', page);
   if (!record(response) || !record(response.web) || !Array.isArray(response.web.results)) throw Error('SOURCE_FORMAT');
   const items = response.web.results.slice(0, commercialSearchLimits.pageSize);
   batch.items.push(...items); batch.stats.fetched += items.length; batch.stats.pagesFetched++;
   batch.more = items.length > 0 && record(response.query) && response.query.more_results_available === true;
  } catch { batch.stats.status = batch.stats.pagesFetched ? 'PARTIAL' : 'FAILED'; batch.more = false; }
 }
 return batches;
}
