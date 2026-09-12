import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, Loader2, Save, TriangleAlert, Unlink } from "lucide-react";
import { toast } from "sonner";

import {
  getNetworkStatus,
  updateChannel,
  saveChannelCredentials,
  testChannelConnection,
  disconnectChannel,
} from "@/lib/app.functions";
import { NETWORKS, type NetworkMeta } from "@/lib/networks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type StatusRow = {
  id: string;
  channel: string;
  enabled: boolean;
  linked: boolean;
  autoPost: boolean;
  savedFields: string[];
  publicValues: Record<string, string>;
  accountLabel: string | null;
  lastCheckedAt: string | null;
  lastCheckOk: boolean | null;
  lastCheckMessage: string | null;
};

function ConnectionsPage() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getNetworkStatus);
  const saveChannel = useServerFn(updateChannel);

  const { data: channels, isLoading } = useQuery({
    queryKey: ["network-status"],
    queryFn: fetchStatus,
    refetchInterval: 30000,
  });

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
          Paste the details for each account once. We check them straight away, then posts can go out on their own.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your accounts…</p>}

      <div className="space-y-4">
        {NETWORKS.map((network) => {
          const row = (channels as StatusRow[] | undefined)?.find((c) => c.channel === network.id);
          return (
            <NetworkCard
              key={network.id}
              network={network}
              row={row}
              onToggle={(enabled) => row && toggle.mutate({ data: { id: row.id, enabled } })}
            />
          );
        })}
      </div>
    </div>
  );
}

function NetworkCard({
  network,
  row,
  onToggle,
}: {
  network: NetworkMeta;
  row: StatusRow | undefined;
  onToggle: (enabled: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveChannelCredentials);
  const test = useServerFn(testChannelConnection);
  const remove = useServerFn(disconnectChannel);

  const [values, setValues] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["network-status"] });

  const saveMutation = useMutation({
    mutationFn: save,
    onSuccess: (result: { ok: boolean; message: string }) => {
      if (result.ok) {
        toast.success(result.message);
        setValues({});
        setOpen(false);
      } else {
        toast.error(result.message);
      }
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testMutation = useMutation({
    mutationFn: test,
    onSuccess: (result: { ok: boolean; message: string }) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success(`${network.name} disconnected.`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const connected = row?.linked ?? false;
  const hasSaved = (row?.savedFields.length ?? 0) > 0;
  const failed = hasSaved && row?.lastCheckOk === false;

  const missingRequired = network.fields
    .filter((field) => field.required)
    .some((field) => !(values[field.key]?.trim() || row?.savedFields.includes(field.key)));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {network.name}
            {connected ? (
              <Badge className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : failed ? (
              <Badge variant="destructive" className="gap-1">
                <TriangleAlert className="h-3 w-3" /> Needs attention
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <CircleDashed className="h-3 w-3" /> Not connected
              </Badge>
            )}
          </CardTitle>
          {connected && row?.accountLabel && (
            <p className="text-xs text-muted-foreground">Posting as {row.accountLabel}</p>
          )}
          {failed && row?.lastCheckMessage && <p className="text-xs text-destructive">{row.lastCheckMessage}</p>}
        </div>
        {row && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">Write posts</span>
            <Switch checked={row.enabled} onCheckedChange={onToggle} />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{network.howTo}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" /> {network.where}
          </p>
          {network.needsVideo && (
            <p className="text-xs text-muted-foreground">This network needs a finished clip before a post can go out.</p>
          )}
        </div>

        {open || !hasSaved ? (
          <div className="space-y-3 rounded-md border border-border p-4">
            {network.fields.map((field) => {
              const saved = row?.savedFields.includes(field.key);
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`${network.id}-${field.key}`} className="text-sm">
                    {field.label}
                  </Label>
                  <Input
                    id={`${network.id}-${field.key}`}
                    type={field.secret ? "password" : "text"}
                    autoComplete="off"
                    value={values[field.key] ?? (field.secret ? "" : (row?.publicValues?.[field.key] ?? ""))}
                    placeholder={saved && field.secret ? "Saved — leave blank to keep it" : field.hint}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                className="gap-2"
                disabled={saveMutation.isPending || missingRequired}
                onClick={() => saveMutation.mutate({ data: { channel: network.id, credentials: values } })}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save & connect
              </Button>
              {hasSaved && (
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setOpen(true)}>
              Update details
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate({ data: { channel: network.id } })}
            >
              {testMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Test connection
            </Button>
            <Button
              variant="ghost"
              className="gap-2 text-destructive"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate({ data: { channel: network.id } })}
            >
              <Unlink className="h-4 w-4" /> Disconnect
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
