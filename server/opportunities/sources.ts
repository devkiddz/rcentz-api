import { searchWeb } from "./search";
import { createHash } from "node:crypto";
import type { Listing } from "@/features/opportunities/lib/matching";
import { collectRemotive } from "./remotive";
import { plain, publicUrl, sourceJson } from "./web";
export type SourceListing = Listing & {
  source: string;
  kind: string;
  publishedKnown: boolean;
};
export type SourceBatch = {
  source: string;
  status: string;
  listings: SourceListing[];
  message: string | null;
};
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function text(v: unknown, max = 50000) {
  return typeof v === "string" ? plain(v).slice(0, max) : "";
}
function date(v: unknown) {
  const d = new Date(
    typeof v === "number" ? v * 1000 : typeof v === "string" ? v : "",
  );
  return Number.isFinite(d.getTime()) ? d : null;
}
function row(
  source: string,
  id: unknown,
  title: unknown,
  company: unknown,
  url: unknown,
  description: unknown,
  location: unknown,
  salary: unknown,
  type: unknown,
  published: unknown,
  kind = "EMPLOYMENT",
): SourceListing | null {
  if (typeof url !== "string" || !text(title) || !text(description))
    return null;
  try {
    const u = publicUrl(url);
    const publishedAt = date(published);
    return {
      source,
      kind:
        kind === "EMPLOYMENT" &&
        /contract|freelance/i.test(text(type) + " " + text(title))
          ? "CONTRACT"
          : kind,
      publishedKnown: !!publishedAt,
      externalId: String(
        id || createHash("sha256").update(u.href).digest("hex"),
      ).slice(0, 160),
      title: text(title, 250),
      company: text(company, 250) || "Employer unconfirmed",
      url: u.href,
      description: text(description),
      location: text(location, 500),
      salary: text(salary, 500) || null,
      jobType: text(type, 80) || "unknown",
      publishedAt: publishedAt || new Date(),
    };
  } catch {
    return null;
  }
}
export function parseFeed(source: string, payload: unknown): SourceListing[] {
  const out: SourceListing[] = [];
  if (source === "JOBICY") {
    if (!object(payload) || !Array.isArray(payload.jobs))
      throw Error("Invalid Jobicy feed");
    for (const v of payload.jobs.slice(0, 200))
      if (object(v)) {
        const r = row(
          source,
          v.id,
          v.jobTitle,
          v.companyName,
          v.url,
          v.jobDescription,
          v.jobGeo,
          v.salaryMin
            ? `${v.salaryMin} – ${v.salaryMax || "?"} ${v.salaryCurrency || ""} / ${v.salaryPeriod || "unspecified"}`
            : null,
          Array.isArray(v.jobType) ? v.jobType.join(", ") : v.jobType,
          v.pubDate,
        );
        if (r) out.push(r);
      }
  } else if (source === "ARBEITNOW") {
    if (!object(payload) || !Array.isArray(payload.data))
      throw Error("Invalid Arbeitnow feed");
    for (const v of payload.data.slice(0, 500))
      if (object(v)) {
        const r = row(
          source,
          v.slug,
          v.title,
          v.company_name,
          v.url,
          v.description,
          v.remote ? `${v.location || ""} · Remote` : v.location,
          null,
          Array.isArray(v.job_types) ? v.job_types.join(", ") : null,
          v.created_at,
        );
        if (r) out.push(r);
      }
  } else if (source.startsWith("GREENHOUSE:")) {
    if (!object(payload) || !Array.isArray(payload.jobs))
      throw Error("Invalid Greenhouse board");
    for (const v of payload.jobs.slice(0, 1500))
      if (object(v)) {
        const r = row(
          source,
          v.id,
          v.title,
          v.company_name || source.split(":")[1],
          v.absolute_url,
          v.content,
          object(v.location) ? v.location.name : "",
          null,
          null,
          v.first_published || v.updated_at,
        );
        if (r) out.push({ ...r, publishedKnown: !!v.first_published });
      }
  } else if (source.startsWith("LEVER:")) {
    if (!Array.isArray(payload)) throw Error("Invalid Lever board");
    for (const v of payload.slice(0, 300))
      if (object(v)) {
        const c = object(v.categories) ? v.categories : {};
        const r = row(
          source,
          v.id,
          v.text,
          source.split(":")[1],
          v.hostedUrl,
          v.descriptionPlain || v.description,
          c.location,
          null,
          c.commitment,
          v.createdAt ? Number(v.createdAt) / 1000 : null,
        );
        if (r) out.push(r);
      }
  }
  return out;
}
export function researchQueries(roles: string[], skills: string[]) {
  const stack = skills.slice(0, 3).join(" ");
  const day = Math.floor(Date.now() / 86400000);
  const rotated =
    roles.length > 3
      ? [
          ...roles.slice(day % roles.length),
          ...roles.slice(0, day % roles.length),
        ]
      : roles;
  const region = [
    "Europe UK visa sponsorship",
    "Canada Americas remote",
    "Australia Asia Pacific remote",
  ][day % 3];
  return [
    ...rotated.slice(0, 3).map((role) => ({
      q: `${role} ${stack} remote worldwide careers job`,
      kind: "EMPLOYMENT",
    })),
    {
      q: `${stack} developer contract freelance project hiring`,
      kind: "CONTRACT",
    },
    {
      q: `${stack} software development request for proposal tender`,
      kind: "PROJECT",
    },
    {
      q: `${stack} developer relocation visa sponsorship careers ${region}`,
      kind: "EMPLOYMENT",
    },
  ];
}
async function search(roles: string[], skills: string[]): Promise<SourceBatch> {
  const key = process.env.OPPORTUNITY_SEARCH_API_KEY;
  if (!key) throw Error("SEARCH_NOT_CONFIGURED");
  const out: SourceListing[] = [];
  let completed = 0;
  const queries = researchQueries(roles, skills);
  for (const { q, kind } of researchQueries(roles, skills)) {
    let p: unknown;
    try {
      p = await searchWeb(q);
      completed++;
    } catch {
      continue;
    }
    if (!object(p) || !object(p.web) || !Array.isArray(p.web.results)) continue;
    for (const v of p.web.results)
      if (object(v)) {
        const r = row(
          "WEB_SEARCH",
          null,
          v.title,
          "Employer requires research",
          v.url,
          [
            v.description,
            ...(Array.isArray(v.extra_snippets) ? v.extra_snippets : []),
          ]
            .filter((x) => typeof x === "string")
            .join(" "),
          "Not established",
          null,
          "unconfirmed",
          null,
          kind,
        );
        if (r) out.push(r);
      }
  }
  if (!completed) throw Error("Search unavailable");
  return {
    source: "WEB_SEARCH",
    status: completed === queries.length ? "SUCCESS" : "PARTIAL",
    listings: out,
    message:
      completed === queries.length
        ? null
        : `${completed}/${queries.length} discovery searches completed; other query failures preserved separately from saved results.`,
  };
}
async function hn(): Promise<SourceListing[]> {
  const p = await sourceJson(
    "https://hacker-news.firebaseio.com/v0/jobstories.json",
  );
  if (!Array.isArray(p)) throw Error("Invalid HN jobs");
  const jobs = await Promise.all(
    p
      .slice(0, 30)
      .filter((id) => typeof id === "number")
      .map(async (id) => {
        try {
          const v = await sourceJson(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
          );
          if (!object(v) || v.dead || v.deleted) return null;
          return row(
            "HACKER_NEWS",
            id,
            v.title,
            "Employer unconfirmed",
            v.url || `https://news.ycombinator.com/item?id=${id}`,
            v.text || v.title,
            "Not established",
            null,
            "unknown",
            v.time,
          );
        } catch {
          return null;
        }
      }),
  );
  return jobs.filter((r): r is SourceListing => !!r);
}
export async function discover(
  roles: string[],
  skills: string[],
  researchEnabled: boolean,
): Promise<SourceBatch[]> {
  const tasks: {
    source: string;
    run: () => Promise<SourceListing[] | SourceBatch>;
  }[] = [
    {
      source: "REMOTIVE",
      run: async () =>
        (await collectRemotive()).map((v) => ({
          ...v,
          source: "REMOTIVE",
          kind: /contract|freelance/i.test(v.jobType)
            ? "CONTRACT"
            : "EMPLOYMENT",
          publishedKnown: true,
        })),
    },
    {
      source: "JOBICY",
      run: async () =>
        parseFeed(
          "JOBICY",
          await sourceJson(
            "https://jobicy.com/api/v2/remote-jobs?count=100&industry=engineering",
          ),
        ),
    },
    {
      source: "ARBEITNOW",
      run: async () =>
        parseFeed(
          "ARBEITNOW",
          await sourceJson("https://www.arbeitnow.com/api/job-board-api"),
        ),
    },
    { source: "HACKER_NEWS", run: hn },
  ];
  const gh = (
    process.env.OPPORTUNITY_GREENHOUSE_BOARDS || "vercel,stripe,cloudflare"
  )
    .split(",")
    .filter((x) => /^[a-z0-9_-]{1,80}$/i.test(x))
    .slice(0, 6);
  for (const board of gh)
    tasks.push({
      source: "GREENHOUSE:" + board,
      run: async () =>
        parseFeed(
          "GREENHOUSE:" + board,
          await sourceJson(
            `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`,
          ),
        ),
    });
  const lever = (process.env.OPPORTUNITY_LEVER_BOARDS || "")
    .split(",")
    .filter((x) => /^[a-z0-9_-]{1,80}$/i.test(x))
    .slice(0, 4);
  for (const board of lever)
    tasks.push({
      source: "LEVER:" + board,
      run: async () =>
        parseFeed(
          "LEVER:" + board,
          await sourceJson(
            `https://api.lever.co/v0/postings/${board}?mode=json&limit=300`,
          ),
        ),
    });
  if (researchEnabled)
    tasks.push({ source: "WEB_SEARCH", run: () => search(roles, skills) });
  return Promise.all(
    tasks.map(async (task) => {
      try {
        const result = await task.run();
        if (!Array.isArray(result)) return result;
        const listings = result;
        return {
          source: task.source,
          status: "SUCCESS",
          listings,
          message: null,
        };
      } catch {
        return {
          source: task.source,
          status:
            task.source === "WEB_SEARCH" &&
            !process.env.OPPORTUNITY_SEARCH_API_KEY
              ? "NOT_CONFIGURED"
              : "FAILED",
          listings: [],
          message:
            task.source === "WEB_SEARCH" &&
            !process.env.OPPORTUNITY_SEARCH_API_KEY
              ? "Broad web discovery requires OPPORTUNITY_SEARCH_API_KEY. Feed and board discovery continues."
              : "Source unavailable or invalid; saved records preserved.",
        };
      }
    }),
  );
}
