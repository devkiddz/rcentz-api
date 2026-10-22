/** Minimum meaningful manual evidence; provider evidence is fetched independently. */
export function validateEvidence(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Evidence description required');
  const record = value as Record<string, unknown>;
  if (typeof record.description !== 'string' || record.description.trim().length < 10 || record.description.length > 2000 ||
      JSON.stringify(value).length > 8000) throw new Error('Evidence requires a description of 10–2000 characters');
}
