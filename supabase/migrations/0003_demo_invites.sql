-- Versión de prueba con invitación: cada persona entra con su propio código, que el administrador
-- crea, vence o anula. Se registra cada entrada (qué código, desde qué dispositivo y cuándo).
-- Nadie fuera del administrador puede leer los códigos: la versión de prueba solo los valida con
-- demo_enter(), que no revela nada más que el nombre del invitado.

create table if not exists public.demo_invites (
  code text primary key check (code ~ '^[A-Z0-9-]{6,32}$'),
  name text not null check (char_length(name) between 1 and 80),
  expires_at timestamptz not null,
  max_devices int not null default 3 check (max_devices between 1 and 50),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_visits (
  id bigint generated always as identity primary key,
  code text not null references public.demo_invites (code) on delete cascade,
  device text not null,
  user_agent text,
  at timestamptz not null default now()
);
create index if not exists demo_visits_code on public.demo_visits (code, at desc);

alter table public.demo_invites enable row level security;
alter table public.demo_visits enable row level security;

drop policy if exists demo_invites_admin on public.demo_invites;
create policy demo_invites_admin on public.demo_invites for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists demo_visits_admin on public.demo_visits;
create policy demo_visits_admin on public.demo_visits for select using (public.is_admin());
drop policy if exists demo_visits_admin_delete on public.demo_visits;
create policy demo_visits_admin_delete on public.demo_visits for delete using (public.is_admin());

revoke all on public.demo_invites, public.demo_visits from anon;
grant select, insert, update, delete on public.demo_invites to authenticated;
grant select, delete on public.demo_visits to authenticated;

-- Valida un código desde la versión de prueba. Un dispositivo nuevo cuenta contra el cupo de
-- dispositivos; volver a entrar desde el mismo no. Las entradas se anotan como mucho cada 10 minutos.
create or replace function public.demo_enter(p_code text, p_device text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.demo_invites;
  used int;
  known boolean;
  ua text;
begin
  if p_code is null or p_device is null or char_length(p_device) not between 8 and 64 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select * into inv from public.demo_invites where code = upper(btrim(p_code));
  if not found or inv.revoked then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if inv.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  select exists (select 1 from public.demo_visits where code = inv.code and device = p_device) into known;
  if not known then
    select count(distinct device) into used from public.demo_visits where code = inv.code;
    if used >= inv.max_devices then
      return jsonb_build_object('ok', false, 'reason', 'full');
    end if;
  end if;
  if not exists (select 1 from public.demo_visits where code = inv.code and device = p_device and at > now() - interval '10 minutes') then
    begin
      ua := left(nullif(current_setting('request.headers', true), '')::json ->> 'user-agent', 300);
    exception when others then
      ua := null;
    end;
    insert into public.demo_visits (code, device, user_agent) values (inv.code, p_device, ua);
  end if;
  return jsonb_build_object('ok', true, 'name', inv.name, 'expires_at', inv.expires_at);
end
$$;

revoke all on function public.demo_enter(text, text) from public;
grant execute on function public.demo_enter(text, text) to anon, authenticated;
