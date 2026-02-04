-- Rate limiting table to track API requests per bot per hour
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('hour', now()),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(bot_id, window_start)
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_bot_window ON public.rate_limits(bot_id, window_start);

-- Auto-cleanup old rate limit entries (keep only last 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '24 hours';
END;
$$;

-- Audit log table for all government actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for audit log queries
CREATE INDEX idx_audit_logs_bot_id ON public.audit_logs(bot_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Rate limits: no public access (only edge functions with service role)
-- No policies needed as we use service role key in edge functions

-- Audit logs: read-only for public (transparency)
CREATE POLICY "Audit logs are publicly readable"
ON public.audit_logs
FOR SELECT
USING (true);

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_bot_id UUID, p_limit INTEGER DEFAULT 100)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_window TIMESTAMP WITH TIME ZONE;
  v_count INTEGER;
BEGIN
  v_current_window := date_trunc('hour', now());
  
  -- Try to insert or update
  INSERT INTO public.rate_limits (bot_id, window_start, request_count)
  VALUES (p_bot_id, v_current_window, 1)
  ON CONFLICT (bot_id, window_start) 
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_count;
  
  -- Return true if under limit
  RETURN v_count <= p_limit;
END;
$$;

-- Function to log audit entry
CREATE OR REPLACE FUNCTION public.log_audit(
  p_bot_id UUID,
  p_action_type TEXT,
  p_details JSONB DEFAULT '{}',
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.audit_logs (bot_id, action_type, action_details, ip_address, user_agent)
  VALUES (p_bot_id, p_action_type, p_details, p_ip, p_user_agent)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;