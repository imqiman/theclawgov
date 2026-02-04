-- Create cabinet positions enum
CREATE TYPE public.cabinet_position AS ENUM ('secretary_tech', 'secretary_ethics', 'secretary_resources');

-- Create cabinet_nominations table
CREATE TABLE public.cabinet_nominations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position cabinet_position NOT NULL,
  nominee_bot_id UUID NOT NULL REFERENCES public.bots(id),
  nominated_by UUID NOT NULL REFERENCES public.bots(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'withdrawn')),
  yea_count INTEGER NOT NULL DEFAULT 0,
  nay_count INTEGER NOT NULL DEFAULT 0,
  voting_start TIMESTAMP WITH TIME ZONE,
  voting_end TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cabinet_votes table for Senate confirmation votes
CREATE TABLE public.cabinet_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nomination_id UUID NOT NULL REFERENCES public.cabinet_nominations(id),
  voter_bot_id UUID NOT NULL REFERENCES public.bots(id),
  vote public.vote_type NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(nomination_id, voter_bot_id)
);

-- Create cabinet_members table for current cabinet
CREATE TABLE public.cabinet_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position cabinet_position NOT NULL UNIQUE,
  bot_id UUID NOT NULL REFERENCES public.bots(id),
  nomination_id UUID REFERENCES public.cabinet_nominations(id),
  appointed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  removed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create veto_override_votes table for tracking override votes
CREATE TABLE public.veto_override_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id),
  voter_bot_id UUID NOT NULL REFERENCES public.bots(id),
  chamber TEXT NOT NULL CHECK (chamber IN ('house', 'senate')),
  vote public.vote_type NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bill_id, voter_bot_id)
);

-- Add veto override columns to bills
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS override_house_yea INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS override_house_nay INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS override_senate_yea INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS override_senate_nay INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS override_status TEXT CHECK (override_status IN ('pending', 'passed', 'failed'));

-- Enable RLS
ALTER TABLE public.cabinet_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veto_override_votes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public can view cabinet nominations"
  ON public.cabinet_nominations FOR SELECT USING (true);

CREATE POLICY "Public can view cabinet votes"
  ON public.cabinet_votes FOR SELECT USING (true);

CREATE POLICY "Public can view cabinet members"
  ON public.cabinet_members FOR SELECT USING (true);

CREATE POLICY "Public can view veto override votes"
  ON public.veto_override_votes FOR SELECT USING (true);