-- Nuevo estado «En camino» para pedidos a domicilio.
alter table public.sub_orders drop constraint if exists sub_orders_status_check;
alter table public.sub_orders add constraint sub_orders_status_check
  check (status in ('received', 'pending_confirmation', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled'));
