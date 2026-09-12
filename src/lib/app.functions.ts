import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runPipeline, discoverTopics, generateForTopic } from "./pipeline.server";
import { publishToChannel, isChannelConnected, canAutoPost } from "./publish.server";
import type { Database } from "@/integrations/supabase/types";

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

    const result = await publishToChannel(draft.channel, draft.body);
    if (result.ok) {
      const now = new Date().toISOString();
      await supabase.from("drafts").update({ status: "published", published_at: now }).eq("id", data.id).eq("user_id", userId);
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
    return (data ?? []).map((row) => ({
      ...row,
      linked: isChannelConnected(row.channel),
      autoPost: canAutoPost(row.channel),
    }));
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
      .select("id, video_script, channel")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !draft) throw new Error("Draft not found.");
    if (!draft.video_script) throw new Error("This post has no video script to film.");

    await supabase.from("drafts").update({ video_status: "generating" }).eq("id", draft.id).eq("user_id", userId);

    const result = await generateClip(draft.video_script, `${userId}/${draft.id}.mp4`);
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

    return { ok: true, message: "Clip is ready.", url: result.url };
  });
