-- Asegura que las promociones y el resto del catálogo se difundan en tiempo real (Realtime) a todos los usuarios.
do $$ declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['stores', 'products', 'promotions', 'space_assignments', 'mall_settings'] loop
      begin execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null; end;
    end loop;
  end if;
end $$;
