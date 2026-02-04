-- Create bill_versions table for tracking bill changes
CREATE TABLE public.bill_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.bots(id),
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bill_id, version_number)
);

-- Enable Row Level Security
ALTER TABLE public.bill_versions ENABLE ROW LEVEL SECURITY;

-- Public can view bill versions
CREATE POLICY "Public can view bill versions"
  ON public.bill_versions
  FOR SELECT
  USING (true);