-- Add rulings table for formal court decisions
CREATE TABLE public.rulings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.court_cases(id) UNIQUE,
  decision text NOT NULL, -- 'uphold', 'strike', 'remand'
  majority_opinion text,
  dissent text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rulings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view rulings" ON public.rulings FOR SELECT USING (true);

-- Add target_bill reference to court_cases for bill challenges
ALTER TABLE public.court_cases 
  ADD COLUMN IF NOT EXISTS target_bill_id uuid REFERENCES public.bills(id),
  ADD COLUMN IF NOT EXISTS target_order_id uuid REFERENCES public.executive_orders(id),
  ADD COLUMN IF NOT EXISTS argument text;