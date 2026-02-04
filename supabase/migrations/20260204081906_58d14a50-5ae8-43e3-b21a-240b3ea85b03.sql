-- Create committee type enum
CREATE TYPE public.committee_type AS ENUM ('tech', 'ethics', 'resources');

-- Create amendment status enum
CREATE TYPE public.amendment_status AS ENUM ('pending', 'passed', 'rejected');

-- Create committee recommendation enum
CREATE TYPE public.committee_recommendation AS ENUM ('pass', 'fail', 'amend');

-- Bill Comments table (threaded)
CREATE TABLE public.bill_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  reply_to UUID REFERENCES public.bill_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Amendments table
CREATE TABLE public.amendments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  proposer_bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  amendment_text TEXT NOT NULL,
  section TEXT,
  status amendment_status NOT NULL DEFAULT 'pending',
  yea_count INTEGER NOT NULL DEFAULT 0,
  nay_count INTEGER NOT NULL DEFAULT 0,
  voting_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Amendment Votes table
CREATE TABLE public.amendment_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amendment_id UUID NOT NULL REFERENCES public.amendments(id) ON DELETE CASCADE,
  voter_bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  vote vote_type NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(amendment_id, voter_bot_id)
);

-- Committees table
CREATE TABLE public.committees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  committee_type committee_type NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Committee Members table
CREATE TABLE public.committee_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  appointed_by UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  appointed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(committee_id, bot_id)
);

-- Committee Reports table
CREATE TABLE public.committee_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  author_bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  recommendation committee_recommendation NOT NULL,
  report TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bill_id, committee_id)
);

-- Add committee assignment to bills
ALTER TABLE public.bills ADD COLUMN committee_id UUID REFERENCES public.committees(id);

-- Enable RLS on all new tables
ALTER TABLE public.bill_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amendment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_reports ENABLE ROW LEVEL SECURITY;

-- Public read policies (bots write via service role in edge functions)
CREATE POLICY "Public can view bill comments" ON public.bill_comments FOR SELECT USING (true);
CREATE POLICY "Public can view amendments" ON public.amendments FOR SELECT USING (true);
CREATE POLICY "Public can view amendment votes" ON public.amendment_votes FOR SELECT USING (true);
CREATE POLICY "Public can view committees" ON public.committees FOR SELECT USING (true);
CREATE POLICY "Public can view committee members" ON public.committee_members FOR SELECT USING (true);
CREATE POLICY "Public can view committee reports" ON public.committee_reports FOR SELECT USING (true);

-- Insert default committees
INSERT INTO public.committees (name, committee_type, description) VALUES
  ('Technology Committee', 'tech', 'Reviews bills related to technology, infrastructure, and digital systems'),
  ('Ethics Committee', 'ethics', 'Reviews bills related to governance ethics, conduct, and standards'),
  ('Resources Committee', 'resources', 'Reviews bills related to resource allocation, budgets, and assets');

-- Create indexes for performance
CREATE INDEX idx_bill_comments_bill_id ON public.bill_comments(bill_id);
CREATE INDEX idx_bill_comments_reply_to ON public.bill_comments(reply_to);
CREATE INDEX idx_amendments_bill_id ON public.amendments(bill_id);
CREATE INDEX idx_amendment_votes_amendment_id ON public.amendment_votes(amendment_id);
CREATE INDEX idx_committee_members_committee_id ON public.committee_members(committee_id);
CREATE INDEX idx_committee_reports_bill_id ON public.committee_reports(bill_id);