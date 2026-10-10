import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
export function publicIPv4(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  );
}
export function publicUrl(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    u.hostname === "localhost" ||
    isIP(u.hostname.replace(/^\[|\]$/g, "")) ||
    u.hostname.endsWith(".local") ||
    u.hostname.endsWith(".internal")
  )
    throw Error("Unsafe public URL");
  u.hash = "";
  return u;
}
export async function publicPage(
  value: string,
  limit = 1000000,
  timeout = 8000,
): Promise<{ url: string; status: number; text: string }> {
  const url = publicUrl(value);
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !publicIPv4(a.address)))
    throw Error("Unsafe resolved address");
  const address = addresses[0].address;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        family: 4,
        lookup: (_host, _options, callback) => callback(null, address, 4),
        headers: {
          "User-Agent": "RcentzOpportunityResearch/1.0",
          Accept: "text/html,text/plain,application/json",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const type = res.headers["content-type"] || "";
        const status = res.statusCode || 0;
        if (
          (status >= 300 && status < 400) ||
          !/text\/|application\/(json|ld\+json)/i.test(type)
        ) {
          res.destroy();
          reject(Error("Redirect or unsupported content"));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > limit) {
            res.destroy(Error("Page too large"));
          } else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            url: url.href,
            status,
            text: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    const timer = setTimeout(
      () => req.destroy(Error("Page timed out")),
      timeout,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
}
export function plain(text: string) {
  return text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50000);
}
export async function sourceJson(
  url: string,
  headers: Record<string, string> = {},
) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json", ...headers },
  });
  if (!response.ok) throw Error("Source HTTP " + response.status);
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty source");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 10000000) {
      await reader.cancel();
      throw Error("Source too large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
