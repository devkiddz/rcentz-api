import { searchWeb } from "./search";
import { createHash } from "node:crypto";
import { plain, publicPage, publicUrl } from "./web";
import type { SourceListing } from "./sources";
export type Research = {
  risk: "HIGH" | "REVIEW" | "UNKNOWN";
  flags: { reason: string; evidence: string }[];
  contacts: {
    email: string;
    sourceUrl: string;
    observedAt: string;
    association: "PUBLISHED_CONTACT_UNVERIFIED";
  }[];
  pages: { url: string; status: string }[];
  coverage: string;
  publishedKnown: boolean;
  checkedAt: string;
};
const boardHosts = [
  "remotive.com",
  "jobicy.com",
  "arbeitnow.com",
  "news.ycombinator.com",
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
];
export function canonicalKey(listing: SourceListing) {
  const u = publicUrl(listing.url);
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|ref|source|tracking/i.test(key)) u.searchParams.delete(key);
  return createHash("sha256").update(u.href.replace(/\/$/, "")).digest("hex");
}
export function spamSignals(text: string) {
  const rules: [RegExp, string][] = [
    [
      /(?:pay|payment|deposit|send money).{0,65}(?:registration fee|application fee|to secure (?:the |a )?job|to unlock|before (?:you can |starting)|gift cards?)/i,
      "Payment requested to obtain employment",
    ],
    [
      /(?:deposit|cash).{0,40}(?:check|cheque).{0,100}(?:send|transfer|return).{0,40}(?:money|funds|balance)/i,
      "Possible fake-check money-transfer arrangement",
    ],
    [
      /(?:bank (?:password|login)|seed phrase|wallet recovery phrase|one.time password|otp code)/i,
      "Sensitive credential request",
    ],
    [
      /(?:earn|make).{0,25}(?:\$\d{3,}|thousands).{0,70}(?:no (?:work|experience)|guaranteed|minutes per day)/i,
      "Exceptional earnings claim with little work",
    ],
  ];
  return rules.flatMap(([pattern, reason]) => {
    const m = pattern.exec(text);
    if (!m) return [];
    const context = text.slice(
      Math.max(0, m.index - 50),
      m.index + m[0].length + 80,
    );
    if (
      /(?:never|do not|don't|no need to)\s+(?:pay|send|deposit)/i.test(context)
    )
      return [];
    return [{ reason, evidence: context.slice(0, 240) }];
  });
}
export function publicContacts(text: string, sourceUrl: string) {
  const visible = plain(text);
  const emails = [
    ...new Set(
      (visible.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(
        (e) => e.toLowerCase(),
      ),
    ),
  ];
  return emails
    .filter(
      (e) =>
        /^(careers?|jobs?|hr|talent|recruit(?:ment|ing)?|hiring|hello|info|contact|business|sales|partnerships?)[._+-]?/i.test(
          e,
        ) &&
        !/(?:example\.com|sentry\.io|wixpress\.com|remotive\.com|jobicy\.com|arbeitnow\.com)$/.test(
          e,
        ),
    )
    .slice(0, 5)
    .map((email) => ({
      email,
      sourceUrl,
      observedAt: new Date().toISOString(),
      association: "PUBLISHED_CONTACT_UNVERIFIED" as const,
    }));
}
export function robotsAllow(text: string, path: string) {
  let agents: string[] = [],
    rules: string[] = [],
    seenRule = false;
  const groups: { agents: string[]; rules: string[] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const split = line.indexOf(":");
    if (split < 0) continue;
    const directive = line.slice(0, split).toLowerCase(),
      value = line.slice(split + 1).trim();
    if (directive === "user-agent") {
      if (seenRule) {
        groups.push({ agents, rules });
        agents = [];
        rules = [];
        seenRule = false;
      }
      agents.push(value.toLowerCase());
    } else if (directive === "disallow") {
      seenRule = true;
      if (value) rules.push(value);
    }
  }
  groups.push({ agents, rules });
  // Conservative: obey both wildcard and explicit Rcentz groups; ambiguous rules never widen access.
  return !groups.some(
    (g) =>
      g.agents.some(
        (a) => a === "*" || a.includes("rcentzopportunityresearch"),
      ) &&
      g.rules.some((r) => r === "/" || path.startsWith(r.replace(/\*.*$/, ""))),
  );
}
async function allowedByRobots(url: string) {
  const u = publicUrl(url);
  try {
    const robots = await publicPage(
      new URL("/robots.txt", u).href,
      100000,
      4000,
    );
    return (
      robots.status === 404 ||
      (robots.status === 200 && robotsAllow(robots.text, u.pathname))
    );
  } catch {
    return false;
  }
}
export function jobPosting(html: string) {
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      const roots = Array.isArray(parsed) ? parsed : [parsed];
      for (const root of roots) {
        if (!root || typeof root !== "object") continue;
        const r = root as Record<string, unknown>;
        const nodes = Array.isArray(r["@graph"]) ? r["@graph"] : [r];
        for (const node of nodes) {
          if (!node || typeof node !== "object") continue;
          const n = node as Record<string, unknown>;
          if (
            n["@type"] !== "JobPosting" ||
            typeof n.title !== "string" ||
            typeof n.description !== "string"
          )
            continue;
          const org =
            n.hiringOrganization && typeof n.hiringOrganization === "object"
              ? (n.hiringOrganization as Record<string, unknown>)
              : {};
          return {
            title: plain(n.title).slice(0, 250),
            description: plain(n.description),
            company:
              typeof org.name === "string"
                ? plain(org.name).slice(0, 250)
                : null,
          };
        }
      }
    } catch {
      /* Invalid structured data is not executed or trusted. */
    }
  }
  return null;
}
export async function investigate(
  listing: SourceListing,
  fetchPages: boolean,
): Promise<Research> {
  const contacts = publicContacts(listing.description, listing.url);
  let full = listing.description;
  const pages: Research["pages"] = [];
  const candidateUrls = [listing.url];
  if (
    fetchPages &&
    process.env.OPPORTUNITY_SEARCH_API_KEY &&
    listing.company !== "Employer requires research" &&
    listing.company !== "Employer unconfirmed"
  ) {
    try {
      const p = (await searchWeb(
        `"${listing.company.slice(0, 100)}" official company careers contact email`,
        3,
      )) as { web?: { results?: { url?: string }[] } };
      for (const result of p.web?.results || [])
        if (result.url) {
          try {
            candidateUrls.push(publicUrl(result.url).href);
          } catch {}
        }
    } catch {
      pages.push({ url: listing.url, status: "Company search unavailable" });
    }
  }
  if (fetchPages)
    for (const url of [...new Set(candidateUrls)].slice(0, 2)) {
      try {
        if (!(await allowedByRobots(url))) {
          pages.push({
            url,
            status: "Not fetched: robots policy unavailable or restrictive",
          });
          continue;
        }
        const page = await publicPage(url);
        pages.push({
          url,
          status:
            page.status === 200
              ? "Public page retrieved"
              : `HTTP ${page.status}`,
        });
        if (page.status !== 200) continue;
        const posting = jobPosting(page.text);
        if (posting && listing.source === "WEB_SEARCH") {
          listing.title = posting.title;
          listing.description = posting.description;
          if (posting.company) listing.company = posting.company;
        }
        full += " " + plain(page.text);
        contacts.push(...publicContacts(page.text, url));
        // Only follow a contact page explicitly linked from the retrieved page, on the same origin.
        if (!boardHosts.includes(new URL(url).hostname)) {
          const match = [...page.text.matchAll(/href=["']([^"']+)["']/gi)]
            .map((m) => m[1])
            .find((h) => /contact|careers|join-us/i.test(h));
          if (match) {
            const contactUrl = new URL(match, url);
            if (
              contactUrl.origin === new URL(url).origin &&
              (await allowedByRobots(contactUrl.href))
            ) {
              const contactPage = await publicPage(contactUrl.href);
              pages.push({
                url: contactUrl.href,
                status:
                  contactPage.status === 200
                    ? "Linked contact page retrieved"
                    : `HTTP ${contactPage.status}`,
              });
              if (contactPage.status === 200)
                contacts.push(
                  ...publicContacts(contactPage.text, contactUrl.href),
                );
            }
          }
        }
      } catch {
        pages.push({
          url,
          status:
            "Page unavailable, redirected or blocked by safe-fetch checks",
        });
      }
    }
  const flags = spamSignals(full);
  if (/(?:telegram|whatsapp).{0,80}(?:only|immediately|urgent)/i.test(full))
    flags.push({
      reason: "Pressure to move recruitment to private messaging",
      evidence:
        "Messaging and urgency wording appears in source; inspect the original context.",
    });
  const unknown =
    listing.source === "WEB_SEARCH" || listing.source === "HACKER_NEWS";
  return {
    risk: flags.length ? "HIGH" : unknown ? "REVIEW" : "UNKNOWN",
    flags,
    contacts: [
      ...new Map(
        contacts.map((c) => [c.email + "|" + c.sourceUrl, c]),
      ).values(),
    ].slice(0, 8),
    pages,
    coverage: fetchPages
      ? "Source text plus available public pages; employer identity and email deliverability NOT independently authenticated."
      : "Source-text screening only; page and employer verification pending.",
    publishedKnown: listing.publishedKnown,
    checkedAt: new Date().toISOString(),
  };
}
