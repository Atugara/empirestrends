// Publishing adapters. Connected networks post through the connector gateway;
// the rest stay copy-and-paste until their account is linked.

export type PublishResult = { ok: true; url?: string } | { ok: false; message: string };

const GATEWAY = "https://connector-gateway.lovable.dev";

/** Env var holding the connection key for each network. */
const CONNECTION_KEYS: Record<string, string> = {
  linkedin: "LINKEDIN_API_KEY",
  twitter: "X_API_KEY",
  tiktok: "TIKTOK_API_KEY",
};

/** Networks the bot can post to on its own once connected. */
const AUTO_POST = new Set(["linkedin", "twitter"]);

export function isChannelConnected(channel: string): boolean {
  const key = CONNECTION_KEYS[channel];
  if (!key) return false;
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env[key]);
}

export function canAutoPost(channel: string): boolean {
  return AUTO_POST.has(channel) && isChannelConnected(channel);
}

function gatewayHeaders(channel: string): Record<string, string> | null {
  const key = CONNECTION_KEYS[channel];
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = key ? process.env[key] : undefined;
  if (!lovableApiKey || !connectionKey) return null;
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
  };
}

async function publishToLinkedIn(body: string): Promise<PublishResult> {
  const headers = gatewayHeaders("linkedin");
  if (!headers) return { ok: false, message: "LinkedIn is not connected yet." };

  const me = await fetch(`${GATEWAY}/linkedin/v2/userinfo`, { headers });
  if (!me.ok) {
    return { ok: false, message: `LinkedIn profile lookup failed (${me.status}).` };
  }
  const profile = (await me.json()) as { sub?: string };
  if (!profile.sub) return { ok: false, message: "LinkedIn did not return an account id." };

  const post = await fetch(`${GATEWAY}/linkedin/v2/ugcPosts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      author: `urn:li:person:${profile.sub}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: body },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!post.ok) {
    const detail = await post.text().catch(() => "");
    return { ok: false, message: `LinkedIn rejected the post (${post.status}): ${detail.slice(0, 200)}` };
  }

  const id = post.headers.get("x-restli-id");
  return id ? { ok: true, url: `https://www.linkedin.com/feed/update/${id}` } : { ok: true };
}

async function publishToX(body: string): Promise<PublishResult> {
  const headers = gatewayHeaders("twitter");
  if (!headers) return { ok: false, message: "X (Twitter) is not connected yet." };

  const post = await fetch(`${GATEWAY}/x/2/tweets`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: body.slice(0, 275) }),
  });

  if (!post.ok) {
    const detail = await post.text().catch(() => "");
    return { ok: false, message: `X rejected the post (${post.status}): ${detail.slice(0, 200)}` };
  }

  const payload = (await post.json().catch(() => null)) as { data?: { id?: string } } | null;
  const id = payload?.data?.id;
  return id ? { ok: true, url: `https://x.com/i/web/status/${id}` } : { ok: true };
}

export async function publishToChannel(channel: string, body: string): Promise<PublishResult> {
  if (channel === "linkedin") return publishToLinkedIn(body);
  if (channel === "twitter") return publishToX(body);
  if (channel === "tiktok") {
    return {
      ok: false,
      message: "TikTok needs a video upload, so post it yourself — the script is ready to copy.",
    };
  }
  return {
    ok: false,
    message: `Auto-posting to ${channel} isn't available yet. Copy the text and post it yourself.`,
  };
}
