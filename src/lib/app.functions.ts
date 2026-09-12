import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runPipeline, discoverTopics, generateForTopic } from "./pipeline.server";
import { publishToChannel, fetchMetrics, checkChannelCredentials } from "./publish.server";
import type { Database } from "@/integrations/supabase/types";
import type { ChannelCredentials } from "./networks";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

async function getChannelCredentials(supabase: Client, userId: string, channel: string): Promise<ChannelCredentials | null> {
  const { data, error } = await supabase
    .from("channel_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("channel", channel)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.credentials as ChannelCredentials | null) ?? null;
}

async function isChannelConnected(supabase: Client, userId: string, channel: string): Promise<boolean> {
  const creds = await getChannelCredentials(supabase, userId, channel);
  if (!creds) return false;
  const check = await checkChannelCredentials(channel, creds);
  return check.ok;
}

async function canAutoPost(supabase: Client, userId: string, channel: string): Promise<boolean> {
  return isChannelConnected(supabase, userId, channel);
}



const statusSchema = z.enum(["draft", "approved", "scheduled", "published", "rejected", "failed"]);


export const getDashboardStats = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: topicsCount }, { count: draftsCount }, { count: scheduledCount }, { count: publishedCount }, { data: lastRun }] = await Promise.all([
      supabase.from("topics").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("drafts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "draft"),
      supabase.from("drafts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "scheduled"),
      supabase.from("drafts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "published"),
      supabase.from("pipeline_runs").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return {
      topics: topicsCount ?? 0,
      drafts: draftsCount ?? 0,
      scheduled: scheduledCount ?? 0,
      published: publishedCount ?? 0,
      lastRun,
    };
  },
);

export const getTopics = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("topics")
      .select("*")
      .eq("user_id", userId)
      .order("discovered_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const runDiscovery = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const found = await discoverTopics(supabase, userId);
    return { found };
  },
);

export const generateDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ topicId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const created = await generateForTopic(supabase, userId, data.topicId);
    return { created };
  });

export const getDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ status: statusSchema.optional() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let query = supabase.from("drafts").select("*, topics(*)").eq("user_id", userId).order("created_at", { ascending: false });
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query.limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string(),
        body: z.string().optional(),
        status: statusSchema.optional(),
        scheduledAt: z.string().datetime().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: Database["public"]["Tables"]["drafts"]["Update"] = {};
    if (data.body !== undefined) patch.body = data.body;
    if (data.status !== undefined) patch.status = data.status;
    if (data.scheduledAt !== undefined) patch.scheduled_at = data.scheduledAt;
    const { error } = await supabase.from("drafts").update(patch).eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const scheduleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string(), scheduledAt: z.string().datetime() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("drafts")
      .update({ status: "scheduled", scheduled_at: data.scheduledAt })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: draft, error } = await supabase.from("drafts").select("*").eq("id", data.id).eq("user_id", userId).single();
    if (error || !draft) throw new Error("Draft not found.");

    const creds = await getChannelCredentials(supabase, userId, draft.channel);
    const result = await publishToChannel(draft.channel, creds, draft.body, draft.video_url);
    if (result.ok) {

      const now = new Date().toISOString();
      await supabase
        .from("drafts")
        .update({
          status: "published",
          published_at: now,
          external_url: result.url ?? null,
          external_id: result.externalId ?? null,
          error: null,
        })
        .eq("id", data.id)
        .eq("user_id", userId);
      await supabase.from("publish_log").insert({
        user_id: userId,
        draft_id: data.id,
        channel: draft.channel,
        status: "published",
        message: result.url ? `Published: ${result.url}` : "Published successfully.",
      });
      return { ok: true, url: result.url };
    } else {
      await supabase.from("drafts").update({ status: "failed", error: result.message }).eq("id", data.id).eq("user_id", userId);
      await supabase.from("publish_log").insert({
        user_id: userId,
        draft_id: data.id,
        channel: draft.channel,
        status: "failed",
        message: result.message,
      });
      throw new Error(result.message);
    }
  });

export const getSettings = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  },
);

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        categories: z.array(z.string()).optional(),
        keywords: z.string().optional(),
        humorLevel: z.number().min(1).max(10).optional(),
        dailyPostCap: z.number().min(1).max(50).optional(),
        postingWindowStart: z.number().min(0).max(23).optional(),
        postingWindowEnd: z.number().min(0).max(23).optional(),
        autoRun: z.boolean().optional(),
        tone: z.string().max(40).optional(),
        postLength: z.enum(["short", "medium", "long"]).optional(),
        styleNotes: z.string().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: Database["public"]["Tables"]["settings"]["Update"] = {};
    if (data.categories !== undefined) patch.categories = data.categories;
    if (data.keywords !== undefined) patch.keywords = data.keywords;
    if (data.humorLevel !== undefined) patch.humor_level = data.humorLevel;
    if (data.dailyPostCap !== undefined) patch.daily_post_cap = data.dailyPostCap;
    if (data.postingWindowStart !== undefined) patch.posting_window_start = data.postingWindowStart;
    if (data.postingWindowEnd !== undefined) patch.posting_window_end = data.postingWindowEnd;
    if (data.autoRun !== undefined) patch.auto_run = data.autoRun;
    if (data.tone !== undefined) patch.tone = data.tone;
    if (data.postLength !== undefined) patch.post_length = data.postLength;
    if (data.styleNotes !== undefined) patch.style_notes = data.styleNotes;


    const { data: existing } = await supabase.from("settings").select("user_id").eq("user_id", userId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("settings").update(patch).eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("settings").insert({ user_id: userId, ...patch });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getChannels = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("channels").select("*").eq("user_id", userId).order("channel");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const updateChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string(), enabled: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("channels").update({ enabled: data.enabled }).eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPublishLog = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("publish_log")
      .select("*, drafts(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const runPipelineNow = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    return runPipeline(supabase, userId, { batchSize: 3, source: "manual" });
  },
);

/** Channel rows plus whether the account is actually linked for auto-posting. */
export const getNetworkStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("channels").select("*").eq("user_id", userId).order("channel");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        linked: await isChannelConnected(supabase, userId, row.channel),
        autoPost: await canAutoPost(supabase, userId, row.channel),
      })),
    );
    return enriched;
  },
);

/** Newest generated posts for the dashboard feed. */
export const getRecentDrafts = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("drafts")
      .select("*, topics(title, source_name, source_url, category)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

/** Turns a draft's video script into a real short-form clip. */
export const makeVideoForDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { generateClip } = await import("./video.server");

    const { data: draft, error } = await supabase
      .from("drafts")
      .select("id, video_script, channel, body")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !draft) throw new Error("Draft not found.");
    // Every network can get a clip: use the written video script when the post has
    // one, otherwise film the post text itself.
    const script = draft.video_script?.trim() || draft.body;
    if (!script) throw new Error("This post has no text to turn into a clip.");

    await supabase.from("drafts").update({ video_status: "generating" }).eq("id", draft.id).eq("user_id", userId);

    const result = await generateClip(script, `${userId}/${draft.id}.mp4`);
    if (!result.ok) {
      await supabase
        .from("drafts")
        .update({ video_status: "failed", error: result.message })
        .eq("id", draft.id)
        .eq("user_id", userId);
      throw new Error(result.message);
    }

    await supabase
      .from("drafts")
      .update({ video_status: "ready", video_url: result.url, error: null })
      .eq("id", draft.id)
      .eq("user_id", userId);

    // Video networks with a linked account get the finished clip posted for them.
    if (await canAutoPost(supabase, userId, draft.channel)) {
      const creds = await getChannelCredentials(supabase, userId, draft.channel);
      const posted = await publishToChannel(draft.channel, creds, draft.body, result.url);
      if (posted.ok) {

        await supabase
          .from("drafts")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            external_url: posted.url ?? null,
            external_id: posted.externalId ?? null,
            error: null,
          })
          .eq("id", draft.id)
          .eq("user_id", userId);
        await supabase.from("publish_log").insert({
          user_id: userId,
          draft_id: draft.id,
          channel: draft.channel,
          status: "published",
          message: posted.note ?? "Clip posted.",
        });
        return { ok: true, message: posted.note ?? `Clip posted to ${draft.channel}.`, url: result.url };
      }
      await supabase.from("publish_log").insert({
        user_id: userId,
        draft_id: draft.id,
        channel: draft.channel,
        status: "failed",
        message: posted.message,
      });
      return { ok: true, message: `Clip is ready, but posting failed: ${posted.message}`, url: result.url };
    }

    return {
      ok: true,
      message: `Clip is ready. ${draft.channel} has no linked account here, so download it and post it yourself.`,
      url: result.url,
    };
  });

/**
 * Approves a post and publishes it straight away when its account is linked.
 * Networks without a sign-in stay approved so they can be copied out by hand.
 */
export const approveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: draft, error } = await supabase
      .from("drafts")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !draft) throw new Error("Draft not found.");

    await supabase.from("drafts").update({ status: "approved" }).eq("id", draft.id).eq("user_id", userId);

    if (!(await canAutoPost(supabase, userId, draft.channel))) {
      return {
        ok: true,
        published: false,
        message: `Approved. ${draft.channel} has no linked account, so copy it across yourself.`,
      };
    }

    const creds = await getChannelCredentials(supabase, userId, draft.channel);
    const result = await publishToChannel(draft.channel, creds, draft.body, draft.video_url);
    const now = new Date().toISOString();


    if (!result.ok) {
      await supabase
        .from("drafts")
        .update({ status: "failed", error: result.message })
        .eq("id", draft.id)
        .eq("user_id", userId);
      await supabase.from("publish_log").insert({
        user_id: userId,
        draft_id: draft.id,
        channel: draft.channel,
        status: "failed",
        message: result.message,
      });
      return { ok: false, published: false, message: result.message };
    }

    await supabase
      .from("drafts")
      .update({
        status: "published",
        published_at: now,
        external_url: result.url ?? null,
        external_id: result.externalId ?? null,
        error: null,
      })
      .eq("id", draft.id)
      .eq("user_id", userId);
    await supabase.from("publish_log").insert({
      user_id: userId,
      draft_id: draft.id,
      channel: draft.channel,
      status: "published",
      message: result.note ?? (result.url ? `Published: ${result.url}` : "Published successfully."),
    });

    return {
      ok: true,
      published: true,
      message: result.note ?? `Posted to ${draft.channel}.`,
      url: result.url ?? null,
    };
  });

/** Published posts with their latest saved likes, shares and comments. */
export const getAnalytics = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: posts, error }, { data: metrics }] = await Promise.all([
      supabase
        .from("drafts")
        .select("id, channel, body, hashtags, published_at, external_url, external_id, topics(title)")
        .eq("user_id", userId)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(100),
      supabase.from("post_metrics").select("*").eq("user_id", userId),
    ]);
    if (error) throw new Error(error.message);

    const byDraft = new Map((metrics ?? []).map((row) => [row.draft_id, row]));
    return (posts ?? []).map((post) => ({ ...post, metrics: byDraft.get(post.id) ?? null }));
  },
);

/** Pulls fresh likes, shares and comments from every network that supports it. */
export const refreshAnalytics = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabase, userId } = context;
    const { data: posts, error } = await supabase
      .from("drafts")
      .select("id, channel, external_id")
      .eq("user_id", userId)
      .eq("status", "published")
      .not("external_id", "is", null)
      .limit(50);
    if (error) throw new Error(error.message);
    if (!posts || posts.length === 0) {
      return { ok: true, updated: 0, message: "No published posts with network stats yet." };
    }

    let updated = 0;
    const problems: string[] = [];
    for (const post of posts) {
      const result = await fetchMetrics(post.channel, post.external_id);
      if (!result.ok) {
        problems.push(result.message);
        continue;
      }
      const { error: upsertError } = await supabase.from("post_metrics").upsert(
        {
          user_id: userId,
          draft_id: post.id,
          channel: post.channel,
          likes: result.likes,
          shares: result.shares,
          comments: result.comments,
          impressions: result.impressions,
          note: result.note ?? "",
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "draft_id" },
      );
      if (upsertError) problems.push(upsertError.message);
      else updated += 1;
    }

    return {
      ok: true,
      updated,
      message: updated > 0 ? `Refreshed stats for ${updated} post(s).` : (problems[0] ?? "No stats available yet."),
    };
  },
);
