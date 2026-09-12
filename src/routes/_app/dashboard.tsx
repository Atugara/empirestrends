import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, FileText, CalendarClock, CheckCircle, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { getDashboardStats, runPipelineNow, getRecentDrafts } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApprovalQueue } from "@/components/ApprovalQueue";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TrendJester" },
      { name: "description", content: "Overview of trending topics, drafts, schedule and publishing pipeline." },
      { property: "og:title", content: "Dashboard — TrendJester" },
      { property: "og:description", content: "Your trend discovery and social publishing pipeline at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const fetchStats = useServerFn(getDashboardStats);
  const runPipeline = useServerFn(runPipelineNow);
  const fetchRecent = useServerFn(getRecentDrafts);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
  });

  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ["recent-drafts"],
    queryFn: fetchRecent,
  });

  const runMutation = useMutation({
    mutationFn: runPipeline,
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const statCards = [
    { label: "Trends found", value: stats?.topics ?? 0, icon: Sparkles, href: "/trends" },
    { label: "Drafts to review", value: stats?.drafts ?? 0, icon: FileText, href: "/review" },
    { label: "Scheduled", value: stats?.scheduled ?? 0, icon: CalendarClock, href: "/schedule" },
    { label: "Published", value: stats?.published ?? 0, icon: CheckCircle, href: "/published" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Trending news in. Funny posts out.</p>
        </div>
        <Button onClick={() => runMutation.mutate({})} disabled={runMutation.isPending} className="gap-2">
          {runMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run pipeline now
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.label} to={card.href}>
            <Card className="h-full transition-colors hover:bg-accent/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <card.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="font-display text-4xl text-foreground">{isLoading ? "—" : card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pipeline health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats?.lastRun ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant={healthVariant(stats.lastRun.status)}>{stats.lastRun.status}</Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(stats.lastRun.started_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-foreground">
                {stats.lastRun.topics_found} topics found · {stats.lastRun.drafts_created} drafts created
              </p>
              {stats.lastRun.error && <p className="text-sm text-destructive">{stats.lastRun.error}</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No pipeline runs yet. Hit “Run pipeline now” to get started.</p>
          )}
        </CardContent>
      </Card>

      <ApprovalQueue />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Latest generated posts</CardTitle>
          <Link to="/review" className="text-sm text-primary hover:underline">
            Review all
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentLoading && <p className="text-sm text-muted-foreground">Loading posts…</p>}
          {!recentLoading && (recent?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing written yet. The bot runs every morning, or press “Run pipeline now”.
            </p>
          )}
          {recent?.map((draft) => (
            <div key={draft.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{draft.channel}</Badge>
                <Badge variant="outline">{draft.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(draft.created_at), { addSuffix: true })}
                </span>
              </div>
              {draft.topics?.title && (
                <p className="mb-1 text-xs font-medium text-muted-foreground">{draft.topics.title}</p>
              )}
              <p className="whitespace-pre-wrap text-sm text-foreground">{draft.body}</p>
              {draft.video_script && (
                <p className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                  {draft.video_script}
                </p>
              )}
              {draft.video_url && (
                <video src={draft.video_url} controls className="mt-3 max-h-72 w-full rounded-md bg-muted" />
              )}
              {draft.hashtags.length > 0 && (
                <p className="mt-2 text-xs text-primary">{draft.hashtags.map((h) => `#${h}`).join(" ")}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


function healthVariant(status: string) {
  if (status === "success") return "default";
  if (status === "running") return "secondary";
  if (status === "paused") return "outline";
  return "destructive";
}
