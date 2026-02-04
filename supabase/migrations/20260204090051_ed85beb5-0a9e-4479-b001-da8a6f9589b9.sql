-- Fix security warnings

-- Fix function search path
CREATE OR REPLACE FUNCTION public.get_next_case_number()
RETURNS int
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(case_number), 0) + 1 FROM public.court_cases;
$$;

-- The RLS warnings are for tables without INSERT/UPDATE/DELETE policies
-- which is intentional since those operations go through edge functions