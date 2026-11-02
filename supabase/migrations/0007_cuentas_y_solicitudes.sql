-- Cuentas simples (usuario | admin) y solicitudes de local con aprobación del administrador.
-- Reemplaza el modelo cliente/negocio de 0006.

-- 1) profiles: email + roles usuario | admin
alter table public.profiles drop constraint if exists negocio_requiere_nombre;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop column if exists business_name;
alter table public.profiles add column if not exists email text;
alter table public.profiles alter column role drop default;
update public.profiles set role = 'usuario' where role not in ('usuario','admin');
alter table public.profiles add constraint profiles_role_check check (role in ('usuario','admin'));
alter table public.profiles alter column role set default 'usuario';
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- ¿El usuario actual es admin del sitio? (security definer: evita recursión con RLS)
create or replace function public.is_site_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles for select using (public.is_site_admin());

-- Alta automática del perfil (siempre 'usuario'; el primer admin se asigna a mano).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role) values (new.id, new.email, 'usuario') on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) store_requests
create table if not exists public.store_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(trim(business_name)) between 2 and 80),
  category text not null check (char_length(category) between 2 and 40),
  phone text not null check (char_length(trim(phone)) between 7 and 20),
  description text not null check (char_length(trim(description)) between 10 and 500),
  status text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada')),
  created_at timestamptz not null default now()
);
-- Una sola solicitud activa (pendiente o aprobada) por usuario; tras un rechazo puede volver a pedir.
create unique index if not exists store_requests_one_active on public.store_requests (user_id) where status in ('pendiente','aprobada');

alter table public.store_requests enable row level security;
drop policy if exists sr_select on public.store_requests;
create policy sr_select on public.store_requests for select using (user_id = auth.uid() or public.is_site_admin());
drop policy if exists sr_insert on public.store_requests;
create policy sr_insert on public.store_requests for insert with check (user_id = auth.uid() and status = 'pendiente');
drop policy if exists sr_update_admin on public.store_requests;
create policy sr_update_admin on public.store_requests for update using (public.is_site_admin()) with check (public.is_site_admin());
