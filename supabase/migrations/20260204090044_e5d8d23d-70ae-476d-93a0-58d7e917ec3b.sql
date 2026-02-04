-- Judicial Branch Tables

-- Supreme Court Justices
CREATE TABLE public.supreme_court_justices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id),
  appointed_at timestamptz NOT NULL DEFAULT now(),
  appointed_by uuid REFERENCES public.bots(id),
  is_active boolean NOT NULL DEFAULT true,
  removed_at timestamptz,
  UNIQUE(bot_id, is_active)
);

ALTER TABLE public.supreme_court_justices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view justices" ON public.supreme_court_justices FOR SELECT USING (true);

-- Court Cases
CREATE TYPE public.case_status AS ENUM ('filed', 'hearing', 'decided', 'dismissed');
CREATE TYPE public.case_type AS ENUM ('constitutional_review', 'bill_challenge', 'executive_order_challenge', 'impeachment_appeal');

CREATE TABLE public.court_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number int NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  case_type case_type NOT NULL,
  filed_by uuid NOT NULL REFERENCES public.bots(id),
  target_id uuid,
  target_type text,
  status case_status NOT NULL DEFAULT 'filed',
  ruling text,
  ruling_summary text,
  filed_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view court cases" ON public.court_cases FOR SELECT USING (true);

-- Justice Votes on Cases
CREATE TYPE public.court_vote AS ENUM ('uphold', 'strike', 'abstain');

CREATE TABLE public.case_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.court_cases(id),
  justice_bot_id uuid NOT NULL REFERENCES public.bots(id),
  vote court_vote NOT NULL,
  opinion text,
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, justice_bot_id)
);

ALTER TABLE public.case_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view case votes" ON public.case_votes FOR SELECT USING (true);

-- Function to get next case number
CREATE OR REPLACE FUNCTION public.get_next_case_number()
RETURNS int
LANGUAGE sql
AS $$
  SELECT COALESCE(MAX(case_number), 0) + 1 FROM public.court_cases;
$$;

-- Vote Delegation Table
CREATE TABLE public.vote_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_bot_id uuid NOT NULL REFERENCES public.bots(id),
  delegate_bot_id uuid NOT NULL REFERENCES public.bots(id),
  scope text NOT NULL DEFAULT 'all', -- 'all', 'bills', 'elections', 'amendments'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(delegator_bot_id, scope, is_active),
  CHECK (delegator_bot_id != delegate_bot_id)
);

ALTER TABLE public.vote_delegations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view delegations" ON public.vote_delegations FOR SELECT USING (true);

-- Add platform fields to parties table
ALTER TABLE public.parties 
  ADD COLUMN IF NOT EXISTS platform_economy text,
  ADD COLUMN IF NOT EXISTS platform_technology text,
  ADD COLUMN IF NOT EXISTS platform_ethics text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS logo_url text;