import type { SourceConfig } from './config';

export type CollectorResult = {
  sourceId: string;
  status: string;
  commits?: number;
  reviewed?: number;
  error?: string;
};

type Synchronize = (source: SourceConfig) => Promise<CollectorResult>;

const safeError = (error: unknown) =>
  error instanceof Error && /^[A-Z][A-Z0-9_]{1,70}$/.test(error.message)
    ? error.message
    : 'SYNC_FAILED';

/**
 * Synchronize every enabled managed source in a bounded, sequential sweep.
 * Sequential provider access avoids a burst against GitHub and keeps the
 * five-minute cron invocation predictable. A failed source never prevents
 * the remaining projects from being collected.
 */
export async function collectDeliverySources(
  all: SourceConfig[],
  selectedId: string | null,
  synchronize: Synchronize
) {
  const selected = selectedId
    ? all.filter(source => source.id === selectedId)
    : all;

  if (selectedId && selected.length !== 1) {
    throw new Error('SOURCE_REQUIRED');
  }

  if (selected.length > 20) {
    throw new Error('SOURCE_LIMIT');
  }

  const results: CollectorResult[] = [];

  for (const source of selected) {
    try {
      results.push(await synchronize(source));
    } catch (error) {
      results.push({
        sourceId: source.id,
        status: 'FAILED',
        error: safeError(error)
      });
    }
  }

  return {
    mode: selectedId ? 'SINGLE' as const : 'ALL' as const,
    total: selected.length,
    succeeded: results.filter(result => result.status !== 'FAILED').length,
    failed: results.filter(result => result.status === 'FAILED').length,
    results
  };
}
