-- Pxl Opis: two-way Monday.com sync. Run once in the Supabase SQL editor after
-- the earlier migrations.
--
-- Picked boards become projects and their items become tasks. Changes made in
-- the office are sent back to Monday.com by the server (see lib/connectors/sync.ts).

-- Which boards a connection syncs ({ "boards": [{ "id": "123", "name": "Roadmap" }] }),
-- and when it last ran.
alter table public.integrations add column settings jsonb not null default '{}';
alter table public.integrations add column synced_at timestamptz;

-- Where a project came from, and which Monday.com columns hold its status,
-- priority, due date and people. No secrets, so members may read it.
alter table public.projects add column source text not null default 'local'
  check (source in ('local', 'monday'));
alter table public.projects add column sync jsonb;

-- One project per board and one task per item, so syncing again updates them.
-- Rows without an external_ref (made in the office) never collide: nulls are distinct.
create unique index projects_external_idx on public.projects (workspace_id, source, external_ref);
create unique index tasks_external_idx on public.tasks (workspace_id, source, external_ref);
