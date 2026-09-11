-- Style guide fields
alter table public.settings
  add column if not exists tone text not null default 'witty',
  add column if not exists post_length text not null default 'medium',
  add column if not exists style_notes text not null default '';

-- Shared secret used by the daily automation call
create table if not exists public.automation_config (
  id boolean primary key default true,
  cron_secret text not null,
  constraint automation_config_single_row check (id)
);

grant all on public.automation_config to service_role;
alter table public.automation_config enable row level security;
-- no policies: only the service role (server side) can read this row

insert into public.automation_config (id, cron_secret)
values (true, 'tj_2f8c41d7a95b4e6fa0c3d18e7b6249af')
on conflict (id) do nothing;

-- Daily automation schedule
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('trendjester-daily-run')
where exists (select 1 from cron.job where jobname = 'trendjester-daily-run');

select cron.schedule(
  'trendjester-daily-run',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://project--5a60b9e3-cb4e-40fa-90ff-2286d34074a0-dev.lovable.app/api/public/run-pipeline',
    headers := '{"Content-Type":"application/json","x-cron-secret":"tj_2f8c41d7a95b4e6fa0c3d18e7b6249af"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);