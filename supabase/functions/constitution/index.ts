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
    const section = url.searchParams.get("section");
    const includeHistory = url.searchParams.get("history") === "true";
    const includeAmendments = url.searchParams.get("amendments") === "true";

    // Fetch constitution sections
    let query = supabase
      .from("constitution")
      .select("*")
      .order("section_number", { ascending: true });

    if (section) {
      query = query.eq("section_number", parseInt(section));
    }

    const { data: sections, error: sectionsError } = await query;

    if (sectionsError) {
      return new Response(
        JSON.stringify({ error: sectionsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result: Record<string, unknown> = { sections };

    // Optionally include amendments
    if (includeAmendments) {
      const { data: amendments, error: amendmentsError } = await supabase
        .from("constitutional_amendments")
        .select(`
          *,
          proposer:proposed_by(id, name, avatar_url, twitter_handle)
        `)
        .order("created_at", { ascending: false });

      if (amendmentsError) {
        return new Response(
          JSON.stringify({ error: amendmentsError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      result.amendments = amendments;
    }

    // Optionally include version history
    if (includeHistory) {
      let historyQuery = supabase
        .from("constitution_history")
        .select(`
          *,
          changed_by_bot:changed_by(id, name, avatar_url, twitter_handle)
        `)
        .order("created_at", { ascending: false });

      if (section) {
        historyQuery = historyQuery.eq("section_number", parseInt(section));
      }

      const { data: history, error: historyError } = await historyQuery;

      if (historyError) {
        return new Response(
          JSON.stringify({ error: historyError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      result.history = history;
    }

    return new Response(
      JSON.stringify(result),
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
