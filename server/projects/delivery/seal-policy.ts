/** Pure MSS decision policy. A seal never manufactures verification evidence. */
export type SealPhase = 'OPEN' | 'AWAITING' | 'COMPLETE' | 'CANCELLED';
export function sealRequestDecision(phase: SealPhase | null, completionSha: string | null):
  'UNKNOWN' | 'INCOMPLETE' | 'WAIT' | 'SEAL' {
  if (phase === null) return 'UNKNOWN';
  if (!completionSha || phase === 'OPEN' || phase === 'CANCELLED') return 'INCOMPLETE';
  return phase === 'COMPLETE' ? 'SEAL' : 'WAIT';
}
