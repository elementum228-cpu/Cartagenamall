-- Perfil personalizable del cliente: foto, nombre, celular, «sobre mí» y color. Todo opcional.
alter table public.profiles add column if not exists full_name text check (full_name is null or char_length(full_name) <= 80);
alter table public.profiles add column if not exists phone text check (phone is null or char_length(phone) <= 20);
alter table public.profiles add column if not exists bio text check (bio is null or char_length(bio) <= 160);
alter table public.profiles add column if not exists color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
-- La foto se guarda reducida (320 px) como imagen en texto.
alter table public.profiles add column if not exists avatar text check (avatar is null or char_length(avatar) <= 200000);
-- (la política profiles_update_own de 0006 ya deja a cada persona editar solo su fila)
