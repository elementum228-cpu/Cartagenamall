-- Bonos del Arcade: cada canje queda registrado en el servidor para que el negocio pueda validarlo en caja y no se use dos veces.
-- El premio (título, condiciones, vencimiento) se toma SIEMPRE de lo que el negocio publicó en su tienda, nunca de lo que mande el navegador.

create table if not exists public.arcade_vouchers (
  code text primary key check (code ~ '^CM-[A-Z0-9]{4,10}$'),
  store_id text not null references public.stores (id) on delete cascade,
  reward_id text not null,
  title text not null,
  detail text,
  until date,
  issued_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid
);
create index if not exists arcade_vouchers_store_idx on public.arcade_vouchers (store_id, issued_at desc);
alter table public.arcade_vouchers enable row level security;
revoke all on public.arcade_vouchers from anon, authenticated;

-- ¿Quien llama es administrador o dueño de esa tienda?
create or replace function public.can_manage_store(p_store text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.store_members m where m.store_id = p_store and m.user_id = auth.uid())
$$;

-- El jugador registra su bono al canjear. Solo se acepta si la tienda tiene ese premio publicado y activo.
create or replace function public.voucher_issue(p_code text, p_store text, p_reward text) returns text
language plpgsql security definer set search_path = public as $$
declare
  d jsonb;
  rw jsonb;
begin
  if p_code is null or p_code !~ '^CM-[A-Z0-9]{4,10}$' then raise exception 'código inválido' using errcode = '22023'; end if;
  select doc into d from public.stores where id = p_store;
  if d is null then raise exception 'tienda desconocida' using errcode = '22023'; end if;
  select x into rw from jsonb_array_elements(coalesce(d -> 'arcadeRewards', '[]'::jsonb)) x where x ->> 'id' = p_reward limit 1;
  if rw is null then raise exception 'premio desconocido' using errcode = '22023'; end if;
  insert into public.arcade_vouchers (code, store_id, reward_id, title, detail, until)
  values (p_code, p_store, p_reward, left(coalesce(rw ->> 'title', ''), 80), nullif(left(coalesce(rw ->> 'detail', ''), 200), ''),
          case when coalesce(rw ->> 'until', '') ~ '^\d{4}-\d{2}-\d{2}$' then (rw ->> 'until')::date end)
  on conflict (code) do nothing;
  return 'ok';
end $$;

-- El jugador consulta si su bono ya fue usado (para mostrarlo «USADO»).
create or replace function public.voucher_status(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('used', used_at is not null, 'used_at', used_at) from public.arcade_vouchers where code = upper(trim(p_code))
$$;

-- El negocio busca un bono por su código (solo los de su tienda).
create or replace function public.voucher_lookup(p_store text, p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.arcade_vouchers;
begin
  if not public.can_manage_store(p_store) then raise exception 'sin permiso' using errcode = '42501'; end if;
  select * into v from public.arcade_vouchers where code = upper(trim(p_code)) and store_id = p_store;
  if v.code is null then return null; end if;
  return jsonb_build_object('code', v.code, 'title', v.title, 'detail', v.detail, 'until', v.until, 'issued_at', v.issued_at, 'used_at', v.used_at,
    'expired', v.until is not null and v.until < (now() at time zone 'America/Bogota')::date);
end $$;

-- El negocio marca el bono como usado. Atómico: dos cajeros no pueden canjear el mismo bono.
create or replace function public.voucher_use(p_store text, p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare v public.arcade_vouchers;
begin
  if not public.can_manage_store(p_store) then raise exception 'sin permiso' using errcode = '42501'; end if;
  select * into v from public.arcade_vouchers where code = upper(trim(p_code)) and store_id = p_store for update;
  if v.code is null then return 'not_found'; end if;
  if v.used_at is not null then return 'used'; end if;
  if v.until is not null and v.until < (now() at time zone 'America/Bogota')::date then return 'expired'; end if;
  update public.arcade_vouchers set used_at = now(), used_by = auth.uid() where code = v.code;
  return 'ok';
end $$;

-- Últimos bonos de la tienda (los 30 más recientes).
create or replace function public.voucher_recent(p_store text) returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_store(p_store) then raise exception 'sin permiso' using errcode = '42501'; end if;
  return query select jsonb_build_object('code', code, 'title', title, 'issued_at', issued_at, 'used_at', used_at) from public.arcade_vouchers where store_id = p_store order by issued_at desc limit 30;
end $$;

grant execute on function public.voucher_issue(text, text, text) to anon, authenticated;
grant execute on function public.voucher_status(text) to anon, authenticated;
grant execute on function public.voucher_lookup(text, text) to authenticated;
grant execute on function public.voucher_use(text, text) to authenticated;
grant execute on function public.voucher_recent(text) to authenticated;
