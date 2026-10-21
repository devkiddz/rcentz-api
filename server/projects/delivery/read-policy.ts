/** Read-only access. Does not grant mutation authority. */
export function mayReadDelivery(input: { role: string; status: string; userId: string; clientId: string | null; assignmentRole: string | null; assignmentActive: boolean; visibility: string }): boolean {
  if (input.status !== 'ACTIVE') return false;
  if (input.role === 'SUPER_ADMIN') return true;
  if (input.role === 'ADMIN' && input.assignmentActive && ['PROJECT_MANAGER','PROJECT_VERIFIER','PROJECT_REVIEWER','PROJECT_ADMIN'].includes(input.assignmentRole ?? '')) return true;
  return input.userId === input.clientId && input.visibility !== 'INTERNAL';
}
