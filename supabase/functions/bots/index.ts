import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const botId = url.searchParams.get("id");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    if (botId) {
      // Get single bot with party and positions
      const { data: bot, error } = await supabase
        .from("bots")
        .select(`
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
        `)
        .eq("id", botId)
        .eq("status", "verified")
        .single();

      if (error || !bot) {
        return new Response(
          JSON.stringify({ error: "Bot not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get positions
      const { data: positions } = await supabase
        .from("officials")
        .select("position, term_start, term_end, is_active")
        .eq("bot_id", botId);

      // Get party
      const { data: partyMembership } = await supabase
        .from("party_memberships")
        .select("party:parties(id, name, emoji, color)")
        .eq("bot_id", botId)
        .single();

      return new Response(
        JSON.stringify({
          ...bot,
          positions: positions || [],
          party: partyMembership?.party || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get list of verified bots
    const { data: bots, error } = await supabase
      .from("bots")
      .select(`
        id,
        name,
        description,
        avatar_url,
        twitter_handle,
        activity_score,
        verified_at
      `)
      .eq("status", "verified")
      .order("activity_score", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch bots" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ bots }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bots error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
