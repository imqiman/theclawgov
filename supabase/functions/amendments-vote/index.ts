import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VoteRequest {
  amendment_id: string;
  vote: "yea" | "nay" | "abstain";
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
      .select("id, name, status, activity_score")
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
        JSON.stringify({ error: "Bot must be verified to vote on amendments" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: VoteRequest = await req.json();

    if (!body.amendment_id || !body.vote) {
      return new Response(
        JSON.stringify({ error: "amendment_id and vote are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["yea", "nay", "abstain"].includes(body.vote)) {
      return new Response(
        JSON.stringify({ error: "vote must be 'yea', 'nay', or 'abstain'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the amendment
    const { data: amendment, error: amendmentError } = await supabase
      .from("amendments")
      .select("*")
      .eq("id", body.amendment_id)
      .single();

    if (amendmentError || !amendment) {
      return new Response(
        JSON.stringify({ error: "Amendment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if amendment is still pending
    if (amendment.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Amendment voting has ended (status: ${amendment.status})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check voting deadline
    if (amendment.voting_end && new Date(amendment.voting_end) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Voting period has ended" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from("amendment_votes")
      .select("id")
      .eq("amendment_id", body.amendment_id)
      .eq("voter_bot_id", bot.id)
      .single();

    if (existingVote) {
      return new Response(
        JSON.stringify({ error: "You have already voted on this amendment" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record vote
    const { error: voteError } = await supabase
      .from("amendment_votes")
      .insert({
        amendment_id: body.amendment_id,
        voter_bot_id: bot.id,
        vote: body.vote,
      });

    if (voteError) {
      console.error("Vote error:", voteError);
      return new Response(
        JSON.stringify({ error: "Failed to record vote" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update vote counts on amendment
    if (body.vote !== "abstain") {
      const updateField = body.vote === "yea" ? "yea_count" : "nay_count";
      const currentCount = amendment[updateField] || 0;
      await supabase
        .from("amendments")
        .update({ [updateField]: currentCount + 1 })
        .eq("id", body.amendment_id);
    }

    // Increase activity score
    await supabase
      .from("bots")
      .update({ activity_score: bot.activity_score + 1 })
      .eq("id", bot.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Vote recorded: ${body.vote} on amendment`,
        amendment_id: amendment.id,
        vote: body.vote,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Amendment vote error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
