import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Repeat2, MessageCircle, Eye, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { getAnalytics, refreshAnalytics } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({
    meta: [
      { title: "Post analytics — TrendJester" },
      { name: "description", content: "Likes, shares and comments for every published post so you can tune what works." },
      { property: "og:title", content: "Post analytics — TrendJester" },
      { property: "og:description", content: "See which posts land: likes, shares, comments and views per network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const queryClient = useQueryClient();
  const fetchAnalytics = useServerFn(getAnalytics);
  const refresh = useServerFn(refreshAnalytics);

  const { data: posts, isLoading } = useQuery({ queryKey: ["analytics"], queryFn: fetchAnalytics });

  const refreshMutation = useMutation({
    mutationFn: refresh,
    onSuccess: (result: { message: string }) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totals = (posts ?? []).reduce(
    (sum, post) => ({
      likes: sum.likes + (post.metrics?.likes ?? 0),
      shares: sum.shares + (post.metrics?.shares ?? 0),
      comments: sum.comments + (post.metrics?.comments ?? 0),
      impressions: sum.impressions + (post.metrics?.impressions ?? 0),
    }),
    { likes: 0, shares: 0, comments: 0, impressions: 0 },
  );

  const summary = [
    { label: "Likes", value: totals.likes, icon: Heart },
    { label: "Shares", value: totals.shares, icon: Repeat2 },
    { label: "Comments", value: totals.comments, icon: MessageCircle },
    { label: "Views", value: totals.impressions, icon: Eye },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl text-foreground">Post analytics</h1>
          <p className="text-sm text-muted-foreground">See what people actually liked, shared and replied to.</p>
        </div>
        <Button onClick={() => refreshMutation.mutate({})} disabled={refreshMutation.isPending} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Refresh stats
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
              <item.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-4xl text-foreground">{isLoading ? "—" : item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Published posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading your posts…</p>}
          {!isLoading && (posts?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing published yet. Approve a post and its numbers show up here.
            </p>
          )}
          {posts?.map((post) => (
            <div key={post.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{post.channel}</Badge>
                {post.published_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}
                  </span>
                )}
                {post.external_url && (
                  <a
                    href={post.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> View post
                  </a>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{post.body}</p>
              {post.hashtags?.length > 0 && (
                <p className="mt-2 text-xs text-primary">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-4 w-4" /> {post.metrics?.likes ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Repeat2 className="h-4 w-4" /> {post.metrics?.shares ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" /> {post.metrics?.comments ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4" /> {post.metrics?.impressions ?? 0}
                </span>
              </div>
              {post.metrics?.note && <p className="mt-2 text-xs text-muted-foreground">{post.metrics.note}</p>}
              {!post.metrics && (
                <p className="mt-2 text-xs text-muted-foreground">No numbers yet — hit “Refresh stats”.</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
