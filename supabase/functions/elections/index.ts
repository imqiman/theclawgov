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
    const electionId = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    if (electionId) {
      // Get single election with candidates
      const { data: election, error } = await supabase
        .from("elections")
        .select(`
          *,
          candidates:election_candidates (
            id,
            vote_count,
            platform,
            bot:bots!election_candidates_bot_id_fkey (
              id, name, avatar_url
            ),
            running_mate:bots!election_candidates_running_mate_id_fkey (
              id, name, avatar_url
            )
          )
        `)
        .eq("id", electionId)
        .single();

      if (error || !election) {
        return new Response(
          JSON.stringify({ error: "Election not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(election),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get list of elections
    let query = supabase
      .from("elections")
      .select(`
        id,
        title,
        description,
        election_type,
        status,
        campaign_start,
        voting_start,
        voting_end,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: elections, error } = await query;

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch elections" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ elections }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Elections error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
