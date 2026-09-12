// Publishing adapters. Every network posts with the credentials the user saved
// on the Connections page — no shared or workspace-level accounts involved.

import type { ChannelCredentials } from "./networks";

export type PublishResult =
  | { ok: true; url?: string | undefined; externalId?: string | undefined; note?: string | undefined }
  | { ok: false; message: string };

export type MetricsResult =
  | { ok: true; likes: number; shares: number; comments: number; impressions: number; note?: string | undefined }
  | { ok: false; message: string };

export type CheckResult = { ok: true; label: string; note?: string } | { ok: false; message: string };

const GRAPH = "https://graph.facebook.com/v21.0";

async function detail(response: Response): Promise<string> {
  return (await response.text().catch(() => "")).slice(0, 300);
}

function need(creds: ChannelCredentials, ...keys: string[]): string[] | null {
  const values = keys.map((key) => (creds[key] ?? "").trim());
  return values.every(Boolean) ? values : null;
}

// ---------------------------------------------------------------- LinkedIn

async function linkedInAuthor(token: string, creds: ChannelCredentials): Promise<{ urn: string; name: string } | string> {
  const explicit = (creds["author_urn"] ?? "").trim();
  const me = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!me.ok) {
    if (explicit) return { urn: explicit, name: "LinkedIn account" };
    return `LinkedIn rejected the token (${me.status}): ${await detail(me)}`;
  }
  const profile = (await me.json()) as { sub?: string; name?: string; email?: string };
  const urn = explicit || (profile.sub ? `urn:li:person:${profile.sub}` : "");
  if (!urn) return "LinkedIn did not return an account id. Add your author URN as well.";
  return { urn, name: profile.name ?? profile.email ?? "LinkedIn account" };
}

async function checkLinkedIn(creds: ChannelCredentials): Promise<CheckResult> {
  const values = need(creds, "access_token");
  if (!values) return { ok: false, message: "Add your LinkedIn access token." };
  const author = await linkedInAuthor(values[0]!, creds);
  if (typeof author === "string") return { ok: false, message: author };
  return { ok: true, label: author.name };
}

async function publishToLinkedIn(creds: ChannelCredentials, body: string): Promise<PublishResult> {
  const values = need(creds, "access_token");
  if (!values) return { ok: false, message: "LinkedIn is not set up yet." };
  const token = values[0]!;

  const author = await linkedInAuthor(token, creds);
  if (typeof author === "string") return { ok: false, message: author };

  const post = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: author.urn,
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
  return { ok: true, externalId: id, ...(id ? { url: `https://www.linkedin.com/feed/update/${id}` } : {}) };
}

async function linkedInMetrics(creds: ChannelCredentials, externalId: string): Promise<MetricsResult> {
  const values = need(creds, "access_token");
  if (!values) return { ok: false, message: "LinkedIn is not set up yet." };

  const response = await fetch(
    `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(externalId)}`,
    { headers: { Authorization: `Bearer ${values[0]!}` } },
  );
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

async function checkX(creds: ChannelCredentials): Promise<CheckResult> {
  const values = need(creds, "access_token");
  if (!values) return { ok: false, message: "Add your X access token." };
  const response = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${values[0]!}` },
  });
  if (!response.ok) return { ok: false, message: `X rejected the token (${response.status}): ${await detail(response)}` };
  const payload = (await response.json()) as { data?: { username?: string; name?: string } };
  return { ok: true, label: payload.data?.username ? `@${payload.data.username}` : (payload.data?.name ?? "X account") };
}

async function publishToX(creds: ChannelCredentials, body: string): Promise<PublishResult> {
  const values = need(creds, "access_token");
  if (!values) return { ok: false, message: "X (Twitter) is not set up yet." };

  const post = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${values[0]!}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: body.slice(0, 275) }),
  });
  if (!post.ok) return { ok: false, message: `X rejected the post (${post.status}): ${await detail(post)}` };

  const payload = (await post.json().catch(() => null)) as { data?: { id?: string } } | null;
  const id = payload?.data?.id;
  return { ok: true, externalId: id, ...(id ? { url: `https://x.com/i/web/status/${id}` } : {}) };
}

async function xMetrics(creds: ChannelCredentials, externalId: string): Promise<MetricsResult> {
  const values = need(creds, "access_token");
  if (!values) return { ok: false, message: "X (Twitter) is not set up yet." };

  const response = await fetch(`https://api.twitter.com/2/tweets/${externalId}?tweet.fields=public_metrics`, {
    headers: { Authorization: `Bearer ${values[0]!}` },
  });
  if (!response.ok) return { ok: false, message: `X stats unavailable (${response.status}): ${await detail(response)}` };

  const payload = (await response.json()) as {
    data?: { public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number; impression_count?: number } };
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

const TIKTOK = "https://open.tiktokapis.com/v2";

async function checkTikTok(creds: ChannelCredentials): Promise<CheckResult> {
  const values = need(creds, "access_token");
  if (!values) return { ok: false, message: "Add your TikTok access token." };
  const response = await fetch(`${TIKTOK}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${values[0]!}`, "Content-Type": "application/json; charset=UTF-8" },
  });
  if (!response.ok) return { ok: false, message: `TikTok rejected the token (${response.status}): ${await detail(response)}` };
  const payload = (await response.json()) as {
    data?: { creator_nickname?: string; creator_username?: string };
    error?: { code?: string; message?: string };
  };
  if (payload.error?.code && payload.error.code !== "ok") {
    return { ok: false, message: `TikTok rejected the token: ${payload.error.message ?? payload.error.code}` };
  }
  return { ok: true, label: payload.data?.creator_nickname ?? payload.data?.creator_username ?? "TikTok account" };
}

async function publishToTikTok(creds: ChannelCredentials, body: string, videoUrl?: string | null): Promise<PublishResult> {
  const values = need(creds, "access_token");
  if (!values) return { ok: false, message: "TikTok is not set up yet." };
  if (!videoUrl) return { ok: false, message: "Make the clip first — TikTok needs a finished video to post." };
  const token = values[0]!;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" };

  let privacy = "SELF_ONLY";
  const creator = await fetch(`${TIKTOK}/post/publish/creator_info/query/`, { method: "POST", headers });
  if (creator.ok) {
    const info = (await creator.json()) as { data?: { privacy_level_options?: string[] } };
    const options = info.data?.privacy_level_options ?? [];
    privacy = options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : (options[0] ?? "SELF_ONLY");
  }

  const init = await fetch(`${TIKTOK}/post/publish/video/init/`, {
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

async function tiktokMetrics(creds: ChannelCredentials, publishId: string): Promise<MetricsResult> {
  const values = need(creds, "access_token");
  if (!values) return { ok: false, message: "TikTok is not set up yet." };
  const headers = { Authorization: `Bearer ${values[0]!}`, "Content-Type": "application/json; charset=UTF-8" };

  const status = await fetch(`${TIKTOK}/post/publish/status/fetch/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ publish_id: publishId }),
  });
  if (!status.ok) return { ok: false, message: `TikTok stats unavailable (${status.status}): ${await detail(status)}` };

  const statusPayload = (await status.json()) as { data?: { publicaly_available_post_id?: string[] } };
  const videoId = statusPayload.data?.publicaly_available_post_id?.[0];
  if (!videoId) {
    return { ok: true, likes: 0, shares: 0, comments: 0, impressions: 0, note: "TikTok is still processing this clip." };
  }

  const query = await fetch(`${TIKTOK}/video/query/?fields=id,like_count,comment_count,share_count,view_count`, {
    method: "POST",
    headers,
    body: JSON.stringify({ filters: { video_ids: [videoId] } }),
  });
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

// ----------------------------------------------------------------- Facebook

async function checkFacebook(creds: ChannelCredentials): Promise<CheckResult> {
  const values = need(creds, "page_id", "page_access_token");
  if (!values) return { ok: false, message: "Add your Facebook Page ID and Page access token." };
  const [pageId, token] = values as [string, string];
  const response = await fetch(`${GRAPH}/${pageId}?fields=name&access_token=${encodeURIComponent(token)}`);
  if (!response.ok) return { ok: false, message: `Facebook rejected the details (${response.status}): ${await detail(response)}` };
  const payload = (await response.json()) as { name?: string };
  return { ok: true, label: payload.name ?? `Page ${pageId}` };
}

async function publishToFacebook(creds: ChannelCredentials, body: string): Promise<PublishResult> {
  const values = need(creds, "page_id", "page_access_token");
  if (!values) return { ok: false, message: "Facebook is not set up yet." };
  const [pageId, token] = values as [string, string];

  const post = await fetch(`${GRAPH}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: body, access_token: token }),
  });
  if (!post.ok) return { ok: false, message: `Facebook rejected the post (${post.status}): ${await detail(post)}` };

  const payload = (await post.json()) as { id?: string };
  const id = payload.id;
  return { ok: true, externalId: id, ...(id ? { url: `https://www.facebook.com/${id}` } : {}) };
}

async function facebookMetrics(creds: ChannelCredentials, postId: string): Promise<MetricsResult> {
  const values = need(creds, "page_id", "page_access_token");
  if (!values) return { ok: false, message: "Facebook is not set up yet." };
  const token = values[1]!;

  const response = await fetch(
    `${GRAPH}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${encodeURIComponent(token)}`,
  );
  if (!response.ok) return { ok: false, message: `Facebook stats unavailable (${response.status}): ${await detail(response)}` };
  const payload = (await response.json()) as {
    likes?: { summary?: { total_count?: number } };
    comments?: { summary?: { total_count?: number } };
    shares?: { count?: number };
  };
  return {
    ok: true,
    likes: payload.likes?.summary?.total_count ?? 0,
    comments: payload.comments?.summary?.total_count ?? 0,
    shares: payload.shares?.count ?? 0,
    impressions: 0,
  };
}

// ---------------------------------------------------------------- Instagram

async function checkInstagram(creds: ChannelCredentials): Promise<CheckResult> {
  const values = need(creds, "ig_user_id", "access_token");
  if (!values) return { ok: false, message: "Add your Instagram business account ID and access token." };
  const [igId, token] = values as [string, string];
  const response = await fetch(`${GRAPH}/${igId}?fields=username&access_token=${encodeURIComponent(token)}`);
  if (!response.ok) return { ok: false, message: `Instagram rejected the details (${response.status}): ${await detail(response)}` };
  const payload = (await response.json()) as { username?: string };
  return { ok: true, label: payload.username ? `@${payload.username}` : `Account ${igId}` };
}

async function publishToInstagram(
  creds: ChannelCredentials,
  body: string,
  videoUrl?: string | null,
): Promise<PublishResult> {
  const values = need(creds, "ig_user_id", "access_token");
  if (!values) return { ok: false, message: "Instagram is not set up yet." };
  if (!videoUrl) return { ok: false, message: "Make the clip first — Instagram needs a video or image to post." };
  const [igId, token] = values as [string, string];

  const create = await fetch(`${GRAPH}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: videoUrl,
      caption: body.slice(0, 2200),
      access_token: token,
    }),
  });
  if (!create.ok) return { ok: false, message: `Instagram rejected the clip (${create.status}): ${await detail(create)}` };
  const container = (await create.json()) as { id?: string };
  if (!container.id) return { ok: false, message: "Instagram did not return an upload id." };

  // Reels need a moment to finish uploading before they can be published.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await fetch(
      `${GRAPH}/${container.id}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    const payload = (await status.json().catch(() => ({}))) as { status_code?: string };
    if (payload.status_code === "FINISHED") break;
    if (payload.status_code === "ERROR") return { ok: false, message: "Instagram could not process this clip." };
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const publish = await fetch(`${GRAPH}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  if (!publish.ok) return { ok: false, message: `Instagram rejected the post (${publish.status}): ${await detail(publish)}` };
  const published = (await publish.json()) as { id?: string };
  return {
    ok: true,
    externalId: published.id,
    ...(published.id ? { url: `https://www.instagram.com/p/${published.id}` } : {}),
  };
}

async function instagramMetrics(creds: ChannelCredentials, mediaId: string): Promise<MetricsResult> {
  const values = need(creds, "ig_user_id", "access_token");
  if (!values) return { ok: false, message: "Instagram is not set up yet." };
  const token = values[1]!;

  const response = await fetch(
    `${GRAPH}/${mediaId}?fields=like_count,comments_count&access_token=${encodeURIComponent(token)}`,
  );
  if (!response.ok) return { ok: false, message: `Instagram stats unavailable (${response.status}): ${await detail(response)}` };
  const payload = (await response.json()) as { like_count?: number; comments_count?: number };

  let impressions = 0;
  let shares = 0;
  const insights = await fetch(
    `${GRAPH}/${mediaId}/insights?metric=reach,shares&access_token=${encodeURIComponent(token)}`,
  );
  if (insights.ok) {
    const data = (await insights.json()) as { data?: Array<{ name?: string; values?: Array<{ value?: number }> }> };
    for (const entry of data.data ?? []) {
      const value = entry.values?.[0]?.value ?? 0;
      if (entry.name === "reach") impressions = value;
      if (entry.name === "shares") shares = value;
    }
  }

  return { ok: true, likes: payload.like_count ?? 0, comments: payload.comments_count ?? 0, shares, impressions };
}

// ------------------------------------------------------------------ Routing

/** Networks that need a finished video file before they can be posted. */
export const VIDEO_CHANNELS = new Set(["tiktok", "instagram"]);

export async function checkChannelCredentials(channel: string, creds: ChannelCredentials): Promise<CheckResult> {
  if (channel === "linkedin") return checkLinkedIn(creds);
  if (channel === "twitter") return checkX(creds);
  if (channel === "tiktok") return checkTikTok(creds);
  if (channel === "facebook") return checkFacebook(creds);
  if (channel === "instagram") return checkInstagram(creds);
  return { ok: false, message: `Unknown network: ${channel}` };
}

export async function publishToChannel(
  channel: string,
  creds: ChannelCredentials | null,
  body: string,
  videoUrl?: string | null,
): Promise<PublishResult> {
  if (!creds) {
    return { ok: false, message: `Add your ${channel} details on the Connections page first.` };
  }
  if (channel === "linkedin") return publishToLinkedIn(creds, body);
  if (channel === "twitter") return publishToX(creds, body);
  if (channel === "tiktok") return publishToTikTok(creds, body, videoUrl);
  if (channel === "facebook") return publishToFacebook(creds, body);
  if (channel === "instagram") return publishToInstagram(creds, body, videoUrl);
  return { ok: false, message: `Posting to ${channel} isn't supported yet.` };
}

export async function fetchMetrics(
  channel: string,
  creds: ChannelCredentials | null,
  externalId: string | null,
): Promise<MetricsResult> {
  if (!externalId) return { ok: false, message: "This post has no id from the network yet." };
  if (!creds) return { ok: false, message: `Add your ${channel} details on the Connections page first.` };
  if (channel === "linkedin") return linkedInMetrics(creds, externalId);
  if (channel === "twitter") return xMetrics(creds, externalId);
  if (channel === "tiktok") return tiktokMetrics(creds, externalId);
  if (channel === "facebook") return facebookMetrics(creds, externalId);
  if (channel === "instagram") return instagramMetrics(creds, externalId);
  return { ok: false, message: `${channel} stats have to be read in the app itself.` };
}
