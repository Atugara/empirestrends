// Short-form video generation. Runs a text-to-video model on Replicate through
// the Lovable connector gateway, then stores the clip in the private "clips" bucket.

const GATEWAY = "https://connector-gateway.lovable.dev";
const MODEL = "wan-video/wan-2.5-t2v-fast";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 30;

export type VideoResult = { ok: true; url: string } | { ok: false; message: string };

export function isVideoConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["REPLICATE_API_KEY"]);
}

function headers(): Record<string, string> | null {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["REPLICATE_API_KEY"];
  if (!lovableApiKey || !connectionKey) return null;
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
    Prefer: "wait",
  };
}

/** Generates a 9:16 clip from a script and returns a signed URL to the stored file. */
export async function generateClip(
  script: string,
  storagePath: string,
): Promise<VideoResult> {
  const h = headers();
  if (!h) {
    return {
      ok: false,
      message: "Video generation isn't connected yet — link a Replicate account first.",
    };
  }

  const response = await fetch(`${GATEWAY}/replicate/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      input: {
        prompt: script.slice(0, 1500),
        aspect_ratio: "9:16",
        duration: 5,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      message: `The video generator refused the job (${response.status}): ${detail.slice(0, 200)}`,
    };
  }

  let prediction = (await response.json()) as {
    id?: string;
    status?: string;
    output?: string | string[];
    error?: string;
  };

  // "Prefer: wait" usually returns a finished prediction; poll if it didn't.
  for (let attempt = 0; attempt < 40 && prediction.status && !["succeeded", "failed", "canceled"].includes(prediction.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const poll = await fetch(`${GATEWAY}/replicate/v1/predictions/${prediction.id}`, { headers: h });
    if (!poll.ok) break;
    prediction = (await poll.json()) as typeof prediction;
  }

  if (prediction.status !== "succeeded") {
    return { ok: false, message: prediction.error ?? "The clip could not be generated." };
  }

  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!output) return { ok: false, message: "The generator returned no video file." };

  const file = await fetch(output);
  if (!file.ok) return { ok: false, message: "The finished clip could not be downloaded." };
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const upload = await supabaseAdmin.storage
    .from("clips")
    .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
  if (upload.error) return { ok: false, message: upload.error.message };

  const signed = await supabaseAdmin.storage
    .from("clips")
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data) {
    return { ok: false, message: signed.error?.message ?? "The clip could not be shared." };
  }

  return { ok: true, url: signed.data.signedUrl };
}
