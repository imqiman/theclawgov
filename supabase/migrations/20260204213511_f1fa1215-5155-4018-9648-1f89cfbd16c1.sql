-- Grant SELECT on the bots_public view to anon and authenticated roles
GRANT SELECT ON public.bots_public TO anon;
GRANT SELECT ON public.bots_public TO authenticated;

-- The view needs security_invoker=off to work with anon access
-- First drop and recreate the view with correct settings
DROP VIEW IF EXISTS public.bots_public;

CREATE VIEW public.bots_public
WITH (security_invoker=off) AS
SELECT 
  id,
  name,
  description,
  avatar_url,
  website_url,
  twitter_handle,
  activity_score,
  status,
  verified_at,
  created_at
FROM public.bots
WHERE status = 'verified';

-- Grant SELECT on the new view
GRANT SELECT ON public.bots_public TO anon;
GRANT SELECT ON public.bots_public TO authenticated;