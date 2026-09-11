# Trend-to-Post Bot

An app that hunts global trending topics every day, turns them into laugh-out-loud posts and short video scripts, and lets you approve everything before it goes out.

## How it works for you

1. **Discover** — a daily scan collects trending stories across entertainment, social, politics and general news.
2. **Generate** — for each story the bot writes: an X/Twitter post, a LinkedIn post, a Facebook post, and a short-form video script (hook, beats, caption, hashtags). Tone dialled to maximum comedy, with a safety pass so political topics stay funny, not offensive.
3. **Review** — everything lands in a review queue. You edit, approve, reject, or regenerate.
4. **Schedule & publish** — approved posts get a time slot. Nothing is published without your approval.
5. **Monitor** — a dashboard shows pipeline status, last run, published history, and failures.

## Screens

- **Dashboard** — today's trends found, drafts awaiting review, scheduled count, published count, pipeline health, "Run discovery now" button.
- **Trends** — list of discovered topics with source, category, freshness; generate content from any of them.
- **Review queue** — draft cards per topic with tabs per network plus the video script; inline editing, approve / reject / regenerate.
- **Schedule** — calendar/list of approved posts and their send times; pause or reschedule.
- **Published** — history with status, target account, timestamp, and any error.
- **Settings** — connected accounts, topic categories and keywords, humour level, daily post caps, posting windows, auto-run on/off.

## Accounts

Start with drafts you can copy out, and add real auto-posting per network. LinkedIn connects through the built-in LinkedIn connector. X/Twitter, Facebook and Instagram/TikTok show as connectable channels; each will need its own credentials, which I will request when you're ready to switch one on.

## Design

Dark newsroom-meets-comedy-club look: near-black background, hot signal-orange accent, condensed display type for headlines against a clean sans for body. Dense card/table layouts, status pills, no generic purple gradients.

## Technical notes

- **Backend**: Lovable Cloud (database + auth). Tables: `topics`, `drafts` (one row per topic × channel, with status enum), `schedules`, `publish_log`, `channels`, `settings`, `pipeline_runs` (single-flight lease + status for the daily job). RLS scoped to the owner; explicit grants on every table.
- **Discovery**: server function that pulls trending items via web search, dedupes on a unique source key, and stores new topics.
- **Generation**: Lovable AI Gateway, `openai/gpt-6-astra` on the Responses API, streaming, strict JSON schema output for the multi-channel post bundle.
- **Automation**: `src/routes/api/public/run-pipeline.ts` invoked by pg_cron, with bounded batch size, a lease row for single-flight, idempotent per-topic marking, and a circuit breaker that pauses the job on credit/permission errors and probes once per later run.
- **Publishing**: per-channel adapters; LinkedIn via the connector gateway (`v2/ugcPosts`), others stubbed behind the same interface until credentials are added.
- Every route gets its own head() metadata; `/` becomes the dashboard.

## Build order

1. Cloud backend, schema, auth, design system.
2. Dashboard + Trends + discovery server function.
3. Generation + Review queue.
4. Schedule, Published, Settings.
5. Cron pipeline with the safety rails, then LinkedIn publishing.
