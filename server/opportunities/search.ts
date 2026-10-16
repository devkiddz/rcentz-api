import { sourceJson } from "./web";
// Serialize provider calls, including employer research, to respect one-request/second plans.
let queue: Promise<unknown> = Promise.resolve();
let next = 0;
export function searchWeb(query: string, count = 8, freshness?: "pm" | "py", offset = 0) {
  const task = queue.then(async () => {
    const key = process.env.OPPORTUNITY_SEARCH_API_KEY;
    if (!key) throw Error("SEARCH_NOT_CONFIGURED");
    const delay = Math.max(0, next - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    next = Date.now() + 1100;
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(count));
    url.searchParams.set("country", "ALL");
    url.searchParams.set("extra_snippets", "true");
    if (freshness) url.searchParams.set("freshness", freshness);
    if (offset) url.searchParams.set("offset", String(offset));
    return sourceJson(url.href, { "X-Subscription-Token": key });
  });
  queue = task.catch(() => {});
  return task;
}
