// Publishing adapters. LinkedIn goes through the connector gateway; the other
// networks stay unavailable until their credentials are connected.

export type PublishResult = { ok: true; url?: string } | { ok: false; message: string };

const GATEWAY = "https://connector-gateway.lovable.dev";

async function publishToLinkedIn(body: string): Promise<PublishResult> {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const linkedInKey = process.env["LINKEDIN_API_KEY"];
  if (!lovableApiKey || !linkedInKey) {
    return { ok: false, message: "LinkedIn is not connected yet." };
  }

  const headers = {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": linkedInKey,
    "Content-Type": "application/json",
  };

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
  return id
    ? { ok: true, url: `https://www.linkedin.com/feed/update/${id}` }
    : { ok: true };
}

export async function publishToChannel(channel: string, body: string): Promise<PublishResult> {
  if (channel === "linkedin") return publishToLinkedIn(body);
  return {
    ok: false,
    message: `Auto-posting to ${channel} needs that account connected first. The text is ready to copy in the meantime.`,
  };
}
