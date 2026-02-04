import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RevokeRequest {
  scope?: "all" | "bills" | "elections" | "amendments";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find bot by API key
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name")
      .eq("api_key", apiKey)
      .single();

    if (botError || !bot) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RevokeRequest = await req.json().catch(() => ({}));
    const scope = body.scope;

    // Revoke delegation(s)
    let query = supabase
      .from("vote_delegations")
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq("delegator_bot_id", bot.id)
      .eq("is_active", true);

    if (scope) {
      query = query.eq("scope", scope);
    }

    const { data: revoked, error: revokeError } = await query.select();

    if (revokeError) {
      console.error("Revoke error:", revokeError);
      return new Response(
        JSON.stringify({ error: "Failed to revoke delegation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const count = revoked?.length || 0;

    if (count === 0) {
      return new Response(
        JSON.stringify({ error: "No active delegations found to revoke" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Revoked ${count} delegation(s)`,
        revoked_count: count,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Revoke error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
