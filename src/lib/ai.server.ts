// Comedy copywriter: turns a trending story into per-network posts and a video script.
// Uses the Lovable AI Gateway Responses API with streaming (reasoning runs are slow).

export type GeneratedBundle = {
  twitter: string;
  linkedin: string;
  facebook: string;
  video_script: string;
  hashtags: string[];
};

export class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GatewayError";
  }
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    twitter: { type: "string" },
    linkedin: { type: "string" },
    facebook: { type: "string" },
    video_script: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: ["twitter", "linkedin", "facebook", "video_script", "hashtags"],
} as const;

export type StyleInput = {
  title: string;
  summary: string;
  category: string;
  humorLevel: number;
  tone?: string;
  postLength?: string;
  styleNotes?: string;
};

const LENGTH_RULES: Record<string, string> = {
  short: "Keep every post very short: one or two sentences max, twitter under 140 characters.",
  medium: "Medium length: twitter under 240 characters, linkedin 2-3 short paragraphs.",
  long: "Fuller storytelling: twitter up to 270 characters, linkedin 4 short paragraphs with a story arc.",
};

function buildPrompt(input: StyleInput): string {
  const tone = input.tone ?? "witty";
  const lengthRule = LENGTH_RULES[input.postLength ?? "medium"] ?? LENGTH_RULES["medium"];
  return [
    `Trending story (${input.category}): ${input.title}`,
    input.summary ? `Context: ${input.summary}` : "",
    "",
    `Write social content about this story. Voice/tone: ${tone}. Comedy dial: ${input.humorLevel}/10 — punchy, surprising, quotable jokes.`,
    lengthRule,
    input.styleNotes ? `Extra style notes from the author (follow these closely): ${input.styleNotes}` : "",
    "Rules:",
    "- twitter: one killer joke or hot take, no link.",
    "- linkedin: funny but workplace-safe, ends with a question.",
    "- facebook: conversational and shareable.",
    "- video_script: a 20-30 second vertical video script with HOOK, 3 BEATS and CTA on separate lines.",
    "- hashtags: 4-6 short tags without the # symbol.",
    "Never mock victims, tragedy, ethnicity, religion or disability. On politics, joke about the absurdity of the situation, never insult voters or groups. No slurs, no misinformation, no fabricated quotes presented as real.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateBundle(input: StyleInput): Promise<GeneratedBundle> {

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new GatewayError(401, "AI is not configured for this app.");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: buildPrompt(input),
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: {
        format: { type: "json_schema", name: "social_bundle", strict: true, schema: SCHEMA },
      },
    }),
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new GatewayError(response.status, gatewayMessage(response.status, body));
  }

  const text = await readOutputText(response.body);
  const parsed = JSON.parse(text) as GeneratedBundle;
  return {
    twitter: String(parsed.twitter ?? "").trim(),
    linkedin: String(parsed.linkedin ?? "").trim(),
    facebook: String(parsed.facebook ?? "").trim(),
    video_script: String(parsed.video_script ?? "").trim(),
    hashtags: (parsed.hashtags ?? []).map((tag) => String(tag).replace(/^#/, "")).slice(0, 6),
  };
}

function gatewayMessage(status: number, body: string): string {
  if (status === 402) return "AI credits are used up. Add credits to keep generating content.";
  if (status === 403) return "AI access is blocked for this workspace.";
  if (status === 429) return "AI is rate limited right now. Try again in a moment.";
  return `AI request failed (${status}): ${body.slice(0, 300)}`;
}

async function readOutputText(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  let completed = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string; output?: unknown };
        };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          out += event.delta;
        } else if (event.type === "response.completed" && event.response) {
          completed = extractText(event.response) || completed;
        }
      } catch {
        // ignore non-JSON keepalive frames
      }
    }
  }

  const text = (out || completed).trim();
  if (!text) throw new GatewayError(502, "The AI returned an empty result. Try again.");
  return text;
}

function extractText(response: { output_text?: string; output?: unknown }): string {
  if (typeof response.output_text === "string") return response.output_text;
  const output = response.output;
  if (!Array.isArray(output)) return "";
  let text = "";
  for (const item of output as Array<{ content?: Array<{ text?: string }> }>) {
    for (const part of item.content ?? []) {
      if (typeof part.text === "string") text += part.text;
    }
  }
  return text;
}
