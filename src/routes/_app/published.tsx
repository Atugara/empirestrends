import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle, XCircle, FileText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

import { getPublishLog } from "@/lib/app.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/published")({
  head: () => ({
    meta: [
      { title: "Published — TrendJester" },
      { name: "description", content: "History of published and failed social posts." },
      { property: "og:title", content: "Published — TrendJester" },
      { property: "og:description", content: "Published post history and status log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublishedPage,
});

function PublishedPage() {
  const fetchLog = useServerFn(getPublishLog);
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["publish-log"],
    queryFn: fetchLog,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-4xl text-foreground">Published</h1>
        <p className="text-sm text-muted-foreground">History of what went out and what failed.</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading history…</div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No posts published yet. Schedule and publish drafts from Review.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {log.status === "published" ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Badge variant={log.status === "published" ? "default" : "destructive"}>{log.channel}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), "PPp")}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/90">{log.drafts?.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{log.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
