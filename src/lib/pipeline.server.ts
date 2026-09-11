import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { fetchTrending } from "./news.server";
import { generateBundle, GatewayError } from "./ai.server";

type Client = SupabaseClient<Database>;

const LEASE_MINUTES = 10;

export type RunSummary = {
  status: "success" | "skipped" | "paused" | "failed";
  topics_found: number;
  drafts_created: number;
  message: string;
};

async function getSettings(supabase: Client, userId: string) {
  const { data } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabase
    .from("settings")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return created;
}

async function acquireLease(supabase: Client, userId: string, kind: string) {
  const now = new Date();
  const { data: active } = await supabase
    .from("pipeline_runs")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "running")
    .gt("lease_until", now.toISOString())
    .limit(1);
  if (active && active.length > 0) return null;

  const { data, error } = await supabase
    .from("pipeline_runs")
    .insert({
      user_id: userId,
      kind,
      status: "running",
      lease_until: new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function closeRun(
  supabase: Client,
  runId: string,
  patch: Database["public"]["Tables"]["pipeline_runs"]["Update"],
) {
  await supabase
    .from("pipeline_runs")
    .update({ ...patch, finished_at: new Date().toISOString(), lease_until: null })
    .eq("id", runId);
}

export async function discoverTopics(supabase: Client, userId: string): Promise<number> {
  const settings = await getSettings(supabase, userId);
  const items = await fetchTrending(settings.categories ?? ["general"]);
  if (items.length === 0) return 0;

  const { data, error } = await supabase
    .from("topics")
    .upsert(
      items.map((item) => ({ ...item, user_id: userId })),
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function generateForTopic(
  supabase: Client,
  userId: string,
  topicId: string,
): Promise<number> {
  const settings = await getSettings(supabase, userId);
  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("*")
    .eq("id", topicId)
    .eq("user_id", userId)
    .single();
  if (topicError || !topic) throw new Error("Topic not found.");

  const bundle = await generateBundle({
    title: topic.title,
    summary: topic.summary,
    category: topic.category,
    humorLevel: settings.humor_level,
    tone: settings.tone,
    postLength: settings.post_length,
    styleNotes: settings.style_notes,

  });

  const rows = [
    { channel: "twitter" as const, body: bundle.twitter, video_script: null },
    { channel: "linkedin" as const, body: bundle.linkedin, video_script: null },
    { channel: "facebook" as const, body: bundle.facebook, video_script: null },
    {
      channel: "instagram" as const,
      body: bundle.twitter,
      video_script: bundle.video_script,
    },
    { channel: "tiktok" as const, body: bundle.twitter, video_script: bundle.video_script },
  ].map((row) => ({
    ...row,
    user_id: userId,
    topic_id: topicId,
    hashtags: bundle.hashtags,
    status: "draft" as const,
    error: null,
  }));

  const { error } = await supabase.from("drafts").upsert(rows, { onConflict: "topic_id,channel" });
  if (error) throw new Error(error.message);

  await supabase.from("topics").update({ generated: true }).eq("id", topicId);
  return rows.length;
}

export async function runPipeline(
  supabase: Client,
  userId: string,
  options: { batchSize?: number; source?: string } = {},
): Promise<RunSummary> {
  const batchSize = Math.min(options.batchSize ?? 3, 5);
  const settings = await getSettings(supabase, userId);

  if (settings.paused) {
    return {
      status: "paused",
      topics_found: 0,
      drafts_created: 0,
      message: settings.pause_reason ?? "Automation is paused.",
    };
  }

  const runId = await acquireLease(supabase, userId, options.source ?? "manual");
  if (!runId) {
    return {
      status: "skipped",
      topics_found: 0,
      drafts_created: 0,
      message: "A run is already in progress.",
    };
  }

  let topicsFound = 0;
  let draftsCreated = 0;

  try {
    topicsFound = await discoverTopics(supabase, userId);

    const { data: pending } = await supabase
      .from("topics")
      .select("id")
      .eq("user_id", userId)
      .eq("generated", false)
      .order("score", { ascending: false })
      .limit(batchSize);

    for (const topic of pending ?? []) {
      draftsCreated += await generateForTopic(supabase, userId, topic.id);
    }

    await closeRun(supabase, runId, {
      status: "success",
      topics_found: topicsFound,
      drafts_created: draftsCreated,
    });
    return {
      status: "success",
      topics_found: topicsFound,
      drafts_created: draftsCreated,
      message: `Found ${topicsFound} new stories and wrote ${draftsCreated} drafts.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const blocking = error instanceof GatewayError && (error.status === 402 || error.status === 403);

    if (blocking) {
      await supabase
        .from("settings")
        .update({ paused: true, pause_reason: message })
        .eq("user_id", userId);
    }

    await closeRun(supabase, runId, {
      status: blocking ? "paused" : "failed",
      topics_found: topicsFound,
      drafts_created: draftsCreated,
      error: message,
    });

    return {
      status: blocking ? "paused" : "failed",
      topics_found: topicsFound,
      drafts_created: draftsCreated,
      message,
    };
  }
}
