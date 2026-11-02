-- Perfiles de usuario (cliente | negocio), creados automáticamente al registrarse.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'cliente' check (role in ('cliente','negocio')),
  business_name text,
  created_at timestamptz not null default now(),
  constraint negocio_requiere_nombre check (role <> 'negocio' or length(trim(coalesce(business_name,''))) >= 2)
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- El rol no se puede cambiar desde el cliente.
create or replace function public.profiles_lock_role() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'No puedes cambiar el tipo de cuenta';
  end if;
  return new;
end $$;
drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role before update on public.profiles
  for each row execute function public.profiles_lock_role();

-- Crea el perfil al registrarse, leyendo los datos enviados en el registro.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := case when new.raw_user_meta_data->>'role' = 'negocio' then 'negocio' else 'cliente' end;
  bn text := nullif(trim(coalesce(new.raw_user_meta_data->>'business_name','')), '');
begin
  if r = 'negocio' and (bn is null or length(bn) < 2) then r := 'cliente'; bn := null; end if;
  if r = 'cliente' then bn := null; end if;
  insert into public.profiles (id, role, business_name) values (new.id, r, bn) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existían (admins y comerciantes): perfil de cliente.
insert into public.profiles (id, role) select id, 'cliente' from auth.users on conflict (id) do nothing;
