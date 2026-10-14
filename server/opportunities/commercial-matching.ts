/** P5 pure matching foundation: no IO, persistence, collection or artificial evidence. */
export type KnowledgeSolution = {
  id: string; key: string; name: string; problem: string;
  proposedWorkflow: string; status: string; groupId: string | null;
  capabilityId: string;
};
export type KnowledgeLink = {
  id: string; rationale: string; priority: number;
  qualificationCriteria: string[]; solution: KnowledgeSolution;
};
export type KnowledgeProblem = {
  id: string; key: string; title: string; description: string;
  symptoms: string[]; impact: string[]; status: string;
  solutions: KnowledgeLink[];
};
export type KnowledgeGroup = { id: string; name: string };
export type MatchInput = {
  text: string; problems: KnowledgeProblem[]; groups: KnowledgeGroup[];
  limit?: number;
};
export type SolutionSuggestion = {
  id: string; name: string; group: string | null;
  status: string; requiresReview: boolean;
  rationale: string; qualificationCriteria: string[];
};
export type ProblemMatch = {
  id: string; title: string; status: string;
  score: number; matchedSignals: string[];
  explanation: string; solutions: SolutionSuggestion[];
};

const stopWords = new Set([
  'a','an','and','are','as','at','be','been','by','can','could','for','from',
  'has','have','in','into','is','it','its','of','on','or','our','the','their',
  'these','this','to','using','we','with','would','your','you','company','business',
  'need','needs','want','looking','help','system','systems','solution',
]);

function terms(value: string): string[] {
  return [...new Set(value.toLowerCase().normalize('NFKC')
    .replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter((word) => word.length >= 3 && !stopWords.has(word)))];
}
function safeStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string').slice(0, 40) : [];
}
function usableText(value: unknown): string { return typeof value === 'string' ? value.slice(0, 12000) : ''; }

/**
 * Evidence-led candidate suggestions. Scores are heuristic relevance, NOT probability
 * of a genuine commercial lead or proof that Rcentz can deliver a solution.
 * Unknown descriptions remain eligible for later human review; no prospects are dropped.
 */
export function matchCommercialProblems(input: MatchInput): ProblemMatch[] {
  const queryTerms = new Set(terms(usableText(input.text)));
  if (!queryTerms.size) return [];
  const max = Math.min(20, Math.max(1, Number.isFinite(input.limit) ? Math.trunc(input.limit!) : 8));
  const groups = new Map((input.groups || []).slice(0, 200).map((g) => [g.id, g.name]));
  const candidates: ProblemMatch[] = [];
  for (const problem of (input.problems || []).slice(0, 500)) {
    if (problem.status === 'ARCHIVED') continue;
    const signals = [problem.title, ...safeStrings(problem.symptoms), ...safeStrings(problem.impact), problem.description];
    const hits: { label: string; overlap: number; index: number; matched: string[] }[] = [];
    signals.forEach((label, index) => {
      const words = terms(usableText(label));
      const found = words.filter((word) => queryTerms.has(word));
      // Require meaningful overlap: 2 shared terms except an exact single-token signal.
      if (found.length >= 2 || (words.length === 1 && found.length === 1))
        hits.push({ label, overlap: found.length / Math.max(1, words.length), index, matched: found });
    });
    if (!hits.length) continue;
    const uniqueHits = [...new Set(hits.flatMap((h) => h.matched))];
    const weighted = hits.reduce((sum, h) => sum + h.overlap * (h.index === 0 ? 30 : h.index <= safeStrings(problem.symptoms).length ? 18 : 8), 0);
    const score = Math.min(100, Math.max(1, Math.round(weighted)));
    const suggestions = new Map<string, SolutionSuggestion>();
    for (const link of problem.solutions || []) {
      const solution = link.solution;
      if (!solution || solution.status === 'ARCHIVED' || !solution.id) continue;
      // Reuse the canonical linked solution record; never derive a new blueprint.
      if (!suggestions.has(solution.id)) suggestions.set(solution.id, {
        id: solution.id, name: solution.name, group: solution.groupId ? groups.get(solution.groupId) || null : null,
        status: solution.status, requiresReview: solution.status !== 'READY' || problem.status !== 'READY',
        rationale: link.rationale, qualificationCriteria: safeStrings(link.qualificationCriteria),
      });
    }
    candidates.push({
      id: problem.id, title: problem.title, status: problem.status, score,
      matchedSignals: hits.slice(0, 5).map((h) => h.label),
      explanation: `Relevant words: ${uniqueHits.slice(0, 8).join(', ')}. Human qualification required.`,
      solutions: [...suggestions.values()],
    });
  }
  return candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)).slice(0, max);
}
