// Pulls trending headlines from public Google News RSS feeds. No API key needed.

export type TrendItem = {
  title: string;
  summary: string;
  category: string;
  source_name: string;
  source_url: string;
  dedupe_key: string;
  score: number;
};

const FEEDS: Record<string, string> = {
  general: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
  entertainment:
    "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en-US&gl=US&ceid=US:en",
  politics: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-US&gl=US&ceid=US:en",
  social: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en",
  sports: "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en",
  technology:
    "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en",
  business: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en",
};

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

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function readFeed(category: string, url: string, limit: number): Promise<TrendItem[]> {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; TrendJester/1.0)" },
  });
  if (!response.ok) return [];
  const xml = await response.text();
  const blocks = xml.split("<item>").slice(1, limit + 1);

  return blocks.map((block, index) => {
    const rawTitle = pick(block, "title");
    const source = pick(block, "source") || rawTitle.split(" - ").pop() || "News";
    const title = rawTitle.replace(new RegExp(`\\s*-\\s*${source}$`), "").trim() || rawTitle;
    const summary = pick(block, "description").slice(0, 400);
    return {
      title,
      summary,
      category,
      source_name: source,
      source_url: pick(block, "link"),
      dedupe_key: `${category}:${slug(title)}`,
      score: Math.max(1, limit - index),
    };
  });
}

export async function fetchTrending(categories: string[], perFeed = 6): Promise<TrendItem[]> {
  const selected = categories.filter((category) => FEEDS[category]);
  const active = selected.length > 0 ? selected : ["general"];
  const results = await Promise.all(
    active.map((category) =>
      readFeed(category, FEEDS[category]!, perFeed).catch(() => [] as TrendItem[]),
    ),
  );

  const seen = new Set<string>();
  const items: TrendItem[] = [];
  for (const item of results.flat()) {
    if (!item.title || seen.has(item.dedupe_key)) continue;
    seen.add(item.dedupe_key);
    items.push(item);
  }
  return items;
}

export const AVAILABLE_CATEGORIES = Object.keys(FEEDS);
