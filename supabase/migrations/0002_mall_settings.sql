-- Configuración del mall que administra el dueño (hoy: precios de los locales).
-- Todos la leen (los precios se muestran a quien quiere reclamar un local); solo los
-- administradores la cambian.

create table if not exists public.mall_settings (
  key text primary key,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists touch on public.mall_settings;
create trigger touch before update on public.mall_settings for each row execute function public.touch_updated_at();

alter table public.mall_settings enable row level security;
drop policy if exists settings_read on public.mall_settings;
create policy settings_read on public.mall_settings for select using (true);
drop policy if exists settings_write on public.mall_settings;
create policy settings_write on public.mall_settings for all using (public.is_admin()) with check (public.is_admin());

grant select on public.mall_settings to anon, authenticated;
grant insert, update, delete on public.mall_settings to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.mall_settings';
    exception when duplicate_object then null; end;
  end if;
end $$;
