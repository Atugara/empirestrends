-- Move the private automation key out of the API schema entirely
create schema if not exists private;
create table if not exists private.automation_config (
  id boolean primary key default true,
  cron_secret text not null,
  constraint automation_config_single_row check (id)
);
insert into private.automation_config (id, cron_secret)
values (true, 'tj_2f8c41d7a95b4e6fa0c3d18e7b6249af')
on conflict (id) do nothing;
drop table if exists public.automation_config;

revoke all on schema private from anon, authenticated;
grant usage on schema private to service_role;
grant select on private.automation_config to service_role;

-- pg_net cannot leave the public schema, so keep its functions unreachable from the API
revoke all on all functions in schema net from anon, authenticated;
revoke all on all tables in schema net from anon, authenticated;
revoke usage on schema net from anon, authenticated;