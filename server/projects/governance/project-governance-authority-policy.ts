/** Default-deny, project-scoped governance authorization policy. */
export type GovernanceOperation =
  | 'milestone:manage'
  | 'criterion:manage'
  | 'criterion:verify'
  | 'milestone:review'
  | 'project:override';

export type GovernanceIdentity = {
  status: string;
  role: string;
  assignmentRole: string | null;
  assignmentActive: boolean;
};

/** SUPER_ADMIN is global; ADMIN requires an active assignment for every operation. */
export function canPerformGovernanceOperation(
  identity: GovernanceIdentity,
  operation: GovernanceOperation,
): boolean {
  if (identity.status !== 'ACTIVE') return false;
  if (identity.role === 'SUPER_ADMIN') return true;
  if (identity.role !== 'ADMIN' || !identity.assignmentActive) return false;
  const assignmentRole = identity.assignmentRole;
  if (assignmentRole === 'PROJECT_MANAGER') return operation === 'criterion:manage' || operation === 'milestone:manage';
  if (assignmentRole === 'PROJECT_VERIFIER') return operation === 'criterion:verify';
  if (assignmentRole === 'PROJECT_REVIEWER') return operation === 'milestone:review';
  if (assignmentRole === 'PROJECT_ADMIN') return true;
  return false;
}
