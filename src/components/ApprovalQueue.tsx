import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Pencil, Film, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getDrafts, updateDraft, makeVideoForDraft, approveDraft } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export function ApprovalQueue() {
  const queryClient = useQueryClient();
  const fetchDrafts = useServerFn(getDrafts);
  const saveDraft = useServerFn(updateDraft);
  const makeVideo = useServerFn(makeVideoForDraft);
  const approve = useServerFn(approveDraft);

  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");

  const { data: pending, isLoading } = useQuery({
    queryKey: ["approval-queue"],
    queryFn: () => fetchDrafts({ data: { status: "draft" } }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["approval-queue"] });
    queryClient.invalidateQueries({ queryKey: ["recent-drafts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const mutate = useMutation({
    mutationFn: saveDraft,
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const approveMutation = useMutation({
    mutationFn: approve,
    onSuccess: (result: { ok: boolean; message: string }) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["publish-log"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const video = useMutation({
    mutationFn: makeVideo,
    onSuccess: (result: { message: string }) => {
      toast.success(result.message);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Approval queue</CardTitle>
        <Badge variant="secondary">{pending?.length ?? 0} waiting</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading posts…</p>}
        {!isLoading && (pending?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing waiting for you. New posts land here as soon as the bot writes them.
          </p>
        )}

        {pending?.map((draft) => {
          const isEditing = editing === draft.id;
          return (
            <div key={draft.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{draft.channel}</Badge>
                {draft.topics?.title && (
                  <span className="text-xs text-muted-foreground">{draft.topics.title}</span>
                )}
              </div>

              {isEditing ? (
                <Textarea rows={5} value={text} onChange={(event) => setText(event.target.value)} />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground">{draft.body}</p>
              )}

              {draft.hashtags.length > 0 && (
                <p className="mt-2 text-xs text-primary">{draft.hashtags.map((h) => `#${h}`).join(" ")}</p>
              )}

              {draft.video_url && (
                <video
                  src={draft.video_url}
                  controls
                  className="mt-3 max-h-72 w-full rounded-md bg-muted"
                />
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {isEditing ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        mutate.mutate({ data: { id: draft.id, body: text } });
                        setEditing(null);
                      }}
                    >
                      Save changes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate({ data: { id: draft.id } })}
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Approve & post
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        setEditing(draft.id);
                        setText(draft.body);
                      }}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => mutate.mutate({ data: { id: draft.id, status: "rejected" } })}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                    {draft.video_script && !draft.video_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={video.isPending}
                        onClick={() => video.mutate({ data: { id: draft.id } })}
                      >
                        {video.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Film className="h-4 w-4" />
                        )}
                        Make clip
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
