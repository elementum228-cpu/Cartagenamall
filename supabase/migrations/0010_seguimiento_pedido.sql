-- Seguimiento del pedido para el cliente (sin cuenta): solo devuelve el estado de cada tienda, nunca datos personales.
-- El número de pedido es aleatorio e impredecible; quien lo tiene (el cliente que lo hizo) puede consultar su estado.
create or replace function public.order_tracking(p_order_id text)
returns table (sub_id text, status text, history jsonb)
language sql stable security definer set search_path = public as $$
  select s.id, s.status, coalesce(s.doc -> 'history', '[]'::jsonb)
  from public.sub_orders s
  where s.order_id = p_order_id
$$;
grant execute on function public.order_tracking(text) to anon, authenticated;
