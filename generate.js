// generate.js
import fs from "fs";
import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000 });

const FEEDS = [
  { name: "arXiv quant-ph", url: "https://rss.arxiv.org/rss/quant-ph" },
  { name: "NVIDIA Dev Blog", url: "https://developer.nvidia.com/blog/feed" },
];

function clean(text, maxLen = 160) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > maxLen ? t.slice(0, maxLen - 1) + "…" : t;
}

function scoreItem(item) {
  // Prefer fresh items (today/last ~2 days), and avoid empty titles/links.
  const hasBasics = item?.title && item?.link;
  if (!hasBasics) return -1;

  const dt = new Date(item.isoDate || item.pubDate || 0).getTime();
  const ageHours = (Date.now() - dt) / (1000 * 60 * 60);

  // Freshness bonus: best under 36h, still OK under 72h
  let freshness = 0;
  if (ageHours < 36) freshness = 5;
  else if (ageHours < 72) freshness = 2;

  // Slight bonus if it looks like a “real article”
  const lenBonus = Math.min(2, (item.contentSnippet?.length || 0) / 200);

  return freshness + lenBonus;
}

async function main() {
  const allItems = [];

  for (const f of FEEDS) {
    const feed = await parser.parseURL(f.url);
    for (const item of feed.items || []) {
      allItems.push({
        source: f.name,
        title: item.title,
        url: item.link,
        date: item.isoDate || item.pubDate || null,
        summary: clean(item.contentSnippet || item.content || "", 180),
      });
    }
  }

  allItems.sort((a, b) => scoreItem(b) - scoreItem(a));

  const pick = allItems[0] || {
    source: "Daily Drop",
    title: "No fresh item found today — try again later",
    url: "https://rss.arxiv.org/rss/quant-ph",
    date: new Date().toISOString(),
    summary: "Fallback link.",
  };

  const out = {
    generatedAt: new Date().toISOString(),
    ...pick,
  };

  fs.writeFileSync("daily.json", JSON.stringify(out, null, 2));
  console.log("Wrote daily.json:", out.title);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
