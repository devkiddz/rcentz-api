// Convert source formatting to bounded plain text; never render source HTML.
const entities: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™",
  euro: "€", pound: "£", yen: "¥", ensp: " ", emsp: " ", thinsp: " ",
};

export function plain(value: string) {
  let text = value.slice(0, 250000);
  // Some feeds encode an already encoded description. Bound the work.
  for (let pass = 0; pass < 3; pass++) {
    const next = text.replace(/&(#x[0-9a-f]{1,8}|#[0-9]{1,10}|[a-z][a-z0-9]{1,31});/gi,
      (entity, code: string) => {
        if (!code.startsWith("#")) return entities[code] ?? entity;
        const hex = code[1].toLowerCase() === "x";
        const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
        return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
          ? String.fromCodePoint(point) : "�";
      });
    if (next === text) break;
    text = next;
  }
  return text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50000);
}
