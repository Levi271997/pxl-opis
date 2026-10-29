-- Pxl Opis: connectors (Monday.com, ClickUp, GitHub) for the Connectors settings.
-- Run once in the Supabase SQL editor after the earlier migrations.
--
-- Connections live in the existing `integrations` table, which has RLS on and no
-- policies: browsers can't read it at all. Only server code using the secret key
-- (SUPABASE_SECRET_KEY) touches it, and the app encrypts tokens before saving
-- them (CONNECTORS_SECRET, see docs/CONNECTORS.md).

alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check
  check (provider in ('monday', 'clickup', 'github'));

alter table public.integrations add column scope text;
alter table public.integrations add column updated_at timestamptz not null default now();

create trigger integrations_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();
