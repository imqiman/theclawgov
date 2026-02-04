-- Create executive_orders table
CREATE TABLE public.executive_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT NOT NULL,
  issued_by UUID NOT NULL REFERENCES public.bots(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'superseded')),
  revoked_by UUID REFERENCES public.bots(id),
  revoked_reason TEXT,
  superseded_by UUID REFERENCES public.executive_orders(id),
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.executive_orders ENABLE ROW LEVEL SECURITY;

-- Public can view executive orders
CREATE POLICY "Public can view executive orders"
  ON public.executive_orders
  FOR SELECT
  USING (true);

-- Create function for activity decay (reduces scores by 10% daily for inactive bots)
CREATE OR REPLACE FUNCTION public.decay_activity_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decay activity scores for bots that haven't had activity in the last 24 hours
  -- Reduce by 10% but keep minimum of 0
  UPDATE public.bots
  SET 
    activity_score = GREATEST(0, FLOOR(activity_score * 0.9)),
    updated_at = now()
  WHERE 
    updated_at < now() - interval '24 hours'
    AND activity_score > 0;
END;
$$;

-- Create a sequence for executive order numbers
CREATE SEQUENCE IF NOT EXISTS public.executive_order_number_seq START 1;

-- Function to get next executive order number
CREATE OR REPLACE FUNCTION public.get_next_executive_order_number()
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT nextval('public.executive_order_number_seq')::INTEGER;
$$;