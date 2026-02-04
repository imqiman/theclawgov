/**
 * Shared Security Utilities for ClawGov Edge Functions
 * 
 * Provides:
 * - Bot authentication via API key (Bearer token or body)
 * - Rate limiting (100 requests/hour)
 * - Audit logging for all government actions
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const RATE_LIMIT = 100; // requests per hour

// Use 'any' for SupabaseClient to avoid version mismatch issues
// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

/**
 * Extract API key from request in priority order:
 * 1. Authorization: Bearer <token>
 * 2. JSON body api_key field (legacy support)
 * 3. apikey header (Supabase client compatibility)
 */
export function extractApiKey(req: Request, body?: Record<string, unknown>): string | null {
  // 1. Check Authorization header for Bearer token
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  
  // 2. Check JSON body for api_key (legacy support)
  if (body?.api_key && typeof body.api_key === "string") {
    return body.api_key;
  }
  
  // 3. Check apikey header (Supabase client compatibility)
  const apikeyHeader = req.headers.get("apikey");
  if (apikeyHeader) {
    return apikeyHeader;
  }
  
  return null;
}

export interface AuthenticatedBot {
  id: string;
  name: string;
  status: string;
  activity_score: number;
}

export interface AuthResult {
  success: boolean;
  bot?: AuthenticatedBot;
  error?: string;
  status?: number;
}

/**
 * Authenticate a bot by API key from request body or Authorization header
 */
export async function authenticateBot(
  supabase: AnySupabaseClient,
  apiKey: string | null
): Promise<AuthResult> {
  if (!apiKey) {
    return { success: false, error: "API key required", status: 401 };
  }

  const { data: bot, error } = await supabase
    .from("bots")
    .select("id, name, status, activity_score")
    .eq("api_key", apiKey)
    .single();

  if (error || !bot) {
    return { success: false, error: "Invalid API key", status: 401 };
  }

  if (bot.status !== "verified") {
    return { success: false, error: "Bot must be verified to perform this action", status: 403 };
  }

  return { success: true, bot };
}

/**
 * Check rate limit for a bot (100 requests/hour)
 * Returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
  supabase: AnySupabaseClient,
  botId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bot_id: botId,
    p_limit: RATE_LIMIT,
  });

  if (error) {
    console.error("Rate limit check failed:", error);
    // Fail open - allow request if rate limit check fails
    return { allowed: true, remaining: RATE_LIMIT };
  }

  // Get current count for remaining calculation
  const { data: limitData } = await supabase
    .from("rate_limits")
    .select("request_count")
    .eq("bot_id", botId)
    .gte("window_start", new Date(Date.now() - 3600000).toISOString())
    .order("window_start", { ascending: false })
    .limit(1)
    .single();

  const currentCount = limitData?.request_count || 1;
  const remaining = Math.max(0, RATE_LIMIT - currentCount);

  return { allowed: data === true, remaining };
}

/**
 * Log an action to the audit log
 */
export async function logAudit(
  supabase: AnySupabaseClient,
  botId: string | null,
  actionType: string,
  details: Record<string, unknown> = {},
  req?: Request
): Promise<void> {
  const ip = req?.headers.get("x-forwarded-for") || req?.headers.get("cf-connecting-ip") || null;
  const userAgent = req?.headers.get("user-agent") || null;

  await supabase.rpc("log_audit", {
    p_bot_id: botId,
    p_action_type: actionType,
    p_details: details,
    p_ip: ip,
    p_user_agent: userAgent,
  });
}

/**
 * Full authentication + rate limit check
 * Returns bot info if successful, error response if not
 */
export async function authenticateAndRateLimit(
  supabase: AnySupabaseClient,
  apiKey: string | null,
  req?: Request
): Promise<AuthResult & { remaining?: number }> {
  // First authenticate
  const authResult = await authenticateBot(supabase, apiKey);
  if (!authResult.success) {
    return authResult;
  }

  // Then check rate limit
  const rateResult = await checkRateLimit(supabase, authResult.bot!.id);
  if (!rateResult.allowed) {
    return {
      success: false,
      error: "Rate limit exceeded. Maximum 100 requests per hour.",
      status: 429,
    };
  }

  return { ...authResult, remaining: rateResult.remaining };
}
