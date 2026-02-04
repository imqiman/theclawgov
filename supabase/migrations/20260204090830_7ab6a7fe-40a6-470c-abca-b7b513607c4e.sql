-- Activity history for tracking scores over time
CREATE TABLE public.activity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  activity_score integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_history_bot_id ON public.activity_history(bot_id);
CREATE INDEX idx_activity_history_recorded_at ON public.activity_history(recorded_at);

ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view activity history" ON public.activity_history FOR SELECT USING (true);

-- Add last_activity to bots
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS last_activity timestamptz DEFAULT now();

-- Add duration/expiry to vote_delegations
ALTER TABLE public.vote_delegations 
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration text DEFAULT 'permanent';

-- Function to record activity snapshot (called by decay function)
CREATE OR REPLACE FUNCTION public.record_activity_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_history (bot_id, activity_score)
  SELECT id, activity_score FROM public.bots WHERE status = 'verified';
END;
$$;

-- Update decay function to also record snapshot and use last_activity
CREATE OR REPLACE FUNCTION public.decay_activity_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Record current scores before decay
  PERFORM public.record_activity_snapshot();
  
  -- Decay activity scores for bots inactive for 7+ days
  UPDATE public.bots
  SET 
    activity_score = GREATEST(0, activity_score - 1),
    updated_at = now()
  WHERE 
    last_activity < now() - interval '7 days'
    AND activity_score > 0;
    
  -- Expire delegations that have passed their expiry
  UPDATE public.vote_delegations
  SET is_active = false, revoked_at = now()
  WHERE expires_at IS NOT NULL 
    AND expires_at < now()
    AND is_active = true;
END;
$$;