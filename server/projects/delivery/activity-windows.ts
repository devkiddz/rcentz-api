/** Read-only attribution of canonical commits into milestone activity windows.
 * Does not alter provider-managed milestone states or completion authority.
 */
import { candidateMilestoneKey, marker, sealMarker, versionMarker } from './policy';

export type TimelineCommit = { id: string; sha: string; message: string; committedAt: Date | string };
export type TimelineEvent = {
  id: string; sha: string; message: string; committedAt: Date | string;
  milestoneKey: string | null;
  kind: 'milestone-start' | 'milestone-complete' | 'milestone-seal' | 'milestone-reopen' | 'milestone-cancel' | 'release' | 'commit';
  candidateKey: string | null; version: string | null; prerelease: boolean;
  issue: string | null;
};

/** Input must be in canonical ingestion order, oldest first, for a single source.
 * A checkpoint opens the timeline window until the next explicit start; MSC/MSS
 * close lifecycle phases but DO NOT hide subsequent development activity.
 */
export function attributeActivityWindows(commits: readonly TimelineCommit[]): TimelineEvent[] {
  let current: string | null = null;
  const seen = new Set<string>();
  return commits.map(commit => {
    const subject = commit.message.split(/\r?\n/, 1)[0];
    const result: TimelineEvent = {
      id: commit.id, sha: commit.sha, message: subject, committedAt: commit.committedAt,
      milestoneKey: current, kind: 'commit', candidateKey: null,
      version: null, prerelease: false, issue: null,
    };
    try {
      const seal = sealMarker(commit.message);
      const signal = seal ? null : marker(commit.message);
      if (seal) {
        result.kind = 'milestone-seal'; result.milestoneKey = seal.key;
        if (!seen.has(seal.key)) result.issue = 'UNKNOWN_MILESTONE';
        else if (current !== seal.key) result.issue = 'NON_CURRENT_MILESTONE';
      } else if (signal) {
        result.kind = `milestone-${signal.operation}` as TimelineEvent['kind'];
        result.milestoneKey = signal.key;
        if (signal.operation === 'start') {
          if (seen.has(signal.key)) result.issue = 'MILESTONE_ALREADY_EXISTS';
          else { seen.add(signal.key); current = signal.key; }
        } else if (!seen.has(signal.key)) result.issue = 'UNKNOWN_MILESTONE';
        else if (signal.operation === 'reopen') current = signal.key;
        else if (current !== signal.key) result.issue = 'NON_CURRENT_MILESTONE';
      } else {
        const version = versionMarker(commit.message);
        if (version) { result.kind = 'release'; result.version = version.version; result.prerelease = version.prerelease; }
        result.candidateKey = candidateMilestoneKey(commit.message);
      }
    } catch {
      result.issue = 'INVALID_MARKER';
    }
    return result;
  });
}
