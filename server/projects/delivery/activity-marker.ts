import { marker, sealMarker } from './policy';
import { markerForProject } from './project-marker';

export type ActivityMarker = {
  kind: 'start' | 'complete' | 'reopen' | 'cancel' | 'seal';
  milestoneKey: string;
};

/** Read a marker only when it belongs to the source project's Git stream. */
export function readProjectActivityMarker(
  message: string,
  expectedProjectCode: string
): ActivityMarker | null {
  const lines = message.split(/\r?\n/);

  for (const line of lines) {
    const subject = line.trim();
    if (!/^milestone(?:\(|\s)/.test(subject)) continue;

    try {
      const qualified = markerForProject(subject, expectedProjectCode);
      if (qualified) {
        return { kind: qualified.operation, milestoneKey: qualified.milestoneKey };
      }

      // Legacy markers remain source-scoped by the registered repository.
      const seal = sealMarker(subject);
      if (seal) return { kind: 'seal', milestoneKey: seal.key };

      const signal = marker(subject);
      if (signal) {
        return { kind: signal.operation, milestoneKey: signal.key };
      }
    } catch {
      // A malformed or cross-project marker is not evidence for this project.
    }
  }

  return null;
}
