// Pulls fresh trending headlines from multiple public RSS/Atom feeds. No API key needed.
// Every feed is filtered to the last ~36 hours so each daily run gets new stories.

export type TrendItem = {
  title: string;
  summary: string;
  category: string;
  source_name: string;
  source_url: string;
  dedupe_key: string;
  score: number;
  published_at: string;
};

const GNEWS = (topic: string) =>
  `https://news.google.com/rss/headlines/section/topic/${topic}?hl=en-US&gl=US&ceid=US:en`;

// Google News search feeds restricted to the last day keep results genuinely fresh.
const GSEARCH = (query: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:1d`)}&hl=en-US&gl=US&ceid=US:en`;

const FEEDS: Record<string, string[]> = {
  general: [
    "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://moxie.foxnews.com/google-publisher/latest.xml",
  ],
  entertainment: [
    GNEWS("ENTERTAINMENT"),
    "https://variety.com/feed/",
    GSEARCH("celebrity viral moment"),
  ],
  politics: [GNEWS("NATION"), GSEARCH("politics headline")],
  social: [
    GNEWS("WORLD"),
    "https://www.reddit.com/r/all/top/.rss?t=day",
    GSEARCH("goes viral social media"),
  ],
  sports: [GNEWS("SPORTS"), "https://www.espn.com/espn/rss/news"],
  technology: [
    GNEWS("TECHNOLOGY"),
    "https://hnrss.org/frontpage?points=150",
    "https://techcrunch.com/feed/",
  ],
  business: [GNEWS("BUSINESS"), "https://feeds.bbci.co.uk/news/business/rss.xml"],
};

const MAX_AGE_HOURS = 36;

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(block: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
  return match?.[1] ? decode(match[1]) : "";
}

function pickLink(block: string): string {
  const plain = pick(block, "link");
  if (plain) return plain;
  const href = /<link[^>]*href="([^"]+)"/.exec(block);
  return href?.[1] ?? "";
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function parseDate(block: string): number | null {
  const raw = pick(block, "pubDate") || pick(block, "updated") || pick(block, "published");
  if (!raw) return null;
  const time = Date.parse(raw);
  return Number.isNaN(time) ? null : time;
}

async function readFeed(category: string, url: string, limit: number): Promise<TrendItem[]> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TrendJester/1.0)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
  });
  if (!response.ok) return [];
  const xml = await response.text();
  const separator = xml.includes("<item>") ? "<item>" : "<entry>";
  const blocks = xml.split(separator).slice(1, limit + 1);
  const now = Date.now();

  const items: TrendItem[] = [];
  for (const [index, block] of blocks.entries()) {
    const rawTitle = pick(block, "title");
    if (!rawTitle) continue;

    const published = parseDate(block);
    const ageHours = published ? (now - published) / 3_600_000 : 0;
    if (published && (ageHours > MAX_AGE_HOURS || ageHours < -2)) continue;

    const source = pick(block, "source") || rawTitle.split(" - ").pop() || "News";
    const title = rawTitle.replace(new RegExp(`\\s*-\\s*${source}$`), "").trim() || rawTitle;
    const summary = (pick(block, "description") || pick(block, "content")).slice(0, 400);

    // Recency dominates the ranking, feed position breaks ties.
    const freshness = Math.max(0, MAX_AGE_HOURS - ageHours) * 3;
    items.push({
      title,
      summary,
      category,
      source_name: source,
      source_url: pickLink(block),
      dedupe_key: `${category}:${slug(title)}`,
      score: Math.round(freshness + Math.max(1, limit - index)),
      published_at: new Date(published ?? now).toISOString(),
    });
  }
  return items;
}

export async function fetchTrending(categories: string[], perFeed = 8): Promise<TrendItem[]> {
  const selected = categories.filter((category) => FEEDS[category]);
  const active = selected.length > 0 ? selected : ["general"];

  const jobs = active.flatMap((category) =>
    FEEDS[category]!.map((url) =>
      readFeed(category, url, perFeed).catch(() => [] as TrendItem[]),
    ),
  );
  const results = await Promise.all(jobs);

  const seen = new Set<string>();
  const items: TrendItem[] = [];
  for (const item of results.flat().sort((a, b) => b.score - a.score)) {
    if (!item.title || seen.has(item.dedupe_key)) continue;
    seen.add(item.dedupe_key);
    items.push(item);
  }
  return items;
}

export const AVAILABLE_CATEGORIES = Object.keys(FEEDS);
