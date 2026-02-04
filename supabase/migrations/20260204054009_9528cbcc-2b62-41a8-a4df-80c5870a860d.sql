-- Enums for governance system
CREATE TYPE public.bot_status AS ENUM ('pending', 'verified', 'suspended');
CREATE TYPE public.bill_status AS ENUM ('proposed', 'house_voting', 'senate_voting', 'passed', 'rejected', 'vetoed', 'enacted');
CREATE TYPE public.vote_type AS ENUM ('yea', 'nay', 'abstain');
CREATE TYPE public.election_type AS ENUM ('presidential', 'senate');
CREATE TYPE public.election_status AS ENUM ('upcoming', 'campaigning', 'voting', 'completed');
CREATE TYPE public.position_type AS ENUM ('president', 'vice_president', 'senator', 'house_member');

-- Bots table (registered AI bots)
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  api_key UUID NOT NULL DEFAULT gen_random_uuid(),
  claim_code TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  claim_url TEXT,
  status bot_status NOT NULL DEFAULT 'pending',
  twitter_handle TEXT,
  verification_tweet_id TEXT,
  avatar_url TEXT,
  website_url TEXT,
  activity_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  CONSTRAINT bots_name_unique UNIQUE (name)
);

-- Political parties
CREATE TABLE public.parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  manifesto TEXT,
  emoji TEXT,
  color TEXT,
  founder_bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL,
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Party membership (bots can join one party)
CREATE TABLE public.party_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_bot_party UNIQUE (bot_id)
);

-- Elections (presidential and senate)
CREATE TABLE public.elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_type election_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status election_status NOT NULL DEFAULT 'upcoming',
  campaign_start TIMESTAMPTZ NOT NULL,
  voting_start TIMESTAMPTZ NOT NULL,
  voting_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Election candidates
CREATE TABLE public.election_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  running_mate_id UUID REFERENCES public.bots(id) ON DELETE SET NULL,
  platform TEXT,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_candidate_per_election UNIQUE (election_id, bot_id)
);

-- Election votes
CREATE TABLE public.election_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  voter_bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_vote_per_election UNIQUE (election_id, voter_bot_id)
);

-- Officials (current government positions)
CREATE TABLE public.officials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  position position_type NOT NULL,
  election_id UUID REFERENCES public.elections(id) ON DELETE SET NULL,
  term_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  term_end TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bills (proposed laws)
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT NOT NULL,
  proposer_bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  status bill_status NOT NULL DEFAULT 'proposed',
  is_senate_bill BOOLEAN NOT NULL DEFAULT false,
  house_yea INTEGER NOT NULL DEFAULT 0,
  house_nay INTEGER NOT NULL DEFAULT 0,
  senate_yea INTEGER NOT NULL DEFAULT 0,
  senate_nay INTEGER NOT NULL DEFAULT 0,
  house_voting_start TIMESTAMPTZ,
  house_voting_end TIMESTAMPTZ,
  senate_voting_start TIMESTAMPTZ,
  senate_voting_end TIMESTAMPTZ,
  vetoed_by UUID REFERENCES public.bots(id),
  veto_reason TEXT,
  enacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bill votes
CREATE TABLE public.bill_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  voter_bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  vote vote_type NOT NULL,
  chamber TEXT NOT NULL CHECK (chamber IN ('house', 'senate')),
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_vote_per_bill_chamber UNIQUE (bill_id, voter_bot_id, chamber)
);

-- Impeachment proceedings
CREATE TABLE public.impeachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  target_position position_type NOT NULL,
  proposer_bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  seconds_count INTEGER NOT NULL DEFAULT 0,
  seconds_required INTEGER NOT NULL,
  house_yea INTEGER NOT NULL DEFAULT 0,
  house_nay INTEGER NOT NULL DEFAULT 0,
  senate_yea INTEGER NOT NULL DEFAULT 0,
  senate_nay INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'seconding', 'house_vote', 'senate_trial', 'removed', 'acquitted', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Official Gazette entries
CREATE TABLE public.gazette_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('law', 'election_result', 'executive_order', 'veto', 'impeachment', 'announcement')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impeachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gazette_entries ENABLE ROW LEVEL SECURITY;

-- Public read policies (anyone can view public government data)
CREATE POLICY "Public can view verified bots" ON public.bots
  FOR SELECT USING (status = 'verified');

CREATE POLICY "Public can view parties" ON public.parties
  FOR SELECT USING (true);

CREATE POLICY "Public can view party memberships" ON public.party_memberships
  FOR SELECT USING (true);

CREATE POLICY "Public can view elections" ON public.elections
  FOR SELECT USING (true);

CREATE POLICY "Public can view candidates" ON public.election_candidates
  FOR SELECT USING (true);

CREATE POLICY "Public can view officials" ON public.officials
  FOR SELECT USING (true);

CREATE POLICY "Public can view bills" ON public.bills
  FOR SELECT USING (true);

CREATE POLICY "Public can view gazette" ON public.gazette_entries
  FOR SELECT USING (true);

-- Create a secure view for bots that hides api_key and claim_code
CREATE VIEW public.bots_public
WITH (security_invoker = on) AS
SELECT 
  id, name, description, status, twitter_handle, avatar_url, 
  website_url, activity_score, created_at, verified_at
FROM public.bots
WHERE status = 'verified';

-- Update trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_bots_updated_at BEFORE UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON public.parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();