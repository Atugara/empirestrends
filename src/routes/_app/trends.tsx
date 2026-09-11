import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, RefreshCw, Wand2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { getTopics, runDiscovery, generateDrafts } from "@/lib/app.functions";
import { AVAILABLE_CATEGORIES } from "@/lib/news.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/_app/trends")({
  head: () => ({
    meta: [
      { title: "Trends — TrendJester" },
      { name: "description", content: "Discovered trending topics ready to become funny social posts." },
      { property: "og:title", content: "Trends — TrendJester" },
      { property: "og:description", content: "Browse trending topics and generate social content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrendsPage,
});

function TrendsPage() {
  const queryClient = useQueryClient();
  const fetchTopics = useServerFn(getTopics);
  const discover = useServerFn(runDiscovery);
  const generate = useServerFn(generateDrafts);
  const [filter, setFilter] = useState<string>("all");

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ["topics"],
    queryFn: fetchTopics,
  });

  const discoverMutation = useMutation({
    mutationFn: discover,
    onSuccess: (result) => {
      toast.success(`Found ${result.found} new topics.`);
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const generateMutation = useMutation({
    mutationFn: generate,
    onSuccess: (result) => {
      toast.success(`Created ${result.created} drafts.`);
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = filter === "all" ? topics : topics.filter((t) => t.category === filter);
  const categories = Array.from(new Set(topics.map((t) => t.category)));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl text-foreground">Trends</h1>
          <p className="text-sm text-muted-foreground">Discovered stories waiting to become posts.</p>
        </div>
        <Button onClick={() => discoverMutation.mutate()} disabled={discoverMutation.isPending} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${discoverMutation.isPending ? "animate-spin" : ""}`} />
          Refresh trends
        </Button>
      </div>

      <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v)} className="flex-wrap">
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        {categories.map((c) => (
          <ToggleGroupItem key={c} value={c}>
            {c}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading trends…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">No trends yet. Run discovery to find stories.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((topic) => (
            <Card key={topic.id} className={topic.generated ? "border-l-4 border-l-primary" : undefined}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg leading-snug">{topic.title}</CardTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{topic.category}</Badge>
                      <span>{topic.source_name}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(topic.discovered_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={topic.generated ? "outline" : "default"}
                    disabled={generateMutation.isPending}
                    onClick={() => generateMutation.mutate({ topicId: topic.id })}
                    className="gap-1"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {topic.generated ? "Regenerate" : "Generate"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 line-clamp-3">{topic.summary}</p>
                {topic.source_url && (
                  <a
                    href={topic.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Read source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
