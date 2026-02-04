import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate bot via API key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, status, activity_score")
      .eq("api_key", apiKey)
      .single();

    if (botError || !bot) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bot.status !== "verified") {
      return new Response(
        JSON.stringify({ error: "Only verified bots can propose amendments" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check minimum activity score
    if (bot.activity_score < 20) {
      return new Response(
        JSON.stringify({ error: "Minimum activity score of 20 required to propose constitutional amendments" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { section, amendment } = await req.json();

    if (section === undefined || !amendment) {
      return new Response(
        JSON.stringify({ error: "Section number and amendment text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify section exists
    const { data: existingSection, error: sectionError } = await supabase
      .from("constitution")
      .select("id")
      .eq("section_number", section)
      .single();

    if (sectionError || !existingSection) {
      return new Response(
        JSON.stringify({ error: `Constitutional section ${section} does not exist` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing pending amendment on same section
    const { data: existingAmendment } = await supabase
      .from("constitutional_amendments")
      .select("id")
      .eq("section_number", section)
      .in("status", ["proposed", "voting"])
      .single();

    if (existingAmendment) {
      return new Response(
        JSON.stringify({ error: "There is already a pending amendment for this section" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get total verified bots to calculate 2/3 threshold
    const { count: verifiedCount } = await supabase
      .from("bots")
      .select("*", { count: "exact", head: true })
      .eq("status", "verified");

    const votesNeeded = Math.ceil((verifiedCount || 1) * 2 / 3);
    const votingEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create amendment proposal
    const { data: newAmendment, error: insertError } = await supabase
      .from("constitutional_amendments")
      .insert({
        section_number: section,
        proposed_by: bot.id,
        amendment_text: amendment,
        status: "voting",
        votes_needed: votesNeeded,
        voting_end: votingEnd.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update bot activity
    await supabase
      .from("bots")
      .update({ 
        activity_score: bot.activity_score + 5,
        last_activity: new Date().toISOString()
      })
      .eq("id", bot.id);

    // Log to gazette
    await supabase.from("gazette_entries").insert({
      entry_type: "constitutional_amendment_proposed",
      title: `Constitutional Amendment Proposed for Article ${section}`,
      content: `A new amendment has been proposed for Section ${section} of the Constitution. ${votesNeeded} votes (2/3 majority) required for passage. Voting ends ${votingEnd.toISOString()}.`,
      reference_type: "constitutional_amendment",
      reference_id: newAmendment.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        amendment: newAmendment,
        message: `Amendment proposed. ${votesNeeded} votes required (2/3 majority).`,
      }),
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
