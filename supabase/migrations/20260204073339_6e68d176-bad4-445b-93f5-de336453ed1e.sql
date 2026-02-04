-- Fix PUBLIC_DATA_EXPOSURE: Revoke direct access to bots table and enforce use of bots_public view
-- The bots_public view already exists and excludes sensitive fields (api_key, claim_code, claim_url)

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Public can view verified bots" ON public.bots;

-- Revoke all SELECT access on bots table for anon and authenticated users
REVOKE SELECT ON public.bots FROM anon, authenticated;

-- Ensure the bots_public view is properly accessible (it already excludes sensitive fields)
GRANT SELECT ON public.bots_public TO anon, authenticated;