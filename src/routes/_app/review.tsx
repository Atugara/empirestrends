import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, X, RefreshCw, Wand2, FileText, Video, Hash } from "lucide-react";
import { toast } from "sonner";

import { getDrafts, updateDraft, generateDrafts } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/review")({
  head: () => ({
    meta: [
      { title: "Review — TrendJester" },
      { name: "description", content: "Edit, approve, reject or regenerate social post drafts." },
      { property: "og:title", content: "Review — TrendJester" },
      { property: "og:description", content: "Review and approve AI-generated social posts before publishing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewPage,
});

const tabs = [
  { value: "draft", label: "Drafts" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
];

function ReviewPage() {
  const queryClient = useQueryClient();
  const fetchDrafts = useServerFn(getDrafts);
  const update = useServerFn(updateDraft);
  const generate = useServerFn(generateDrafts);
  const [activeTab, setActiveTab] = useState("draft");

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["drafts", activeTab],
    queryFn: () => fetchDrafts({ data: { status: activeTab as any } }),
  });

  const updateMutation = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Draft updated.");
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const generateMutation = useMutation({
    mutationFn: generate,
    onSuccess: () => {
      toast.success("Regenerated drafts.");
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-4xl text-foreground">Review queue</h1>
        <p className="text-sm text-muted-foreground">Edit, approve, reject or regenerate drafts.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading drafts…</div>
          ) : drafts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No {tabs.find((t) => t.value === activeTab)?.label.toLowerCase()} drafts yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
              onUpdate={(patch) => updateMutation.mutate({ data: { id: draft.id, ...patch } })}
              onRegenerate={() => generateMutation.mutate({ data: { topicId: draft.topic_id } })}
                  isPending={updateMutation.isPending || generateMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DraftCard({
  draft,
  onUpdate,
  onRegenerate,
  isPending,
}: {
  draft: any;
  onUpdate: (patch: { body?: string; status?: string }) => void;
  onRegenerate: () => void;
  isPending: boolean;
}) {
  const [body, setBody] = useState(draft.body);
  const topic = draft.topics;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{draft.channel}</Badge>
            <span className="text-xs text-muted-foreground">{topic?.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onUpdate({ status: "approved" })} disabled={isPending}>
              <Check className="h-4 w-4 text-success" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onUpdate({ status: "rejected" })} disabled={isPending}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onRegenerate} disabled={isPending}>
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="resize-y" />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onUpdate({ body })} disabled={isPending || body === draft.body}>
            Save edit
          </Button>
          {draft.status === "draft" && (
            <Button size="sm" onClick={() => onUpdate({ body, status: "approved" })} disabled={isPending}>
              Approve
            </Button>
          )}
          {draft.video_script && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Video className="h-3.5 w-3.5" /> Has video script
            </div>
          )}
          {draft.hashtags?.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3.5 w-3.5" /> {draft.hashtags.join(", ")}
            </div>
          )}
        </div>
        {draft.error && <p className="text-sm text-destructive">{draft.error}</p>}
      </CardContent>
    </Card>
  );
}
