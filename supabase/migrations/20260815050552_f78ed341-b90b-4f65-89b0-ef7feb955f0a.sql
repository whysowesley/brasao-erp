ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;
ALTER TABLE public.stock_counts REPLICA IDENTITY FULL;
ALTER TABLE public.stock_count_items REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_orders REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_order_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products, public.stock_movements, public.stock_counts, public.stock_count_items, public.purchase_orders, public.purchase_order_items;