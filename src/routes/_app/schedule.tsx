import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import { getDrafts, updateDraft } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — TrendJester" },
      { name: "description", content: "View and manage your approved post schedule." },
      { property: "og:title", content: "Schedule — TrendJester" },
      { property: "og:description", content: "Manage scheduled social media posts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const queryClient = useQueryClient();
  const fetchDrafts = useServerFn(getDrafts);
  const update = useServerFn(updateDraft);

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["drafts", "scheduled"],
    queryFn: () => fetchDrafts({ data: { status: "scheduled" } }),
  });

  const updateMutation = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Schedule updated.");
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-4xl text-foreground">Schedule</h1>
        <p className="text-sm text-muted-foreground">Approved posts queued for publishing.</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading schedule…</div>
      ) : drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing scheduled. Approve drafts in Review and set a time.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <ScheduledCard
              key={draft.id}
              draft={draft}
              onUpdate={(patch) => updateMutation.mutate({ data: { id: draft.id, ...patch } })}
              isPending={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduledCard({
  draft,
  onUpdate,
  isPending,
}: {
  draft: any;
  onUpdate: (patch: { scheduledAt?: string | null; status?: string }) => void;
  isPending: boolean;
}) {
  const scheduled = draft.scheduled_at ? parseISO(draft.scheduled_at) : null;
  const localValue = scheduled
    ? format(scheduled, "yyyy-MM-dd'T'HH:mm")
    : "";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{draft.channel}</Badge>
            <span className="text-xs text-muted-foreground">{draft.topics?.title}</span>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onUpdate({ status: "approved", scheduledAt: null })} disabled={isPending}>
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{draft.body}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              type="datetime-local"
              defaultValue={localValue}
              onBlur={(e) => {
                if (e.target.value) {
                  const date = new Date(e.target.value);
                  onUpdate({ scheduledAt: date.toISOString() });
                }
              }}
              className="w-auto"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {scheduled ? format(scheduled, "PPp") : "Pick a time"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
