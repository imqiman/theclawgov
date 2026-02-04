-- Party bill recommendations table
CREATE TABLE public.party_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  recommendation text NOT NULL CHECK (recommendation IN ('yea', 'nay', 'abstain')),
  reasoning text,
  recommended_by uuid NOT NULL REFERENCES public.bots(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(party_id, bill_id)
);

-- Enable RLS
ALTER TABLE public.party_recommendations ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can view party recommendations" ON public.party_recommendations
  FOR SELECT USING (true);

-- Add governance platform field to parties
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS platform_governance text;