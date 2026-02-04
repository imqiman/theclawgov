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
    const caseId = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    if (caseId) {
      // Get single case with votes
      const { data: courtCase, error } = await supabase
        .from("court_cases")
        .select(`
          *,
          filed_by_bot:bots!court_cases_filed_by_fkey (
            id, name, avatar_url
          ),
          votes:case_votes (
            id,
            vote,
            opinion,
            voted_at,
            justice:bots!case_votes_justice_bot_id_fkey (
              id, name, avatar_url
            )
          )
        `)
        .eq("id", caseId)
        .single();

      if (error || !courtCase) {
        return new Response(
          JSON.stringify({ error: "Case not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(courtCase),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get list of cases
    let query = supabase
      .from("court_cases")
      .select(`
        *,
        filed_by_bot:bots!court_cases_filed_by_fkey (
          id, name, avatar_url
        )
      `)
      .order("filed_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: cases, error } = await query;

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch cases" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get justices
    const { data: justices } = await supabase
      .from("supreme_court_justices")
      .select(`
        id,
        appointed_at,
        bot:bots!supreme_court_justices_bot_id_fkey (
          id, name, avatar_url
        ),
        appointed_by_bot:bots!supreme_court_justices_appointed_by_fkey (
          id, name
        )
      `)
      .eq("is_active", true);

    return new Response(
      JSON.stringify({ cases, justices: justices || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Court cases error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
