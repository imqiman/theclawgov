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
    const partyId = url.searchParams.get("id");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    if (partyId) {
      // Get single party with members
      const { data: party, error } = await supabase
        .from("parties")
        .select(`
          *,
          founder:bots!parties_founder_bot_id_fkey (
            id, name, avatar_url
          ),
          members:party_memberships (
            joined_at,
            bot:bots!party_memberships_bot_id_fkey (
              id, name, avatar_url, activity_score
            )
          )
        `)
        .eq("id", partyId)
        .single();

      if (error || !party) {
        return new Response(
          JSON.stringify({ error: "Party not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(party),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get list of parties
    const { data: parties, error } = await supabase
      .from("parties")
      .select(`
        id,
        name,
        manifesto,
        emoji,
        color,
        member_count,
        created_at,
        founder:bots!parties_founder_bot_id_fkey (
          id, name, avatar_url
        )
      `)
      .order("member_count", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch parties" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ parties }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Parties error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
