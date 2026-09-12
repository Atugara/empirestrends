// Publishing adapters. Connected networks post through the connector gateway;
// the rest stay copy-and-paste until an account can be linked.

export type PublishResult =
  | { ok: true; url?: string | undefined; externalId?: string | undefined; note?: string | undefined }
  | { ok: false; message: string };

export type MetricsResult =
  | { ok: true; likes: number; shares: number; comments: number; impressions: number; note?: string | undefined }
  | { ok: false; message: string };

const GATEWAY = "https://connector-gateway.lovable.dev";

/** Env var holding the connection key for each network. */
const CONNECTION_KEYS: Record<string, string> = {
  linkedin: "LINKEDIN_API_KEY",
  twitter: "X_API_KEY",
  tiktok: "TIKTOK_API_KEY",
};

/** Networks the bot can post to on its own once connected. */
const AUTO_POST = new Set(["linkedin", "twitter", "tiktok"]);

/** Networks that need a finished video file before they can be posted. */
export const VIDEO_CHANNELS = new Set(["tiktok", "instagram"]);

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

async function detail(response: Response): Promise<string> {
  return (await response.text().catch(() => "")).slice(0, 250);
}

// ---------------------------------------------------------------- LinkedIn

async function publishToLinkedIn(body: string): Promise<PublishResult> {
  const headers = gatewayHeaders("linkedin");
  if (!headers) return { ok: false, message: "LinkedIn is not connected yet." };

  const me = await fetch(`${GATEWAY}/linkedin/v2/userinfo`, { headers });
  if (!me.ok) return { ok: false, message: `LinkedIn profile lookup failed (${me.status}): ${await detail(me)}` };
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

  if (!post.ok) return { ok: false, message: `LinkedIn rejected the post (${post.status}): ${await detail(post)}` };

  const id = post.headers.get("x-restli-id") ?? undefined;
  return {
    ok: true,
    externalId: id,
    ...(id ? { url: `https://www.linkedin.com/feed/update/${id}` } : {}),
  };
}

async function linkedInMetrics(externalId: string): Promise<MetricsResult> {
  const headers = gatewayHeaders("linkedin");
  if (!headers) return { ok: false, message: "LinkedIn is not connected yet." };

  const response = await fetch(`${GATEWAY}/linkedin/v2/socialActions/${encodeURIComponent(externalId)}`, { headers });
  if (!response.ok) return { ok: false, message: `LinkedIn stats unavailable (${response.status}): ${await detail(response)}` };

  const payload = (await response.json()) as {
    likesSummary?: { totalLikes?: number };
    commentsSummary?: { aggregatedTotalComments?: number; totalFirstLevelComments?: number };
  };
  return {
    ok: true,
    likes: payload.likesSummary?.totalLikes ?? 0,
    comments: payload.commentsSummary?.aggregatedTotalComments ?? payload.commentsSummary?.totalFirstLevelComments ?? 0,
    shares: 0,
    impressions: 0,
    note: "LinkedIn only shares reshare and view counts with company pages.",
  };
}

// ------------------------------------------------------------------------ X

async function publishToX(body: string): Promise<PublishResult> {
  const headers = gatewayHeaders("twitter");
  if (!headers) return { ok: false, message: "X (Twitter) is not connected yet." };

  const post = await fetch(`${GATEWAY}/x/2/tweets`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: body.slice(0, 275) }),
  });
  if (!post.ok) return { ok: false, message: `X rejected the post (${post.status}): ${await detail(post)}` };

  const payload = (await post.json().catch(() => null)) as { data?: { id?: string } } | null;
  const id = payload?.data?.id;
  return { ok: true, externalId: id, ...(id ? { url: `https://x.com/i/web/status/${id}` } : {}) };
}

async function xMetrics(externalId: string): Promise<MetricsResult> {
  const headers = gatewayHeaders("twitter");
  if (!headers) return { ok: false, message: "X (Twitter) is not connected yet." };

  const response = await fetch(`${GATEWAY}/x/2/tweets/${externalId}?tweet.fields=public_metrics`, { headers });
  if (!response.ok) return { ok: false, message: `X stats unavailable (${response.status}): ${await detail(response)}` };

  const payload = (await response.json()) as {
    data?: {
      public_metrics?: {
        like_count?: number;
        retweet_count?: number;
        reply_count?: number;
        impression_count?: number;
      };
    };
  };
  const m = payload.data?.public_metrics ?? {};
  return {
    ok: true,
    likes: m.like_count ?? 0,
    shares: m.retweet_count ?? 0,
    comments: m.reply_count ?? 0,
    impressions: m.impression_count ?? 0,
  };
}

// ------------------------------------------------------------------- TikTok

/** Posts a finished clip to TikTok by having TikTok pull the video URL. */
async function publishToTikTok(body: string, videoUrl?: string | null): Promise<PublishResult> {
  const headers = gatewayHeaders("tiktok");
  if (!headers) return { ok: false, message: "TikTok is not connected yet." };
  if (!videoUrl) {
    return { ok: false, message: "Make the clip first — TikTok needs a finished video to post." };
  }

  // Ask TikTok which privacy settings this account allows before posting.
  let privacy = "SELF_ONLY";
  const creator = await fetch(`${GATEWAY}/tiktok/post/publish/creator_info/query/`, { method: "POST", headers });
  if (creator.ok) {
    const info = (await creator.json()) as { data?: { privacy_level_options?: string[] } };
    const options = info.data?.privacy_level_options ?? [];
    privacy = options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : (options[0] ?? "SELF_ONLY");
  }

  const init = await fetch(`${GATEWAY}/tiktok/post/publish/video/init/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      post_info: {
        title: body.slice(0, 2100),
        privacy_level: privacy,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    }),
  });

  if (!init.ok) return { ok: false, message: `TikTok rejected the clip (${init.status}): ${await detail(init)}` };

  const payload = (await init.json()) as { data?: { publish_id?: string }; error?: { code?: string; message?: string } };
  if (payload.error?.code && payload.error.code !== "ok") {
    return { ok: false, message: `TikTok rejected the clip: ${payload.error.message ?? payload.error.code}` };
  }
  return {
    ok: true,
    externalId: payload.data?.publish_id,
    note:
      privacy === "PUBLIC_TO_EVERYONE"
        ? "TikTok is processing the clip; it appears on your profile in a minute or two."
        : "Posted privately (visible to you only) because this TikTok account limits app posts to private.",
  };
}

async function tiktokMetrics(publishId: string): Promise<MetricsResult> {
  const headers = gatewayHeaders("tiktok");
  if (!headers) return { ok: false, message: "TikTok is not connected yet." };

  const status = await fetch(`${GATEWAY}/tiktok/post/publish/status/fetch/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ publish_id: publishId }),
  });
  if (!status.ok) return { ok: false, message: `TikTok stats unavailable (${status.status}): ${await detail(status)}` };

  const statusPayload = (await status.json()) as {
    data?: { status?: string; publicaly_available_post_id?: string[] };
  };
  const videoId = statusPayload.data?.publicaly_available_post_id?.[0];
  if (!videoId) {
    return { ok: true, likes: 0, shares: 0, comments: 0, impressions: 0, note: "TikTok is still processing this clip." };
  }

  const query = await fetch(
    `${GATEWAY}/tiktok/video/query/?fields=id,like_count,comment_count,share_count,view_count`,
    { method: "POST", headers, body: JSON.stringify({ filters: { video_ids: [videoId] } }) },
  );
  if (!query.ok) return { ok: false, message: `TikTok stats unavailable (${query.status}): ${await detail(query)}` };

  const payload = (await query.json()) as {
    data?: { videos?: Array<{ like_count?: number; comment_count?: number; share_count?: number; view_count?: number }> };
  };
  const video = payload.data?.videos?.[0] ?? {};
  return {
    ok: true,
    likes: video.like_count ?? 0,
    shares: video.share_count ?? 0,
    comments: video.comment_count ?? 0,
    impressions: video.view_count ?? 0,
  };
}

// ------------------------------------------------------------------ Routing

const MANUAL_MESSAGE: Record<string, string> = {
  facebook:
    "Facebook has no sign-in available here yet, so this one stays copy-and-paste: the text is ready for you.",
  instagram:
    "Instagram has no sign-in available here yet, so this one stays copy-and-paste: the caption and clip are ready for you.",
};

export async function publishToChannel(
  channel: string,
  body: string,
  videoUrl?: string | null,
): Promise<PublishResult> {
  if (channel === "linkedin") return publishToLinkedIn(body);
  if (channel === "twitter") return publishToX(body);
  if (channel === "tiktok") return publishToTikTok(body, videoUrl);
  return {
    ok: false,
    message:
      MANUAL_MESSAGE[channel] ?? `Auto-posting to ${channel} isn't available yet. Copy the text and post it yourself.`,
  };
}

export async function fetchMetrics(channel: string, externalId: string | null): Promise<MetricsResult> {
  if (!externalId) return { ok: false, message: "This post has no id from the network yet." };
  if (channel === "linkedin") return linkedInMetrics(externalId);
  if (channel === "twitter") return xMetrics(externalId);
  if (channel === "tiktok") return tiktokMetrics(externalId);
  return { ok: false, message: `${channel} stats have to be read in the app itself.` };
}
