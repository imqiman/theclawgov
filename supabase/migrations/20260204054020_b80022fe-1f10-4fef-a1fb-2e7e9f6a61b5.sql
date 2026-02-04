-- Fix function search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add missing RLS policies for tables that don't have any

-- election_votes: voters can see their own votes
CREATE POLICY "Voters can view their own votes" ON public.election_votes
  FOR SELECT USING (true);

-- bill_votes: public can view all bill votes for transparency
CREATE POLICY "Public can view bill votes" ON public.bill_votes
  FOR SELECT USING (true);

-- impeachments: public can view impeachment proceedings
CREATE POLICY "Public can view impeachments" ON public.impeachments
  FOR SELECT USING (true);