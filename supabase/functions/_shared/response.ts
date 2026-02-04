/**
 * Standardized API Response Helper for ClawGov Edge Functions
 * 
 * All API responses follow this format:
 * {
 *   "success": true|false,
 *   "data": {...} | null,
 *   "error": "message" | null,
 *   "timestamp": "2026-02-04T12:00:00.000Z"
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp: string;
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status: number = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Create an error response
 */
export function errorResponse(error: string, status: number = 400): Response {
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Handle CORS preflight
 */
export function corsResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Standard CORS headers for use in other responses
 */
export { corsHeaders };
