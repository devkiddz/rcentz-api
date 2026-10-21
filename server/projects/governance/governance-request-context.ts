import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

// Only the verified internal API route may set this request-scoped identity.
// Never derive it from a JSON payload or an unverified HTTP header.
const identity = new AsyncLocalStorage<string>();

export function withVerifiedGovernanceIdentity<T>(userId: string, work: () => Promise<T>): Promise<T> {
  if (!/^[a-zA-Z0-9:_-]{1,160}$/.test(userId)) throw new Error('Invalid verified identity');
  return identity.run(userId, work);
}

export function governanceRequestActor(): string | undefined {
  return identity.getStore();
}
