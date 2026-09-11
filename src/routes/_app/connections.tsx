import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { toast } from "sonner";

import { getNetworkStatus, updateChannel } from "@/lib/app.functions";
import { NETWORKS } from "@/lib/networks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/connections")({
  head: () => ({
    meta: [
      { title: "Connections — TrendJester" },
      { name: "description", content: "Connect your social accounts and choose which networks the bot writes for." },
      { property: "og:title", content: "Connections — TrendJester" },
      { property: "og:description", content: "Link LinkedIn, X, TikTok, Facebook and Instagram accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getNetworkStatus);
  const saveChannel = useServerFn(updateChannel);

  const { data: channels, isLoading } = useQuery({ queryKey: ["network-status"], queryFn: fetchStatus });

  const toggle = useMutation({
    mutationFn: saveChannel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["network-status"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl text-foreground">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Choose which networks get posts, and see which accounts are linked for automatic posting.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your accounts…</p>}

      <div className="space-y-4">
        {NETWORKS.map((network) => {
          const row = channels?.find((c) => c.channel === network.id);
          return (
            <Card key={network.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {network.name}
                  {row?.linked ? (
                    <Badge className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <CircleDashed className="h-3 w-3" /> Not connected
                    </Badge>
                  )}
                </CardTitle>
                {row && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Write posts</span>
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={(enabled) => toggle.mutate({ data: { id: row.id, enabled } })}
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{network.howTo}</p>
                <p className="text-xs text-muted-foreground">
                  {row?.autoPost
                    ? "The bot can publish here on its own once you approve a post."
                    : "Posts for this network are written for you to copy and publish yourself."}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
