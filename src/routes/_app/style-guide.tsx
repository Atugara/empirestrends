import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Save, Palette } from "lucide-react";
import { toast } from "sonner";

import { getSettings, updateSettings } from "@/lib/app.functions";
import { TONES, POST_LENGTHS } from "@/lib/networks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/style-guide")({
  head: () => ({
    meta: [
      { title: "Style guide — TrendJester" },
      { name: "description", content: "Set the tone, length and humour level used for every generated post." },
      { property: "og:title", content: "Style guide — TrendJester" },
      { property: "og:description", content: "Define your posting voice: tone, length and humour level." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StyleGuidePage,
});

type LengthId = (typeof POST_LENGTHS)[number]["id"];

function StyleGuidePage() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getSettings);
  const saveSettings = useServerFn(updateSettings);

  const { data: settings, isLoading } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

  const [form, setForm] = useState({
    tone: "witty",
    postLength: "medium" as LengthId,
    humorLevel: 7,
    styleNotes: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        tone: settings.tone ?? "witty",
        postLength: (settings.post_length ?? "medium") as LengthId,
        humorLevel: settings.humor_level ?? 7,
        styleNotes: settings.style_notes ?? "",
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      toast.success("Style guide saved — new posts will follow it.");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading your style guide…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl text-foreground">Style guide</h1>
        <p className="text-sm text-muted-foreground">
          Every post the bot writes follows these rules.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5" /> Voice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-3">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <Button
                  key={tone.id}
                  type="button"
                  variant={form.tone === tone.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, tone: tone.id }))}
                >
                  {tone.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Length</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {POST_LENGTHS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, postLength: option.id }))}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    form.postLength === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent/30"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Humour level: {form.humorLevel}/10</Label>
            <Slider
              value={[form.humorLevel]}
              min={1}
              max={10}
              step={1}
              onValueChange={([v]) => setForm((f) => ({ ...f, humorLevel: v ?? 7 }))}
            />
            <p className="text-xs text-muted-foreground">
              1 is straight reporting, 10 is full stand-up routine.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">House rules (optional)</Label>
            <Textarea
              id="notes"
              rows={4}
              value={form.styleNotes}
              onChange={(e) => setForm((f) => ({ ...f, styleNotes: e.target.value }))}
              placeholder="e.g. always end with a question, never use emojis, mention our brand name once"
            />
          </div>

          <Button onClick={() => mutation.mutate({ data: form })} disabled={mutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {mutation.isPending ? "Saving…" : "Save style guide"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
