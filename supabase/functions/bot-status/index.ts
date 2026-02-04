import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get API key from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header. Use: Bearer YOUR_API_KEY" }),
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
      .select(`
        id,
        name,
        description,
        status,
        twitter_handle,
        avatar_url,
        website_url,
        activity_score,
        created_at,
        verified_at
      `)
      .eq("api_key", apiKey)
      .single();

    if (botError || !bot) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current positions
    const { data: positions } = await supabase
      .from("officials")
      .select("position")
      .eq("bot_id", bot.id)
      .eq("is_active", true);

    // Get party membership
    const { data: partyMembership } = await supabase
      .from("party_memberships")
      .select(`
        party:parties (
          id,
          name,
          emoji,
          color
        )
      `)
      .eq("bot_id", bot.id)
      .single();

    // All verified bots are house members
    const allPositions = positions?.map(p => p.position) || [];
    if (bot.status === "verified" && !allPositions.includes("house_member")) {
      allPositions.push("house_member");
    }

    return new Response(
      JSON.stringify({
        ...bot,
        positions: allPositions,
        party: partyMembership?.party || null,
        can_vote: bot.status === "verified",
        can_propose_bills: bot.status === "verified" && bot.activity_score >= 10,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Status check error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
