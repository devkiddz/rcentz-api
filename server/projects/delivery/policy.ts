/** Deterministic delivery rules, independent of providers and database. */
export type Commit = { sha: string; message: string; date: string; parents: string[] };
export type Phase = 'OPEN' | 'AWAITING' | 'COMPLETE' | 'CANCELLED';
export type Item = { key: string; title: string; phase: Phase; completionSha: string | null };
export type State = { activeKey: string | null; items: Record<string, Item> };
export type Marker = { operation: 'start' | 'complete' | 'reopen' | 'cancel'; key: string; title: string };
const keyPattern = '[A-Z][A-Z0-9_-]{1,39}';
const candidatePattern = /\b([A-Z][A-Z0-9]*-\d{1,5})\b/g;

/** Explicit subject-only milestone markers; legacy syntax remains valid. */
export function marker(message: string): Marker | null {
  const subject = message.split(/\r?\n/, 1)[0].trim();
  const legacy = new RegExp(`^milestone (start|complete|reopen|cancel) (${keyPattern}): (.{3,160})$`).exec(subject);
  if (legacy) return { operation: legacy[1] as Marker['operation'], key: legacy[2], title: legacy[3].trim() };
  const tagged = /^milestone\((MS|MSC)-([A-Z][A-Z0-9_-]{1,39})\): (.{3,160})$/.exec(subject);
  if (tagged) return { operation: tagged[1] === 'MS' ? 'start' : 'complete', key: tagged[2], title: tagged[3].trim() };
  if (/^milestone\b/i.test(subject)) throw new Error('INVALID_MARKER');
  return null;
}

/** MSS is recognized separately: sealing needs durable, verified governance in Pass B. */
export function sealMarker(message: string): { key: string; title: string } | null {
  const subject = message.split(/\r?\n/, 1)[0].trim();
  const match = /^milestone\(MSS-([A-Z][A-Z0-9_-]{1,39})\): (.{3,160})$/.exec(subject);
  return match ? { key: match[1], title: match[2].trim() } : null;
}

/** A feature identifier is a candidate, not a milestone-creation instruction. */
export function candidateMilestoneKey(message: string): string | null {
  const subject = message.split(/\r?\n/, 1)[0];
  const keys = [...subject.matchAll(candidatePattern)].map(match => match[1]);
  return new Set(keys).size === 1 ? keys[0] : null;
}

/** Release labels are descriptive until Git tag/deployment verification is added. */
export function versionMarker(message: string): { version: string; prerelease: boolean } | null {
  const subject = message.split(/\r?\n/, 1)[0].trim();
  const match = /^release: (v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?)$/.exec(subject);
  return match ? { version: match[1], prerelease: Boolean(match[5]) } : null;
}
export function applyCommit(previous: State, commit: Commit): { state: State; key: string | null; issue: string | null } {
  const state: State = { activeKey: previous.activeKey, items: { ...previous.items } };
  try {
    // Recognize but do not auto-seal before persistent verification is implemented.
    const seal = sealMarker(commit.message);
    if (seal) {
      if (!state.items[seal.key]) throw new Error('UNKNOWN_MILESTONE');
      if (state.items[seal.key].phase !== 'COMPLETE') throw new Error('SEAL_REQUIRES_VERIFIED_COMPLETION');
      return { state, key: seal.key, issue: 'SEAL_PENDING_PERSISTENCE' };
    }
    const signal = marker(commit.message);
    if (!signal) {
      const trailers = [...commit.message.matchAll(new RegExp(`^Milestone: (${keyPattern})\\s*$`, 'gm'))];
      if (trailers.length > 1) throw new Error('AMBIGUOUS_MILESTONE');
      if (/^Milestone:/mi.test(commit.message) && !trailers.length) throw new Error('INVALID_TRAILER');
      const key = trailers[0]?.[1] ?? state.activeKey;
      if (!key) return { state, key: null, issue: 'NO_ACTIVE_MILESTONE' };
      if (state.items[key]?.phase !== 'OPEN') throw new Error('REOPEN_REQUIRED');
      return { state, key, issue: null };
    }
    const existing = state.items[signal.key];
    if (signal.operation === 'start') {
      if (existing) throw new Error('MILESTONE_ALREADY_EXISTS');
      if (state.activeKey) throw new Error('ACTIVE_MILESTONE_EXISTS');
      state.items[signal.key] = { key: signal.key, title: signal.title, phase: 'OPEN', completionSha: null };
      state.activeKey = signal.key;
    } else {
      if (!existing) throw new Error('UNKNOWN_MILESTONE');
      if (signal.operation === 'reopen') {
        if (state.activeKey && state.activeKey !== signal.key) throw new Error('ACTIVE_MILESTONE_EXISTS');
        if (existing.phase === 'OPEN') throw new Error('ALREADY_OPEN');
        state.items[signal.key] = { ...existing, phase: 'OPEN', completionSha: null };
        state.activeKey = signal.key;
      } else {
        if (existing.phase !== 'OPEN' || state.activeKey !== signal.key) throw new Error('MILESTONE_NOT_ACTIVE');
        state.items[signal.key] = { ...existing, phase: signal.operation === 'complete' ? 'AWAITING' : 'CANCELLED', completionSha: signal.operation === 'complete' ? commit.sha : null };
        state.activeKey = null;
      }
    }
    return { state, key: signal.key, issue: null };
  } catch (error) {
    return { state: previous, key: null, issue: error instanceof Error ? error.message : 'INVALID_COMMIT' };
  }
}
export type Check = { name: string; state: 'success' | 'pending' | 'failure' };
export type Evidence = { sha: string; checks: Check[]; deployment: { id: string; state: string; url: string | null } | null; observedAt: string };
export function completionReady(sha: string | null, requiredChecks: readonly string[], requireDeployment: boolean, evidence: Evidence): boolean {
  if (!sha || sha !== evidence.sha) return false;
  if (!requiredChecks.length && !requireDeployment) return false;
  return requiredChecks.every(name => evidence.checks.some(c => c.name === name && c.state === 'success')) &&
    (!requireDeployment || evidence.deployment?.state === 'READY');
}
/** Only the tracked branch's first-parent history changes the active milestone.
 * Merge/squash commit messages on that branch carry the marker or trailer.
 */
export function firstParentBatch(base: string, head: string, commits: Commit[]): Commit[] {
  if (base === head) return [];
  const bySha = new Map(commits.map(c => [c.sha, c]));
  const chain: Commit[] = []; let sha = head;
  while (sha !== base) {
    const commit = bySha.get(sha);
    if (!commit || !commit.parents[0] || chain.length >= 250) throw new Error('HISTORY_GAP_OR_REWRITE');
    chain.push(commit); sha = commit.parents[0];
  }
  return chain.reverse();
}
