-- Fix search path for get_next_executive_order_number function
CREATE OR REPLACE FUNCTION public.get_next_executive_order_number()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.executive_order_number_seq')::INTEGER;
$$;