/** Pure validation shared by API routes and tests. */
export function validSourceProjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
export function validRequiredChecks(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 20 &&
    value.every(v => typeof v === 'string' && v.length > 0 && v.length <= 150 &&
      v.trim() === v) && new Set(value).size === value.length;
}
export type ExistingSource = {
  projectId: string; enabled: boolean; actorId: string | null; baselineSha: string | null;
  configHash: string; cursorSha: string; leaseUntil: Date | null;
};
/** State-changing operations must not reinitialize or reset an existing source. */
export function mayToggleSource(source: ExistingSource | null, projectId: unknown, operation: 'enable' | 'disable'): boolean {
  if (!source || !validSourceProjectId(projectId) || source.projectId !== projectId) return false;
  if (operation === 'disable') return true;
  return Boolean(source.actorId && source.baselineSha && /^[a-f0-9]{40}$/.test(source.baselineSha) &&
    /^[a-f0-9]{40}$/.test(source.cursorSha) && source.configHash &&
    (!source.leaseUntil || source.leaseUntil.getTime() <= Date.now()));
}