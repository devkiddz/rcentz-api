/**
 * PM-02: project-qualified marker reader.
 * Read-only syntax support; production reducer wiring follows in PM-03.
 */
export type ProjectMarker = {
  operation: 'start' | 'complete' | 'seal';
  projectCode: string;
  milestoneKey: string;
  title: string;
  description: string | null;
};

const code = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*';
const key = '[A-Z][A-Z0-9_-]{1,39}';
const subjectPattern = new RegExp(
  `^milestone\\((MS|MSC|MSS)-(${code})/(${key})\\): (.{3,160})$`
);
const descriptionPattern = /^Description: ([^\r\n]{1,160})$/;

export function projectMarker(message: string): ProjectMarker | null {
  const lines = message.split(/\r?\n/);
  const subject = lines[0].trim();
  const match = subjectPattern.exec(subject);
  if (!match) {
    if (/^milestone\((?:MS|MSC|MSS)-[^)]*\/[^)]*\)/.test(subject)) {
      throw new Error('INVALID_PROJECT_MARKER');
    }
    return null; // Legacy markers and ordinary commits are not claimed.
  }

  const descriptions = lines.slice(1).filter(line => /^Description:/i.test(line));
  if (descriptions.length > 1) throw new Error('DUPLICATE_DESCRIPTION');
  let description: string | null = null;
  if (descriptions.length === 1) {
    const parsed = descriptionPattern.exec(descriptions[0]);
    if (!parsed || parsed[1].trim() !== parsed[1]) throw new Error('INVALID_DESCRIPTION');
    description = parsed[1];
  }

  return {
    operation: match[1] === 'MS' ? 'start' : match[1] === 'MSC' ? 'complete' : 'seal',
    projectCode: match[2],
    milestoneKey: match[3],
    title: match[4].trim(),
    description
  };
}

/** Reject markers for another project; source/project code resolution is caller-owned. */
export function markerForProject(message: string, expectedProjectCode: string): ProjectMarker | null {
  const parsed = projectMarker(message);
  if (!parsed) return null;
  if (parsed.projectCode !== expectedProjectCode) throw new Error('PROJECT_MARKER_MISMATCH');
  return parsed;
}
