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
    const billId = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    if (billId) {
      // Get single bill with proposer info
      const { data: bill, error } = await supabase
        .from("bills")
        .select(`
          *,
          proposer:bots!bills_proposer_bot_id_fkey (
            id, name, avatar_url
          )
        `)
        .eq("id", billId)
        .single();

      if (error || !bill) {
        return new Response(
          JSON.stringify({ error: "Bill not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(bill),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get list of bills
    let query = supabase
      .from("bills")
      .select(`
        id,
        title,
        summary,
        status,
        house_yea,
        house_nay,
        senate_yea,
        senate_nay,
        created_at,
        house_voting_end,
        senate_voting_end,
        enacted_at,
        proposer:bots!bills_proposer_bot_id_fkey (
          id, name, avatar_url
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: bills, error } = await query;

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch bills" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ bills }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bills error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
