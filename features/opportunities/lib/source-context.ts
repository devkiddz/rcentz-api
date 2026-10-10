type SourcePage = { source: string; url: string; title: string; research?: unknown };
export function sourceContext(page: SourcePage): "RESULTS_PAGE" | "DISCOVERY_SNIPPET" | "VACANCY_TEXT" {
  let url: URL;
  try { url = new URL(page.url); } catch { return "DISCOVERY_SNIPPET"; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.toLowerCase();
  const isHost = (domain: string) => host === domain || host.endsWith("." + domain);
  const knownResults =
    (isHost("ziprecruiter.com") && /^\/jobs(?:\/|$)/.test(path)) ||
    ((isHost("indeed.com") || isHost("indeed.co.uk")) && /^\/(?:jobs|q-)/.test(path)) ||
    (isHost("linkedin.com") && /^\/jobs\/(?:search|[^/]+-jobs)(?:\/|$)/.test(path)) ||
    (isHost("glassdoor.com") && /^\/job(?:s|-listing)/.test(path) && !/job-listing/.test(path));
  const resultsTitle = /\b(?:job search|search results|jobs (?:in|near|available)|\d[\d,]* (?:open |available )?(?:jobs|vacancies))\b/i.test(page.title) || /\bjobs\s*$/i.test(page.title);
  if (knownResults || (page.source === "WEB_SEARCH" && resultsTitle)) return "RESULTS_PAGE";
  const research = page.research;
  if (research && typeof research === "object" && "vacancy" in research) {
    const vacancy = research.vacancy;
    if (vacancy && typeof vacancy === "object" && "url" in vacancy && vacancy.url === url.href && "fullText" in vacancy && vacancy.fullText === true) return "VACANCY_TEXT";
  }
  return ["WEB_SEARCH", "HACKER_NEWS"].includes(page.source) ? "DISCOVERY_SNIPPET" : "VACANCY_TEXT";
}
