import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { getSettings, updateSettings, getChannels, updateChannel } from "@/lib/app.functions";
import { AVAILABLE_CATEGORIES } from "@/lib/news.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TrendJester" },
      { name: "description", content: "Configure topics, humour, schedule and connected social accounts." },
      { property: "og:title", content: "Settings — TrendJester" },
      { property: "og:description", content: "Configure TrendJester topics, humour level and connected accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getSettings);
  const saveSettings = useServerFn(updateSettings);
  const fetchChannels = useServerFn(getChannels);
  const saveChannel = useServerFn(updateChannel);

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });
  const { data: channels = [], isLoading: loadingChannels } = useQuery({
    queryKey: ["channels"],
    queryFn: fetchChannels,
  });

  const [form, setForm] = useState({
    categories: [] as string[],
    keywords: "",
    humorLevel: 7,
    dailyPostCap: 3,
    postingWindowStart: 9,
    postingWindowEnd: 18,
    autoRun: true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        categories: settings.categories ?? ["general"],
        keywords: settings.keywords ?? "",
        humorLevel: settings.humor_level ?? 7,
        dailyPostCap: settings.daily_post_cap ?? 3,
        postingWindowStart: settings.posting_window_start ?? 9,
        postingWindowEnd: settings.posting_window_end ?? 18,
        autoRun: settings.auto_run ?? true,
      });
    }
  }, [settings]);

  const settingsMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      toast.success("Settings saved.");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const channelMutation = useMutation({
    mutationFn: saveChannel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (loadingSettings || loadingChannels) {
    return <div className="text-sm text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Tune the bot to your taste and channels.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <SlidersHorizontal className="h-5 w-5" /> Topics & tone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Categories</Label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_CATEGORIES.map((cat) => (
                <label key={cat} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.categories.includes(cat)}
                    onCheckedChange={(checked) => {
                      setForm((f) => ({
                        ...f,
                        categories: checked ? [...f.categories, cat] : f.categories.filter((c) => c !== cat),
                      }));
                    }}
                  />
                  <span className="capitalize">{cat}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords to prefer</Label>
            <Input
              id="keywords"
              value={form.keywords}
              onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
              placeholder="comma, separated, keywords"
            />
            <p className="text-xs text-muted-foreground">Currently used as a hint for discovery filtering.</p>
          </div>

          <div className="space-y-2">
            <Label>Humour level: {form.humorLevel}/10</Label>
            <Slider
              value={[form.humorLevel]}
              min={1}
              max={10}
              step={1}
              onValueChange={([v]) => setForm((f) => ({ ...f, humorLevel: v ?? 5 }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cap">Daily post cap</Label>
              <Input
                id="cap"
                type="number"
                min={1}
                max={50}
                value={form.dailyPostCap}
                onChange={(e) => setForm((f) => ({ ...f, dailyPostCap: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Posting window start</Label>
              <Input
                id="start"
                type="number"
                min={0}
                max={23}
                value={form.postingWindowStart}
                onChange={(e) => setForm((f) => ({ ...f, postingWindowStart: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Posting window end</Label>
              <Input
                id="end"
                type="number"
                min={0}
                max={23}
                value={form.postingWindowEnd}
                onChange={(e) => setForm((f) => ({ ...f, postingWindowEnd: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-4">
            <div>
              <Label htmlFor="auto" className="text-sm font-medium">Auto-run daily pipeline</Label>
              <p className="text-xs text-muted-foreground">Discover and draft new content automatically.</p>
            </div>
            <Switch
              id="auto"
              checked={form.autoRun}
              onCheckedChange={(v) => setForm((f) => ({ ...f, autoRun: v }))}
            />
          </div>

          <Button onClick={() => settingsMutation.mutate({ data: form })} disabled={settingsMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" /> Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="flex items-center gap-2 font-medium capitalize">{channel.channel}</div>
                <div className="text-xs text-muted-foreground">
                  {channel.connected ? `Connected as ${channel.account_label || "account"}` : "Not connected"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={channel.enabled ? "default" : "secondary"}>{channel.enabled ? "Enabled" : "Disabled"}</Badge>
                <Switch
                  checked={channel.enabled}
                  onCheckedChange={(v) => channelMutation.mutate({ data: { id: channel.id, enabled: v } })}
                  disabled={channelMutation.isPending}
                />
              </div>
            </div>
          ))}
          {channels.length === 0 && (
            <p className="text-sm text-muted-foreground">No channels configured. LinkedIn can be connected via the gateway; others are stubbed until credentials are added.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
