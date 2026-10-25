import { projectMarker } from './project-marker';
import type { Commit } from './policy';

export type ScopedResolution = {
  commit: Commit;
  issue: string | null;
  description: string | null;
  scoped: boolean;
};

/** Source Project.slug is authoritative; no project identity is taken from Git. */
export function projectCodeFromSlug(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    throw new Error('INVALID_PROJECT_SLUG');
  return slug.toUpperCase();
}

/** Only subject markers on first-parent commits enter the existing reducer. */
export function resolveScopedCommit(commit: Commit, projectCode: string): ScopedResolution {
  const original = { commit, issue: null, description: null, scoped: false };
  try {
    const parsed = projectMarker(commit.message);
    if (!parsed) return original;
    if (parsed.projectCode !== projectCode) {
      return { ...original, issue: 'PROJECT_MARKER_MISMATCH', scoped: true };
    }
    const prefix = parsed.operation === 'start' ? 'MS' : parsed.operation === 'complete' ? 'MSC' : 'MSS';
    const normalized = `milestone(${prefix}-${parsed.milestoneKey}): ${parsed.title}`;
    return { commit: { ...commit, message: normalized }, issue: null, description: parsed.description, scoped: true };
  } catch {
    return { ...original, issue: 'INVALID_PROJECT_MARKER', scoped: true };
  }
}
