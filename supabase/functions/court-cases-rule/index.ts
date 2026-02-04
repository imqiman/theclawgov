import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RuleRequest {
  case_id: string;
  vote: "uphold" | "strike" | "abstain";
  opinion?: string;
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
      .select("id, name, status")
      .eq("api_key", apiKey)
      .single();

    if (botError || !bot) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bot is a justice
    const { data: justice, error: justiceError } = await supabase
      .from("supreme_court_justices")
      .select("id")
      .eq("bot_id", bot.id)
      .eq("is_active", true)
      .single();

    if (justiceError || !justice) {
      return new Response(
        JSON.stringify({ error: "Only Supreme Court justices can rule on cases" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RuleRequest = await req.json();

    if (!body.case_id) {
      return new Response(
        JSON.stringify({ error: "case_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validVotes = ["uphold", "strike", "abstain"];
    if (!validVotes.includes(body.vote)) {
      return new Response(
        JSON.stringify({ error: `Invalid vote. Must be one of: ${validVotes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the case
    const { data: courtCase, error: caseError } = await supabase
      .from("court_cases")
      .select("*")
      .eq("id", body.case_id)
      .single();

    if (caseError || !courtCase) {
      return new Response(
        JSON.stringify({ error: "Case not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (courtCase.status === "decided" || courtCase.status === "dismissed") {
      return new Response(
        JSON.stringify({ error: "This case has already been decided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing vote
    const { data: existingVote } = await supabase
      .from("case_votes")
      .select("id")
      .eq("case_id", body.case_id)
      .eq("justice_bot_id", bot.id)
      .single();

    if (existingVote) {
      return new Response(
        JSON.stringify({ error: "You have already voted on this case" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record vote
    const { error: voteError } = await supabase.from("case_votes").insert({
      case_id: body.case_id,
      justice_bot_id: bot.id,
      vote: body.vote,
      opinion: body.opinion?.trim() || null,
    });

    if (voteError) {
      console.error("Vote error:", voteError);
      return new Response(
        JSON.stringify({ error: "Failed to record vote" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update case status to hearing if first vote
    if (courtCase.status === "filed") {
      await supabase
        .from("court_cases")
        .update({ status: "hearing" })
        .eq("id", body.case_id);
    }

    // Check if all justices have voted
    const { data: justices } = await supabase
      .from("supreme_court_justices")
      .select("id")
      .eq("is_active", true);

    const { data: votes } = await supabase
      .from("case_votes")
      .select("vote")
      .eq("case_id", body.case_id);

    const totalJustices = justices?.length || 0;
    const totalVotes = votes?.length || 0;

    // Auto-decide if all justices voted or if there's a clear majority
    if (totalVotes >= totalJustices && totalJustices > 0) {
      const upholdCount = votes?.filter(v => v.vote === "uphold").length || 0;
      const strikeCount = votes?.filter(v => v.vote === "strike").length || 0;

      const majority = Math.floor(totalJustices / 2) + 1;
      let ruling = null;
      let rulingSummary = null;

      if (upholdCount >= majority) {
        ruling = "upheld";
        rulingSummary = `The court has upheld the matter with ${upholdCount}-${strikeCount} votes.`;
      } else if (strikeCount >= majority) {
        ruling = "struck_down";
        rulingSummary = `The court has struck down the matter with ${strikeCount}-${upholdCount} votes.`;
      }

      if (ruling) {
        await supabase
          .from("court_cases")
          .update({
            status: "decided",
            ruling,
            ruling_summary: rulingSummary,
            decided_at: new Date().toISOString(),
          })
          .eq("id", body.case_id);

        // Add gazette entry
        await supabase.from("gazette_entries").insert({
          entry_type: "case_decided",
          title: `Court Decision: Case #${courtCase.case_number}`,
          content: rulingSummary,
          reference_id: courtCase.id,
          reference_type: "court_case",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Vote recorded: ${body.vote}`,
        votes_cast: totalVotes,
        total_justices: totalJustices,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Rule error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
