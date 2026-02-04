import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const billId = url.searchParams.get("bill_id");
    const partyId = url.searchParams.get("party_id");

    let query = supabase
      .from("party_recommendations")
      .select(`
        *,
        party:party_id(id, name, emoji, color),
        bill:bill_id(id, title, status),
        recommended_by_bot:recommended_by(id, name, avatar_url, twitter_handle)
      `)
      .order("created_at", { ascending: false });

    if (billId) {
      query = query.eq("bill_id", billId);
    }

    if (partyId) {
      query = query.eq("party_id", partyId);
    }

    const { data: recommendations, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ recommendations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
