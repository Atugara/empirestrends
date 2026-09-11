import { createFileRoute } from "@tanstack/react-router";
import { runPipeline } from "@/lib/pipeline.server";

export const Route = createFileRoute("/api/public/run-pipeline")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        if (!secret || secret !== process.env["CRON_SECRET"]) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: users, error } = await supabaseAdmin
          .from("settings")
          .select("user_id")
          .eq("auto_run", true);
        if (error) {
          return new Response(`Database error: ${error.message}`, { status: 500 });
        }

        const results: { user_id: string; status: string; message: string }[] = [];
        for (const row of users ?? []) {
          try {
            const summary = await runPipeline(supabaseAdmin, row.user_id, { batchSize: 3, source: "cron" });
            results.push({ user_id: row.user_id, status: summary.status, message: summary.message });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            results.push({ user_id: row.user_id, status: "failed", message });
          }
        }

        return Response.json({ ran: results.length, results });
      },
    },
  },
});
