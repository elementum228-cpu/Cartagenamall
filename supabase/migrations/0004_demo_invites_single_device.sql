-- Invitaciones de un solo dispositivo: el enlace queda amarrado al primer dispositivo que lo abre.
-- Si se reenvía, el otro dispositivo queda bloqueado y el intento se anota (blocked) para que el
-- administrador lo vea. Liberar un enlace = borrar sus entradas (el próximo dispositivo lo toma).

alter table public.demo_visits add column if not exists blocked boolean not null default false;
alter table public.demo_invites alter column max_devices set default 1;

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
  ok boolean := true;
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
  select exists (select 1 from public.demo_visits where code = inv.code and device = p_device and not blocked) into known;
  if not known then
    select count(distinct device) into used from public.demo_visits where code = inv.code and not blocked;
    ok := used < inv.max_devices;
  end if;
  -- se anota cada entrada (y cada intento bloqueado) como mucho cada 10 minutos por dispositivo
  if not exists (select 1 from public.demo_visits where code = inv.code and device = p_device and blocked = not ok and at > now() - interval '10 minutes') then
    begin
      ua := left(nullif(current_setting('request.headers', true), '')::json ->> 'user-agent', 300);
    exception when others then
      ua := null;
    end;
    insert into public.demo_visits (code, device, user_agent, blocked) values (inv.code, p_device, ua, not ok);
  end if;
  if not ok then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  return jsonb_build_object('ok', true, 'name', inv.name, 'expires_at', inv.expires_at);
end
$$;

revoke all on function public.demo_enter(text, text) from public;
grant execute on function public.demo_enter(text, text) to anon, authenticated;
