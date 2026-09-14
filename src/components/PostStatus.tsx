import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { getPostStatus, retryPublish } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PostStatus() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getPostStatus);
  const retry = useServerFn(retryPublish);

  const { data, isLoading } = useQuery({
    queryKey: ["post-status"],
    queryFn: fetchStatus,
    refetchInterval: 30_000,
  });

  const retryMutation = useMutation({
    mutationFn: retry,
    onSuccess: (result: { ok: boolean; message: string }) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      queryClient.invalidateQueries({ queryKey: ["post-status"] });
      queryClient.invalidateQueries({ queryKey: ["recent-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["publish-log"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Post status</CardTitle>
        <div className="flex gap-2">
          <Badge variant="default">{data?.counts.published ?? 0} posted</Badge>
          <Badge variant="secondary">{data?.counts.awaiting ?? 0} waiting to send</Badge>
          <Badge variant="destructive">{data?.counts.failed ?? 0} failed</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading status…</p>}
        {!isLoading && (data?.posts.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing sent yet. Approve a post and it goes straight to that network.
          </p>
        )}
        {data?.posts.map((post) => (
          <div key={post.id} className="rounded-lg border border-border p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{post.channel}</Badge>
              <Badge variant={statusVariant(post.status)}>{statusLabel(post.status)}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.published_at ?? post.updated_at), { addSuffix: true })}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-foreground">{post.body}</p>
            {post.external_url && (
              <a
                href={post.external_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-primary hover:underline"
              >
                View live post
              </a>
            )}
            {post.error && <p className="mt-1 text-xs text-destructive">{post.error}</p>}
            {post.status !== "published" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1"
                disabled={retryMutation.isPending}
                onClick={() => retryMutation.mutate({ data: { id: post.id } })}
              >
                <RefreshCw className={`h-4 w-4 ${retryMutation.isPending ? "animate-spin" : ""}`} />
                Try posting again
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function statusLabel(status: string) {
  if (status === "published") return "posted";
  if (status === "failed") return "failed";
  return "waiting to send";
}

function statusVariant(status: string) {
  if (status === "published") return "default" as const;
  if (status === "failed") return "destructive" as const;
  return "outline" as const;
}
